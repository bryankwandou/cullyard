// Lanes are plain folders inside the workspace. A file's lane is recorded in
// .cullyard/lanes.json so the desk and the agent always agree on where it sits.
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const DEFAULT_LANES = ['Picks', 'Maybe', 'Rejects'];
const STATE_DIR = '.cullyard';
const STATE_FILE = 'lanes.json';
const LOG_FILE = 'log.jsonl';

export function safeLaneName(name) {
  const clean = String(name ?? '').trim();
  if (!clean || clean.length > 40) throw new Error('lane name must be 1-40 characters');
  if (/[\\/:*?"<>|]/.test(clean) || clean === '.' || clean === '..') {
    throw new Error(`lane name "${clean}" contains characters not allowed in a folder name`);
  }
  return clean;
}

export async function loadState(root) {
  const file = path.join(root, STATE_DIR, STATE_FILE);
  try {
    const state = JSON.parse(await fs.readFile(file, 'utf8'));
    state.lanes ??= [...DEFAULT_LANES];
    state.assignments ??= {};
    return state;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return { lanes: [...DEFAULT_LANES], assignments: {} };
  }
}

export async function saveState(root, state) {
  const dir = path.join(root, STATE_DIR);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, STATE_FILE), JSON.stringify(state, null, 2));
}

export async function appendLog(root, entry) {
  const dir = path.join(root, STATE_DIR);
  await fs.mkdir(dir, { recursive: true });
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
  await fs.appendFile(path.join(dir, LOG_FILE), line);
}

export async function createLane(root, name) {
  const lane = safeLaneName(name);
  const state = await loadState(root);
  if (!state.lanes.includes(lane)) state.lanes.push(lane);
  await saveState(root, state);
  await fs.mkdir(path.join(root, lane), { recursive: true });
  return state.lanes;
}

// Moves a file into a lane folder inside the workspace. Refuses to leave the root
// and never overwrites an existing file.
export async function moveToLane(root, relFile, lane) {
  const laneName = safeLaneName(lane);
  const state = await loadState(root);
  if (!state.lanes.includes(laneName)) throw new Error(`unknown lane "${laneName}"`);

  const from = path.resolve(root, relFile);
  if (!from.startsWith(path.resolve(root) + path.sep)) throw new Error('file is outside the workspace');
  const base = path.basename(from);
  const destDir = path.join(root, laneName);
  const to = path.join(destDir, base);

  await fs.mkdir(destDir, { recursive: true });
  try {
    await fs.access(to);
    throw new Error(`"${base}" already exists in lane ${laneName}`);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  await fs.rename(from, to);

  const rel = path.relative(root, to);
  delete state.assignments[path.relative(root, from)];
  state.assignments[rel] = laneName;
  await saveState(root, state);
  await appendLog(root, { action: 'move', file: base, lane: laneName });
  return { from: path.relative(root, from), to: rel, lane: laneName };
}
