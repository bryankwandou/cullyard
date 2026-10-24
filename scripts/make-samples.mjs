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

// The defects are real, not just labels: assess_photos should find them by measuring.
// [name, colour a, colour b, label, seed, blur sigma, brightness]
const shots = [
  ['IMG_2041.jpg', '#c9773a', '#2b3a55', 'Harbor, golden hour', 1, 0, 1], ['IMG_2042.jpg', '#6b8f71', '#1f2a24', 'Ridge trail', 2, 0, 1.1],
  ['IMG_2043.jpg', '#3a3f47', '#121417', 'Underexposed', 3, 0, 0.35], ['IMG_2044.jpg', '#d9a441', '#5a2e1d', 'Market stall', 4, 0, 1],
  ['IMG_2045.jpg', '#8ab6d6', '#334a63', 'Blue hour pier', 5, 0, 1], ['IMG_2046.jpg', '#b9b2a6', '#4f4a44', 'Blurry, motion', 6, 7, 1],
  ['IMG_2047.jpg', '#c9773a', '#2b3a55', 'Harbor, golden hour', 1, 1.6, 1],
];
const W = 1600; const H = 1067;
for (const [name, a, b, label, seed, sigma, gain] of shots) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="1150" cy="380" r="170" fill="#fff" opacity=".18"/><path d="M0 820 L420 560 L760 760 L1100 520 L1600 800 L1600 1067 L0 1067Z" fill="#000" opacity=".28"/><text x="64" y="990" font-family="Segoe UI, Arial" font-size="54" fill="#fff" opacity=".85">${label}</text></svg>`;
  // Fine seeded grain stands in for real scene detail, so focus can be measured.
  const px = await sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer();
  let s = seed;
  for (let i = 0; i < px.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    px[i] = Math.max(0, Math.min(255, Math.round((px[i] + ((s / 2 ** 32) - 0.5) * 60) * gain)));
  }
  let img = sharp(px, { raw: { width: W, height: H, channels: 3 } });
  if (sigma) img = img.blur(sigma);
  await img.jpeg({ quality: 88 }).toFile(path.join(dir, name));
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
