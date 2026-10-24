#!/usr/bin/env node
// Usage: cullyard [workspace-folder] [--no-desk]
// Speaks MCP over stdio and opens the desk on http://127.0.0.1:4870.
// Logs go to stderr so they never corrupt the protocol stream.
import process from 'node:process';
import { promises as fs } from 'node:fs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from '../src/server.js';
import { startDesk } from '../src/desk-server.js';

const args = process.argv.slice(2);
const workspace = args.find((a) => !a.startsWith('--')) ?? process.cwd();
const { server, root } = createServer({ workspace });
await fs.mkdir(root, { recursive: true });
await server.connect(new StdioServerTransport());
console.error(`cullyard: workspace ${root}`);

if (!args.includes('--no-desk')) {
  const desk = await startDesk({ root });
  if (desk) console.error(`cullyard: desk on http://127.0.0.1:${desk.address().port}`);
}
