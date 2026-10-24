// MCP server: exposes the workspace to Claude Code, Antigravity, or any MCP client.
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { scanFolder, describeFile } from './scan.js';
import { loadState, createLane, moveToLane } from './lanes.js';
import { resizeImage, trimMedia } from './edit.js';
import { KINDS } from './kinds.js';
import { sealRun, verifySeal, logDigest } from './seal.js';

const text = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });
const fail = (err) => ({ isError: true, content: [{ type: 'text', text: err.message }] });

export function createServer({ workspace }) {
  const root = path.resolve(workspace);
  const server = new McpServer({ name: 'cullyard', version: '0.1.0' });

  const tool = (name, description, inputSchema, handler) =>
    server.registerTool(name, { description, inputSchema }, async (args) => {
      try {
        return text(await handler(args));
      } catch (err) {
        return fail(err);
      }
    });

  tool('scan_workspace', 'List every file in the workspace with its kind, size and metadata.', {}, async () => ({
    workspace: root,
    files: await scanFolder(root),
  }));

  tool('describe_file', 'Return kind and metadata for one file in the workspace.', {
    file: z.string().describe('path relative to the workspace'),
  }, async ({ file }) => {
    const abs = path.resolve(root, file);
    if (!abs.startsWith(root + path.sep)) throw new Error('file is outside the workspace');
    return describeFile(abs, path.basename(abs));
  });

  tool('list_lanes', 'Return the lanes and which file sits in which lane.', {}, async () => {
    const state = await loadState(root);
    return { lanes: state.lanes, assignments: state.assignments };
  });

  tool('create_lane', 'Create a custom lane, for example "Hero shots" or "Final cut".', {
    name: z.string().min(1).max(40),
  }, async ({ name }) => ({ lanes: await createLane(root, name) }));

  tool('move_to_lane', 'Move a file into a lane folder. Never overwrites.', {
    file: z.string(),
    lane: z.string(),
  }, async ({ file, lane }) => moveToLane(root, file, lane));

  tool('resize_image', 'Write a resized copy of an image next to the original.', {
    file: z.string(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    format: z.enum(['webp', 'jpg', 'png', 'avif']).default('webp'),
  }, async ({ file, width, height, format }) => {
    const abs = path.resolve(root, file);
    return resizeImage(abs, { width, height, format });
  });

  tool('trim_media', 'Cut a time range out of a video or audio file without re-encoding.', {
    file: z.string(),
    startSec: z.number().min(0),
    endSec: z.number().positive(),
  }, async ({ file, startSec, endSec }) => trimMedia(path.resolve(root, file), { startSec, endSec }));

  tool('seal_run', 'Write the SHA-256 of the sorting log into a Solana devnet memo, as proof of what was sorted and when.', {}, async () => sealRun(root));

  tool('verify_seal', 'Recompute the log hash at seal time and compare it with the memo on Solana devnet.', {
    signature: z.string().min(32),
  }, async ({ signature }) => verifySeal(root, signature));

  tool('log_digest', 'Show the current SHA-256 and entry count of the sorting log, without sending anything.', {}, async () => logDigest(root));

  tool('list_kinds', 'List the file kinds Cullyard recognises.', {}, async () => ({ kinds: KINDS }));

  return { server, root };
}
