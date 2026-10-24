import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { kindOf, extOf } from '../src/kinds.js';
import { scanFolder } from '../src/scan.js';
import { loadState, createLane, moveToLane, safeLaneName } from '../src/lanes.js';
import { resizeImage, outputPath } from '../src/edit.js';

async function tmpWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'cullyard-test-'));
}

// 1x1 PNG, enough for sharp and for the scanner.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');

test('kinds: maps known extensions and falls back to other', () => {
  assert.equal(kindOf('IMG_0001.JPG'), 'image');
  assert.equal(kindOf('take.cr3'), 'raw');
  assert.equal(kindOf('clip.mp4'), 'video');
  assert.equal(kindOf('song.flac'), 'audio');
  assert.equal(kindOf('brief.pdf'), 'pdf');
  assert.equal(kindOf('mystery.xyz'), 'other');
  assert.equal(kindOf('noextension'), 'other');
  assert.equal(extOf('a.b.TXT'), 'txt');
});

test('scan: describes images and keeps unknown files', async () => {
  const root = await tmpWorkspace();
  await fs.writeFile(path.join(root, 'pic.png'), PNG);
  await fs.writeFile(path.join(root, 'notes.bin'), 'hello');
  await fs.writeFile(path.join(root, '.hidden'), 'x');
  const files = await scanFolder(root);
  assert.deepEqual(files.map((f) => f.name), ['notes.bin', 'pic.png']);
  const pic = files.find((f) => f.name === 'pic.png');
  assert.equal(pic.kind, 'image');
  assert.equal(pic.width, 1);
  assert.equal(pic.height, 1);
});

test('scan: a corrupt file is still listed, with a metaError', async () => {
  const root = await tmpWorkspace();
  await fs.writeFile(path.join(root, 'broken.pdf'), 'not really a pdf');
  const [f] = await scanFolder(root);
  assert.equal(f.kind, 'pdf');
  assert.ok(f.metaError);
});

test('lanes: default state, create custom lane, reject bad names', async () => {
  const root = await tmpWorkspace();
  assert.deepEqual((await loadState(root)).lanes, ['Picks', 'Maybe', 'Rejects']);
  const lanes = await createLane(root, 'Hero shots');
  assert.ok(lanes.includes('Hero shots'));
  assert.throws(() => safeLaneName('../escape'));
  assert.throws(() => safeLaneName('   '));
});

test('move: sorts a file into a lane, records it, never overwrites', async () => {
  const root = await tmpWorkspace();
  await fs.writeFile(path.join(root, 'pic.png'), PNG);
  const moved = await moveToLane(root, 'pic.png', 'Picks');
  assert.equal(moved.to, path.join('Picks', 'pic.png'));
  assert.equal((await loadState(root)).assignments[moved.to], 'Picks');
  await fs.writeFile(path.join(root, 'pic.png'), PNG);
  await assert.rejects(moveToLane(root, 'pic.png', 'Picks'), /already exists/);
});

test('move: refuses unknown lanes and paths outside the workspace', async () => {
  const root = await tmpWorkspace();
  await fs.writeFile(path.join(root, 'a.txt'), 'a');
  await assert.rejects(moveToLane(root, 'a.txt', 'Nope'), /unknown lane/);
  await assert.rejects(moveToLane(root, '../outside.txt', 'Picks'), /outside the workspace/);
});

test('edit: resize writes a new webp and keeps the original untouched', async () => {
  const root = await tmpWorkspace();
  const src = path.join(root, 'pic.png');
  await fs.writeFile(src, PNG);
  const out = await resizeImage(src, { width: 1, format: 'webp' });
  assert.equal(out.output, outputPath(src, '-1xauto', 'webp'));
  assert.equal(out.width, 1);
  assert.deepEqual(await fs.readFile(src), PNG);
  await assert.rejects(resizeImage(src, { width: 1, format: 'webp' }), /already exists/);
});

test('scan: video files report duration, codec and frame size', async () => {
  const { spawnSync } = await import('node:child_process');
  const ffmpeg = (await import('ffmpeg-static')).default;
  const ws = await tmpWorkspace();
  const clip = path.join(ws, 'clip.mp4');
  const r = spawnSync(ffmpeg, ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=10:duration=2', '-pix_fmt', 'yuv420p', clip], { windowsHide: true });
  assert.equal(r.status, 0, String(r.stderr));
  const [file] = await scanFolder(ws);
  assert.equal(file.kind, 'video');
  assert.equal(file.codec, 'h264');
  assert.equal(file.width, 320);
  assert.equal(file.height, 240);
  assert.ok(Math.abs(file.durationSec - 2) < 0.3, `duration ${file.durationSec}`);
});
