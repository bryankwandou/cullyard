import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, '..', 'bin', 'cullyard.js');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');

test('mcp: stdio server lists tools and sorts a file end to end', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cullyard-e2e-'));
  await fs.writeFile(path.join(root, 'shot.png'), PNG);

  const transport = new StdioClientTransport({ command: process.execPath, args: [bin, root, '--no-desk'], stderr: 'pipe' });
  const client = new Client({ name: 'cullyard-test', version: '0.0.0' });
  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    for (const n of ['scan_workspace', 'move_to_lane', 'create_lane', 'resize_image', 'trim_media']) {
      assert.ok(names.includes(n), `missing tool ${n}`);
    }

    const scan = await client.callTool({ name: 'scan_workspace', arguments: {} });
    const body = JSON.parse(scan.content[0].text);
    assert.equal(body.files[0].name, 'shot.png');
    assert.equal(body.files[0].kind, 'image');

    const preview = await client.callTool({ name: 'preview_image', arguments: { file: 'shot.png' } });
    assert.equal(preview.isError, undefined);
    assert.equal(preview.content[0].type, 'image');
    assert.equal(preview.content[0].mimeType, 'image/jpeg');
    assert.ok(Buffer.from(preview.content[0].data, 'base64').length > 100);
    assert.ok('subjectSharpness' in JSON.parse(preview.content[1].text));

    const sheet = await client.callTool({ name: 'contact_sheet', arguments: {} });
    assert.equal(sheet.content[0].type, 'image');
    assert.deepEqual(JSON.parse(sheet.content[1].text).legend, [{ n: 1, file: 'shot.png' }]);

    const moved = await client.callTool({ name: 'move_to_lane', arguments: { file: 'shot.png', lane: 'Picks', reason: 'only frame' } });
    assert.equal(moved.isError, undefined);
    assert.equal(JSON.parse(moved.content[0].text).lane, 'Picks');
    assert.equal(JSON.parse(moved.content[0].text).reason, 'only frame');

    const assessed = await client.callTool({ name: 'assess_photos', arguments: { lane: 'Picks' } });
    assert.equal(JSON.parse(assessed.content[0].text).photos[0].file, 'Picks/shot.png');

    const bad = await client.callTool({ name: 'move_to_lane', arguments: { file: 'shot.png', lane: 'Ghost' } });
    assert.equal(bad.isError, true);
  } finally {
    await client.close();
  }
});
