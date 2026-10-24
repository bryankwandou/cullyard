// Drives the real Cullyard MCP server the way an agent would, slowly enough to watch
// on the desk. Usage: CULLYARD_KEYPAIR=<devnet keypair file> node scripts/demo-agent.mjs <workspace> [delayMs]
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(process.argv[2] ?? 'demo-workspace');
const delay = Number(process.argv[3] ?? 1400);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(here, '..', 'bin', 'cullyard.js'), workspace], env: { ...process.env }, stderr: 'inherit' });
const client = new Client({ name: 'demo-agent', version: '0.1.0' });
await client.connect(transport);

const sheetOut = process.env.DEMO_SHEET_OUT;

async function call(name, args = {}) {
  const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 180_000 });
  // Image tools reply with [image, text]; log the image as a size and keep the JSON.
  const img = res.content.find((c) => c.type === 'image');
  if (img) {
    console.log(`\n> ${name} ${JSON.stringify(args)}\n[image ${img.mimeType}, ${Math.round(img.data.length * 0.75 / 1024)} KB]`);
    if (name === 'contact_sheet' && sheetOut) await fs.writeFile(sheetOut, Buffer.from(img.data, 'base64'));
  }
  const body = res.content.find((c) => c.type === 'text').text;
  console.log(`\n> ${name} ${JSON.stringify(args)}\n${res.isError ? 'ERROR ' : ''}${body.length > 600 ? body.slice(0, 600) + ' …' : body}`);
  if (res.isError) throw new Error(body);
  await wait(delay);
  return JSON.parse(body);
}

const holdOpen = Number(process.env.DEMO_HOLD_MS ?? 0);
await wait(delay * 2);
const { files } = await call('scan_workspace');
await call('create_lane', { name: 'Client docs' });

// Photos: measure, look at them side by side, then decide from what was measured.
const { photos } = await call('assess_photos');
await call('contact_sheet');
await call('preview_image', { file: photos[0].file, size: 512 });
const words = { soft: 'out of focus', dark: 'underexposed', bright: 'blown highlights' };
for (const p of photos) {
  const defects = p.flags.filter((f) => f !== 'duplicate');
  let lane; let reason;
  if (defects.length) { lane = 'Rejects'; reason = defects.map((f) => words[f]).join(', '); }
  else if (p.flags.includes('duplicate')) { lane = 'Rejects'; reason = `same burst as a sharper frame (${Math.round(p.relativeSharpness * 100)}% sharpness)`; }
  else if (p.rank <= 2) { lane = 'Picks'; reason = `rank ${p.rank}, ${Math.round(p.relativeSharpness * 100)}% sharpness, clean exposure`; }
  else { lane = 'Maybe'; reason = `clean but rank ${p.rank} of ${photos.length}`; }
  await call('move_to_lane', { file: p.file, lane, reason });
}

const plan = {
  'client-contract.pdf': ['Client docs', '3-page contract'], 'shot-list.csv': ['Client docs', 'shot list for the client'],
  'drone-pass.mp4': ['Picks', 'only video, trim below'], 'night-ferry.mp3': ['Maybe', 'music bed, not confirmed'],
};
for (const f of files) if (plan[f.name]) await call('move_to_lane', { file: f.name, lane: plan[f.name][0], reason: plan[f.name][1] });
const best = photos.find((p) => p.rank === 1).file;
await call('resize_image', { file: `Picks/${best}`, width: 1200, format: 'webp' });
await call('trim_media', { file: 'Picks/drone-pass.mp4', startSec: 1, endSec: 4 });
await call('log_digest');
if (process.env.CULLYARD_KEYPAIR) {
  const seal = await call('seal_run');
  await wait(4000);
  await call('verify_seal', { signature: seal.signature });
}
if (holdOpen) await wait(holdOpen);
await client.close();
