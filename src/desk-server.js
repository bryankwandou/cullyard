// The desk: a small local web app on 127.0.0.1. You drop files in, the agent sorts
// them over MCP, and both sides read the same folders and the same lanes.json.
import http from 'node:http';
import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanFolder } from './scan.js';
import { loadState, createLane, moveToLane, appendLog } from './lanes.js';

const DESK_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'desk');
const STATIC = { '/': 'index.html', '/desk.css': 'desk.css', '/desk.js': 'desk.js', '/i18n.js': 'i18n.js' };
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.avif': 'image/avif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.flac': 'audio/flac', '.pdf': 'application/pdf',
};
const MAX_UPLOAD = 2 * 1024 ** 3;

export async function deskState(root) {
  const state = await loadState(root);
  const inbox = await scanFolder(root, { meta: false });
  const lanes = {};
  for (const lane of state.lanes) {
    lanes[lane] = await scanFolder(path.join(root, lane), { meta: false }).catch(() => []);
  }
  const log = await fs.readFile(path.join(root, '.cullyard', 'log.jsonl'), 'utf8').catch(() => '');
  const recent = log.split('\n').filter(Boolean).slice(-40).map((l) => JSON.parse(l)).reverse();
  return { workspace: root, laneOrder: state.lanes, inbox, lanes, log: recent };
}

function inside(root, rel) {
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(path.resolve(root) + path.sep)) throw Object.assign(new Error('outside workspace'), { status: 403 });
  return abs;
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 64 * 1024) throw Object.assign(new Error('body too large'), { status: 413 });
  }
  return JSON.parse(body || '{}');
}

// Picks "name (2).ext" when "name.ext" is taken, so a drop never overwrites.
async function freeName(dir, name) {
  const { name: stem, ext } = path.parse(name);
  for (let i = 1; i < 1000; i++) {
    const candidate = i === 1 ? name : `${stem} (${i})${ext}`;
    try { await fs.access(path.join(dir, candidate)); } catch { return candidate; }
  }
  throw new Error('too many files with this name');
}

export function createDesk({ root }) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const send = (status, body, type = 'application/json') => {
      res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      res.end(type === 'application/json' ? JSON.stringify(body) : body);
    };
    try {
      // Only same-origin requests may change files.
      if (req.method !== 'GET' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
        return send(403, { error: 'cross-origin request refused' });
      }
      if (req.method === 'GET' && STATIC[url.pathname]) {
        const file = path.join(DESK_DIR, STATIC[url.pathname]);
        return send(200, await fs.readFile(file), TYPES[path.extname(file)]);
      }
      if (req.method === 'GET' && url.pathname === '/api/state') return send(200, await deskState(root));
      if (req.method === 'GET' && url.pathname === '/api/file') {
        const abs = inside(root, url.searchParams.get('path') ?? '');
        const st = await fs.stat(abs);
        res.writeHead(200, { 'content-type': TYPES[path.extname(abs).toLowerCase()] ?? 'application/octet-stream', 'content-length': st.size });
        return createReadStream(abs).pipe(res);
      }
      if (req.method === 'POST' && url.pathname === '/api/upload') {
        const raw = path.basename(url.searchParams.get('name') ?? '');
        if (!raw || raw.startsWith('.')) return send(400, { error: 'bad file name' });
        const size = Number(req.headers['content-length'] ?? 0);
        if (size > MAX_UPLOAD) return send(413, { error: 'file larger than 2 GB' });
        const name = await freeName(root, raw);
        await fs.writeFile(path.join(root, name), req);
        await appendLog(root, { action: 'drop', file: name, by: 'desk' });
        return send(201, { name });
      }
      if (req.method === 'POST' && url.pathname === '/api/move') {
        const { file, lane } = await readJson(req);
        return send(200, await moveToLane(root, file, lane));
      }
      if (req.method === 'POST' && url.pathname === '/api/lane') {
        const { name } = await readJson(req);
        return send(200, { lanes: await createLane(root, name) });
      }
      send(404, { error: 'not found' });
    } catch (err) {
      send(err.status ?? (err.code === 'ENOENT' ? 404 : 400), { error: err.message });
    }
  });
}

export function startDesk({ root, port = Number(process.env.CULLYARD_PORT ?? 4870) }) {
  const desk = createDesk({ root });
  return new Promise((resolve) => {
    desk.once('error', (err) => {
      console.error(`desk not started (${err.code}); MCP tools still work`);
      resolve(null);
    });
    desk.listen(port, '127.0.0.1', () => resolve(desk));
  });
}
