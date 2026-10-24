// Edits that write a new file next to the original. The source is never modified.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export function outputPath(src, suffix, ext) {
  const { dir, name } = path.parse(src);
  return path.join(dir, `${name}${suffix}.${ext}`);
}

async function assertNew(file) {
  try {
    await fs.access(file);
    throw new Error(`${path.basename(file)} already exists; choose another output name`);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

export async function resizeImage(src, { width, height, format = 'webp', quality = 85 }) {
  if (!width && !height) throw new Error('give width, height, or both');
  const sharp = (await import('sharp')).default;
  const out = outputPath(src, `-${width ?? 'auto'}x${height ?? 'auto'}`, format);
  await assertNew(out);
  const pipeline = sharp(src, { failOn: 'none' }).rotate().resize({ width, height, fit: 'inside', withoutEnlargement: true });
  const encoders = { webp: 'webp', jpg: 'jpeg', jpeg: 'jpeg', png: 'png', avif: 'avif' };
  const enc = encoders[format];
  if (!enc) throw new Error(`unsupported output format ${format}`);
  await pipeline[enc]({ quality }).toFile(out);
  const meta = await sharp(out).metadata();
  return { output: out, width: meta.width, height: meta.height, bytes: (await fs.stat(out)).size };
}

export function ffmpegBin() {
  return require('ffmpeg-static');
}

function run(bin, args) {
  return new Promise((resolve, reject) => {
    // stdin stays closed: under a stdio MCP server, a child that reads stdin can stall the session.
    const child = spawn(bin, ['-nostdin', ...args], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => { stderr += '\nffmpeg took longer than 120 s and was stopped'; child.kill(); }, 120_000);
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(stderr.trim().split('\n').slice(-4).join('\n'))); });
  });
}

// Copies a time range without re-encoding, so it is fast and lossless.
export async function trimMedia(src, { startSec, endSec }) {
  if (!(endSec > startSec) || startSec < 0) throw new Error('need 0 <= startSec < endSec');
  const bin = ffmpegBin();
  if (!bin) throw new Error('ffmpeg binary not found');
  const ext = path.extname(src).slice(1).toLowerCase() || 'mp4';
  const out = outputPath(src, `-trim-${startSec}-${endSec}`, ext);
  await assertNew(out);
  await run(bin, ['-hide_banner', '-loglevel', 'error', '-ss', String(startSec), '-to', String(endSec), '-i', src, '-c', 'copy', out]);
  return { output: out, bytes: (await fs.stat(out)).size };
}
