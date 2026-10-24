// Drives the real Cullyard MCP server the way an agent would, slowly enough to watch
// on the desk. Usage: CULLYARD_KEYPAIR=<devnet keypair file> node scripts/demo-agent.mjs <workspace> [delayMs]
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

async function call(name, args = {}) {
  const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 180_000 });
  const body = res.content[0].text;
  console.log(`\n> ${name} ${JSON.stringify(args)}\n${res.isError ? 'ERROR ' : ''}${body.length > 600 ? body.slice(0, 600) + ' …' : body}`);
  if (res.isError) throw new Error(body);
  await wait(delay);
  return JSON.parse(body);
}

const holdOpen = Number(process.env.DEMO_HOLD_MS ?? 0);
await wait(delay * 2);
const { files } = await call('scan_workspace');
await call('create_lane', { name: 'Client docs' });
const plan = {
  'IMG_2041.jpg': 'Picks', 'IMG_2044.jpg': 'Picks', 'IMG_2045.jpg': 'Maybe', 'IMG_2042.jpg': 'Maybe',
  'IMG_2043.jpg': 'Rejects', 'IMG_2046.jpg': 'Rejects', 'client-contract.pdf': 'Client docs', 'shot-list.csv': 'Client docs',
  'drone-pass.mp4': 'Picks', 'night-ferry.mp3': 'Maybe',
};
for (const f of files) if (plan[f.name]) await call('move_to_lane', { file: f.name, lane: plan[f.name] });
await call('resize_image', { file: 'Picks/IMG_2041.jpg', width: 1200, format: 'webp' });
await call('trim_media', { file: 'Picks/drone-pass.mp4', startSec: 1, endSec: 4 });
await call('log_digest');
if (process.env.CULLYARD_KEYPAIR) {
  const seal = await call('seal_run');
  await wait(4000);
  await call('verify_seal', { signature: seal.signature });
}
if (holdOpen) await wait(holdOpen);
await client.close();
