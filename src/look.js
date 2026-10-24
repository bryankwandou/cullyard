// Lets the agent look at photos: measured quality signals, a preview it can see,
// and a numbered contact sheet. Numbers are signals for the agent, not verdicts;
// a shallow-focus portrait or a night shot can be a keeper with "bad" numbers.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { kindOf } from './kinds.js';
import { appendLog } from './lanes.js';

const STATE_DIR = '.cullyard';
const QUALITY_FILE = 'quality.json';
const GRID = 4; // sharpness is measured per tile so a sharp subject on a soft background still counts
const SIDE = 512;

async function sharp() {
  return (await import('sharp')).default;
}

// Variance of the Laplacian over a greyscale buffer, per tile. Returns the global
// value and the sharpest tile, which tracks the subject better than the global one.
function laplacianStats(px, w, h) {
  const tileW = Math.floor(w / GRID);
  const tileH = Math.floor(h / GRID);
  const tiles = Array.from({ length: GRID * GRID }, () => ({ n: 0, sum: 0, sq: 0 }));
  let n = 0; let sum = 0; let sq = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = px[i - w] + px[i + w] + px[i - 1] + px[i + 1] - 4 * px[i];
      n++; sum += v; sq += v * v;
      const t = tiles[Math.min(GRID - 1, Math.floor(y / tileH)) * GRID + Math.min(GRID - 1, Math.floor(x / tileW))];
      t.n++; t.sum += v; t.sq += v * v;
    }
  }
  const variance = (a) => (a.n ? a.sq / a.n - (a.sum / a.n) ** 2 : 0);
  return { global: variance({ n, sum, sq }), peak: Math.max(...tiles.map(variance)) };
}

function exposureStats(px) {
  const hist = new Uint32Array(256);
  let sum = 0;
  for (const v of px) { hist[v]++; sum += v; }
  const pct = (p) => { let acc = 0; const target = px.length * p; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= target) return i; } return 255; };
  let dark = 0; let bright = 0;
  for (let i = 0; i <= 5; i++) dark += hist[i];
  for (let i = 250; i < 256; i++) bright += hist[i];
  return { mean: Math.round(sum / px.length), p5: pct(0.05), p95: pct(0.95), shadowClipPct: +(100 * dark / px.length).toFixed(1), highlightClipPct: +(100 * bright / px.length).toFixed(1) };
}

// 64-bit difference hash: near-identical frames (bursts, brackets) land within a few bits.
async function dHash(abs) {
  const s = await sharp();
  const px = await s(abs, { failOn: 'none' }).rotate().greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let bits = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += px[y * 9 + x] < px[y * 9 + x + 1] ? '1' : '0';
  return BigInt('0b' + bits).toString(16).padStart(16, '0');
}

// Mean colour of a 3×3 grid. dHash is blind to colour, so the same framing at golden
// hour and at blue hour would otherwise look like one burst.
async function colourPrint(abs) {
  const s = await sharp();
  const px = await s(abs, { failOn: 'none' }).rotate().removeAlpha().resize(3, 3, { fit: 'fill' }).raw().toBuffer();
  return px.toString('hex');
}

function colourDistance(a, b) {
  const x = Buffer.from(a, 'hex'); const y = Buffer.from(b, 'hex');
  let d = 0;
  for (let i = 0; i < x.length; i++) d += Math.abs(x[i] - y[i]);
  return d / x.length;
}

// Same burst: near-identical structure and near-identical colour.
export function sameBurst(a, b) {
  return hamming(a.hash, b.hash) <= 8 && colourDistance(a.colour, b.colour) <= 14;
}

export function hamming(a, b) {
  let x = BigInt('0x' + a) ^ BigInt('0x' + b);
  let n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
}

export async function measurePhoto(abs) {
  const s = await sharp();
  const grey = s(abs, { failOn: 'none' }).rotate().greyscale().resize(SIDE, SIDE, { fit: 'inside', withoutEnlargement: true });
  const { data, info } = await grey.clone().raw().toBuffer({ resolveWithObject: true });
  // Focus is measured on a contrast-stretched copy: a dark frame has weaker edges, and
  // without this it would read as soft as well as dark.
  const stretched = await grey.clone().normalise().raw().toBuffer();
  const lap = laplacianStats(stretched, info.width, info.height);
  return {
    sharpness: Math.round(lap.global),
    subjectSharpness: Math.round(lap.peak),
    exposure: exposureStats(data),
    hash: await dHash(abs),
    colour: await colourPrint(abs),
  };
}

// Measures every image in the given files, then judges each one against the rest of
// the set, because "sharp enough" depends on the lens, the light and the subject.
export async function assessPhotos(root, relFiles) {
  const rows = [];
  for (const rel of relFiles) {
    const abs = path.resolve(root, rel);
    if (!abs.startsWith(path.resolve(root) + path.sep)) throw new Error(`${rel} is outside the workspace`);
    const kind = kindOf(abs);
    if (kind !== 'image' && kind !== 'raw') continue;
    try {
      rows.push({ file: rel, ...(await measurePhoto(abs)) });
    } catch (err) {
      rows.push({ file: rel, error: err.message.split('\n')[0] });
    }
  }
  const ok = rows.filter((r) => !r.error);
  const sorted = ok.map((r) => r.subjectSharpness).sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;

  // Group near-duplicates; the sharpest frame of each group is its pick.
  let group = 0;
  for (const r of ok) {
    if (r.similarGroup) continue;
    const members = ok.filter((o) => !o.similarGroup && sameBurst(o, r));
    if (members.length < 2) continue;
    group++;
    const top = members.reduce((a, b) => (b.subjectSharpness > a.subjectSharpness ? b : a));
    for (const m of members) { m.similarGroup = group; m.bestInGroup = m === top; }
  }

  for (const r of ok) {
    const flags = [];
    const soft = ok.length >= 3 ? r.subjectSharpness < median * 0.4 : r.subjectSharpness < 40;
    if (soft) flags.push('soft');
    if (r.exposure.mean < 50 || r.exposure.shadowClipPct > 25) flags.push('dark');
    if (r.exposure.mean > 205 || r.exposure.highlightClipPct > 15) flags.push('bright');
    if (r.similarGroup && !r.bestInGroup) flags.push('duplicate');
    r.flags = flags;
  }
  // Percentages are against the sharpest well-exposed frame: sensor noise in a dark frame
  // reads as detail and would otherwise set the bar.
  const exposed = ok.filter((r) => !r.flags.includes('dark') && !r.flags.includes('bright'));
  const best = Math.max(1, ...(exposed.length ? exposed : ok).map((r) => r.subjectSharpness));
  for (const r of ok) r.relativeSharpness = +Math.min(1, r.subjectSharpness / best).toFixed(2);
  // Rank is a keep order: clean frames first, then flagged ones, sharpest first within each.
  ok.sort((a, b) => a.flags.length - b.flags.length || b.subjectSharpness - a.subjectSharpness);
  ok.forEach((r, i) => { r.rank = i + 1; });
  await saveQuality(root, ok);
  await appendLog(root, { action: 'assess', count: ok.length });
  return { measured: ok.length, medianSubjectSharpness: median, groups: group, photos: [...ok, ...rows.filter((r) => r.error)] };
}

async function saveQuality(root, rows) {
  const dir = path.join(root, STATE_DIR);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, QUALITY_FILE);
  const prev = await loadQuality(root);
  for (const r of rows) {
    prev[path.basename(r.file)] = { flags: r.flags, relativeSharpness: r.relativeSharpness, rank: r.rank, mean: r.exposure.mean, similarGroup: r.similarGroup ?? null };
  }
  await fs.writeFile(file, JSON.stringify(prev, null, 2));
}

// Keyed by file name so the scores follow a photo when it moves between lanes.
export async function loadQuality(root) {
  try {
    return JSON.parse(await fs.readFile(path.join(root, STATE_DIR, QUALITY_FILE), 'utf8'));
  } catch {
    return {};
  }
}

export async function previewImage(abs, size = 768) {
  const s = await sharp();
  const buf = await s(abs, { failOn: 'none' }).rotate().resize(size, size, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  return buf.toString('base64');
}

const esc = (t) => t.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

// Numbered grid of thumbnails, so the agent can compare a whole set in one look and
// refer to frames by number. The legend maps numbers back to files.
// Cells are 4:3, close to most camera frames, so little of the sheet is padding.
export async function contactSheet(root, relFiles, { cell = 256, cols = 4 } = {}) {
  const s = await sharp();
  const files = relFiles.slice(0, 16);
  const rows = Math.ceil(files.length / cols);
  const cellH = Math.round(cell * 0.75);
  const label = 26;
  const tiles = [];
  const legend = [];
  for (let i = 0; i < files.length; i++) {
    const abs = path.resolve(root, files[i]);
    if (!abs.startsWith(path.resolve(root) + path.sep)) throw new Error(`${files[i]} is outside the workspace`);
    let img;
    try {
      img = await s(abs, { failOn: 'none' }).rotate().resize(cell, cellH, { fit: 'contain', background: '#0e1013' }).png().toBuffer();
    } catch {
      img = await s({ create: { width: cell, height: cellH, channels: 3, background: '#2a2f37' } }).png().toBuffer();
    }
    const x = (i % cols) * cell;
    const y = Math.floor(i / cols) * (cellH + label);
    const name = path.basename(files[i]);
    const tag = Buffer.from(`<svg width="${cell}" height="${label}"><rect width="100%" height="100%" fill="#0e1013"/><text x="8" y="18" font-family="Consolas, monospace" font-size="14" fill="#f2b33d">${i + 1}</text><text x="34" y="18" font-family="Consolas, monospace" font-size="13" fill="#e6e8eb">${esc(name.length > 26 ? name.slice(0, 25) + '…' : name)}</text></svg>`);
    tiles.push({ input: img, left: x, top: y }, { input: tag, left: x, top: y + cellH });
    legend.push({ n: i + 1, file: files[i] });
  }
  const sheet = await s({ create: { width: cols * cell, height: rows * (cellH + label), channels: 3, background: '#0e1013' } })
    .composite(tiles).jpeg({ quality: 80 }).toBuffer();
  return { data: sheet.toString('base64'), legend, skipped: relFiles.length - files.length };
}
