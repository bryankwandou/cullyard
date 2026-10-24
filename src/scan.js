// Reads a folder and describes each file. Metadata is best-effort: a broken file
// still shows up in the desk with its kind and size, it is never dropped.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { kindOf, extOf } from './kinds.js';

const require = createRequire(import.meta.url);

// Duration, codec and frame size from the bundled ffprobe.
function probeVideo(absPath) {
  const bin = require('ffprobe-static').path;
  const args = ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'format=duration:stream=codec_name,width,height', '-of', 'json', absPath];
  return new Promise((resolve, reject) => {
    execFile(bin, args, { windowsHide: true, timeout: 60_000 }, (err, stdout) => {
      if (err) return reject(err);
      const j = JSON.parse(stdout);
      const s = j.streams?.[0] ?? {};
      resolve({ durationSec: Math.round(Number(j.format?.duration ?? 0) * 10) / 10, codec: s.codec_name ?? null, width: s.width ?? null, height: s.height ?? null });
    });
  });
}

export async function describeFile(absPath, name, { meta = true } = {}) {
  const st = await fs.stat(absPath);
  const kind = kindOf(name);
  const info = { name, kind, ext: extOf(name), bytes: st.size, modified: st.mtime.toISOString() };
  if (!meta) return info;
  try {
    if (kind === 'image' || kind === 'raw') {
      const sharp = (await import('sharp')).default;
      const meta = await sharp(absPath, { failOn: 'none' }).metadata();
      info.width = meta.width;
      info.height = meta.height;
      info.format = meta.format;
    } else if (kind === 'audio') {
      const { parseFile } = await import('music-metadata');
      const meta = await parseFile(absPath, { duration: true, skipCovers: true });
      info.durationSec = Math.round(meta.format.duration ?? 0);
      info.title = meta.common.title ?? null;
      info.artist = meta.common.artist ?? null;
    } else if (kind === 'video') {
      Object.assign(info, await probeVideo(absPath));
    } else if (kind === 'pdf') {
      const { PDFDocument } = await import('pdf-lib');
      const doc = await PDFDocument.load(await fs.readFile(absPath), { ignoreEncryption: true });
      info.pages = doc.getPageCount();
    }
  } catch (err) {
    info.metaError = err.message.split('\n')[0];
  }
  return info;
}

// Lists the files at the top level of one folder. Pass { meta: false } for a quick
// listing without opening each file.
export async function scanFolder(root, opts = {}) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];
  for (const ent of entries) {
    if (!ent.isFile() || ent.name.startsWith('.')) continue;
    files.push(await describeFile(path.join(root, ent.name), ent.name, opts));
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}
