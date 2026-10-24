import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { measurePhoto, assessPhotos, contactSheet, loadQuality, hamming, sameBurst } from '../src/look.js';

// A seeded photo stand-in: large soft shapes (so each seed has its own layout) plus
// fine grain (so focus can be measured).
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
async function scene(seed, w = 600, h = 400) {
  const r = rng(seed);
  const blobs = Buffer.alloc(8 * 6 * 3);
  for (let i = 0; i < blobs.length; i++) blobs[i] = 40 + Math.floor(r() * 170);
  const base = await sharp(blobs, { raw: { width: 8, height: 6, channels: 3 } }).resize(w, h, { kernel: 'cubic' }).raw().toBuffer();
  for (let i = 0; i < base.length; i++) base[i] = Math.max(0, Math.min(255, base[i] + Math.floor((r() - 0.5) * 70)));
  return sharp(base, { raw: { width: w, height: h, channels: 3 } });
}

async function workspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'cullyard-look-'));
}

test('look: blur lowers measured sharpness, a dark frame reads dark', async () => {
  const ws = await workspace();
  await (await scene(1)).jpeg({ quality: 92 }).toFile(path.join(ws, 'sharp.jpg'));
  await (await scene(1)).blur(5).jpeg({ quality: 92 }).toFile(path.join(ws, 'blurred.jpg'));
  await (await scene(1)).linear(0.15, 0).jpeg({ quality: 92 }).toFile(path.join(ws, 'dark.jpg'));
  const a = await measurePhoto(path.join(ws, 'sharp.jpg'));
  const b = await measurePhoto(path.join(ws, 'blurred.jpg'));
  const d = await measurePhoto(path.join(ws, 'dark.jpg'));
  assert.ok(a.subjectSharpness > b.subjectSharpness * 5, `${a.subjectSharpness} vs ${b.subjectSharpness}`);
  assert.ok(d.exposure.mean < 50, `dark mean ${d.exposure.mean}`);
  assert.ok(a.exposure.mean > 80 && a.exposure.mean < 180);
});

test('look: a sharp subject on a blurred background still measures sharp', async () => {
  const ws = await workspace();
  const bg = await (await scene(2)).blur(8).png().toBuffer();
  const subject = await (await scene(3, 150, 100)).png().toBuffer();
  await sharp(bg).composite([{ input: subject, left: 225, top: 150 }]).jpeg({ quality: 92 }).toFile(path.join(ws, 'portrait.jpg'));
  await (await scene(2)).blur(8).jpeg({ quality: 92 }).toFile(path.join(ws, 'missed.jpg'));
  const portrait = await measurePhoto(path.join(ws, 'portrait.jpg'));
  const missed = await measurePhoto(path.join(ws, 'missed.jpg'));
  assert.ok(portrait.subjectSharpness > missed.subjectSharpness * 5, `${portrait.subjectSharpness} vs ${missed.subjectSharpness}`);
  // The whole-frame number alone would understate the portrait; the tile peak does not.
  assert.ok(portrait.subjectSharpness > portrait.sharpness * 2);
});

test('look: assess flags soft and dark frames, groups a burst and keeps its sharpest frame', async () => {
  const ws = await workspace();
  await (await scene(10)).jpeg({ quality: 92 }).toFile(path.join(ws, 'a.jpg'));
  await (await scene(11)).jpeg({ quality: 92 }).toFile(path.join(ws, 'b.jpg'));
  await (await scene(12)).jpeg({ quality: 92 }).toFile(path.join(ws, 'burst-1.jpg'));
  await (await scene(12)).blur(1.2).jpeg({ quality: 92 }).toFile(path.join(ws, 'burst-2.jpg'));
  await (await scene(13)).blur(6).jpeg({ quality: 92 }).toFile(path.join(ws, 'soft.jpg'));
  await (await scene(14)).linear(0.12, 0).jpeg({ quality: 92 }).toFile(path.join(ws, 'dark.jpg'));
  await fs.writeFile(path.join(ws, 'notes.txt'), 'not a photo');

  const files = ['a.jpg', 'b.jpg', 'burst-1.jpg', 'burst-2.jpg', 'soft.jpg', 'dark.jpg', 'notes.txt'];
  const res = await assessPhotos(ws, files);
  const by = Object.fromEntries(res.photos.map((p) => [p.file, p]));
  assert.equal(res.measured, 6, 'the text file is skipped');
  assert.ok(by['soft.jpg'].flags.includes('soft'));
  assert.ok(by['dark.jpg'].flags.includes('dark'));
  assert.ok(!by['dark.jpg'].flags.includes('soft'), 'an underexposed but focused frame is not soft');
  assert.ok(!by['a.jpg'].flags.includes('soft'));
  assert.ok(by['burst-1.jpg'].similarGroup, 'burst frames are grouped');
  assert.equal(by['burst-1.jpg'].similarGroup, by['burst-2.jpg'].similarGroup);
  assert.equal(by['burst-1.jpg'].bestInGroup, true);
  assert.ok(by['burst-2.jpg'].flags.includes('duplicate'));
  assert.ok(!by['a.jpg'].similarGroup, 'different scenes are not grouped');
  assert.ok(hamming(by['a.jpg'].hash, by['b.jpg'].hash) > 10);
  assert.equal(res.photos[0].rank, 1);
  assert.deepEqual(res.photos[0].flags, [], 'rank 1 is a clean frame');
  assert.equal(res.photos[0].relativeSharpness, 1, 'the sharpest well-exposed frame sets 100%');
  assert.ok(by['dark.jpg'].relativeSharpness <= 1);

  const saved = await loadQuality(ws);
  assert.deepEqual(saved['soft.jpg'].flags, by['soft.jpg'].flags);
  const log = await fs.readFile(path.join(ws, '.cullyard', 'log.jsonl'), 'utf8');
  assert.match(log, /"action":"assess","count":6/);
  await assert.rejects(assessPhotos(ws, ['../escape.jpg']), /outside the workspace/);
});

test('look: same framing in different light is not a burst', async () => {
  const ws = await workspace();
  await (await scene(20)).jpeg({ quality: 92 }).toFile(path.join(ws, 'golden.jpg'));
  await (await scene(20)).tint('#3060c0').jpeg({ quality: 92 }).toFile(path.join(ws, 'blue.jpg'));
  await (await scene(20)).blur(0.8).jpeg({ quality: 92 }).toFile(path.join(ws, 'golden-2.jpg'));
  const g = await measurePhoto(path.join(ws, 'golden.jpg'));
  const b = await measurePhoto(path.join(ws, 'blue.jpg'));
  const g2 = await measurePhoto(path.join(ws, 'golden-2.jpg'));
  assert.ok(hamming(g.hash, b.hash) <= 8, 'structure alone says burst');
  assert.equal(sameBurst(g, b), false);
  assert.equal(sameBurst(g, g2), true);
});

test('look: contact sheet numbers each frame and caps at 16', async () => {
  const ws = await workspace();
  const names = [];
  for (let i = 0; i < 18; i++) {
    const n = `f${String(i).padStart(2, '0')}.jpg`;
    await (await scene(100 + i, 120, 80)).jpeg().toFile(path.join(ws, n));
    names.push(n);
  }
  const sheet = await contactSheet(ws, names);
  assert.equal(sheet.legend.length, 16);
  assert.equal(sheet.skipped, 2);
  assert.deepEqual(sheet.legend[0], { n: 1, file: 'f00.jpg' });
  const meta = await sharp(Buffer.from(sheet.data, 'base64')).metadata();
  assert.equal(meta.format, 'jpeg');
  assert.equal(meta.width, 4 * 256);
  assert.equal(meta.height, 4 * (192 + 26));
});
