import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createDesk } from '../src/desk-server.js';
import { logDigest, memoText } from '../src/seal.js';

async function withDesk(fn) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cullyard-desk-'));
  const desk = createDesk({ root });
  await new Promise((r) => desk.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${desk.address().port}`;
  try { await fn({ root, base }); } finally { desk.close(); }
}

test('desk: serves the UI', async () => {
  await withDesk(async ({ base }) => {
    const res = await fetch(base + '/');
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Cullyard Desk/);
  });
});

test('desk: upload, no overwrite, move, state, log', async () => {
  await withDesk(async ({ root, base }) => {
    let res = await fetch(`${base}/api/upload?name=song.mp3`, { method: 'POST', body: 'abc' });
    assert.equal(res.status, 201);
    res = await fetch(`${base}/api/upload?name=song.mp3`, { method: 'POST', body: 'def' });
    assert.equal((await res.json()).name, 'song (2).mp3');
    assert.equal(await fs.readFile(path.join(root, 'song.mp3'), 'utf8'), 'abc');

    res = await fetch(`${base}/api/move`, { method: 'POST', body: JSON.stringify({ file: 'song.mp3', lane: 'Maybe' }) });
    assert.equal(res.status, 200);
    const state = await (await fetch(`${base}/api/state`)).json();
    assert.deepEqual(state.inbox.map((f) => f.name), ['song (2).mp3']);
    assert.equal(state.lanes.Maybe[0].name, 'song.mp3');
    assert.equal(state.log[0].action, 'move');
  });
});

test('desk: refuses path traversal, hidden names and cross-origin writes', async () => {
  await withDesk(async ({ base }) => {
    assert.equal((await fetch(`${base}/api/file?path=../../etc/hosts`)).status, 403);
    assert.equal((await fetch(`${base}/api/upload?name=.env`, { method: 'POST', body: 'x' })).status, 400);
    const res = await fetch(`${base}/api/lane`, { method: 'POST', headers: { origin: 'https://evil.example' }, body: '{"name":"x"}' });
    assert.equal(res.status, 403);
  });
});

test('seal: digest matches a plain sha256 of the log and the memo format is stable', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cullyard-seal-'));
  assert.equal((await logDigest(root)).entries, 0);
  await fs.mkdir(path.join(root, '.cullyard'));
  const log = '{"action":"move"}\n{"action":"move"}\n';
  await fs.writeFile(path.join(root, '.cullyard', 'log.jsonl'), log);
  const d = await logDigest(root);
  assert.equal(d.sha256, createHash('sha256').update(log).digest('hex'));
  assert.equal(d.entries, 2);
  assert.equal(memoText(d), `cullyard:v1 log=${d.sha256} entries=2`);
});
