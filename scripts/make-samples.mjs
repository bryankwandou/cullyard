// Creates a small mixed media folder for demos: photos, a video, a song, a PDF, docs.
// Usage: node scripts/make-samples.mjs <folder>
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import ffmpeg from 'ffmpeg-static';

const dir = path.resolve(process.argv[2] ?? 'demo-workspace');
await fs.mkdir(dir, { recursive: true });

const shots = [
  ['IMG_2041.jpg', '#c9773a', '#2b3a55', 'Harbor, golden hour'], ['IMG_2042.jpg', '#6b8f71', '#1f2a24', 'Ridge trail'],
  ['IMG_2043.jpg', '#3a3f47', '#121417', 'Underexposed'], ['IMG_2044.jpg', '#d9a441', '#5a2e1d', 'Market stall'],
  ['IMG_2045.jpg', '#8ab6d6', '#334a63', 'Blue hour pier'], ['IMG_2046.jpg', '#b9b2a6', '#4f4a44', 'Blurry, motion'],
];
for (const [name, a, b, label] of shots) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1067"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="1150" cy="380" r="170" fill="#fff" opacity=".18"/><path d="M0 820 L420 560 L760 760 L1100 520 L1600 800 L1600 1067 L0 1067Z" fill="#000" opacity=".28"/><text x="64" y="990" font-family="Segoe UI, Arial" font-size="54" fill="#fff" opacity=".85">${label}</text></svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(path.join(dir, name));
}

const run = (args) => { const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args]); if (r.status) throw new Error(String(r.stderr)); };
run(['-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=8', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=8', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', path.join(dir, 'drone-pass.mp4')]);
run(['-f', 'lavfi', '-i', 'sine=frequency=220:duration=12', '-metadata', 'title=Night Ferry', '-metadata', 'artist=Studio Demo', '-c:a', 'libmp3lame', '-b:a', '160k', path.join(dir, 'night-ferry.mp3')]);

const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
for (let i = 1; i <= 3; i++) {
  const page = pdf.addPage([595, 842]);
  page.drawText(`Client contract, page ${i}`, { x: 56, y: 770, size: 22, font, color: rgb(0.1, 0.1, 0.12) });
}
await fs.writeFile(path.join(dir, 'client-contract.pdf'), await pdf.save());
await fs.writeFile(path.join(dir, 'shot-list.csv'), 'scene,take,keep\n1,3,yes\n2,1,no\n3,2,yes\n');
await fs.writeFile(path.join(dir, 'notes.md'), '# Shoot notes\n\nKeep the harbor frames. The pier set is a maybe.\n');
console.log(`samples written to ${dir}`);
