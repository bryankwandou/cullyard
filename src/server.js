// MCP server: exposes the workspace to Claude Code, Antigravity, or any MCP client.
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { scanFolder, describeFile } from './scan.js';
import { loadState, createLane, moveToLane } from './lanes.js';
import { resizeImage, trimMedia } from './edit.js';
import { KINDS } from './kinds.js';
import { sealRun, verifySeal, logDigest } from './seal.js';
import { assessPhotos, contactSheet, previewImage, measurePhoto } from './look.js';

const text = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });
const fail = (err) => ({ isError: true, content: [{ type: 'text', text: err.message }] });

export function createServer({ workspace }) {
  const root = path.resolve(workspace);
  const server = new McpServer({ name: 'cullyard', version: '0.2.0' });

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

  tool('move_to_lane', 'Move a file into a lane folder. Never overwrites. Give a short reason; the desk shows it to the person watching.', {
    file: z.string(),
    lane: z.string(),
    reason: z.string().max(160).optional().describe('why this file goes here, e.g. "sharpest of the burst" or "eyes closed"'),
  }, async ({ file, lane, reason }) => moveToLane(root, file, lane, reason));

  // Which files a looking tool works on: an explicit list, or every image in one lane
  // (or the inbox when no lane is given).
  async function chooseImages({ files, lane }) {
    if (files?.length) return files;
    const dir = path.resolve(root, lane ?? '.');
    if (dir !== root && !dir.startsWith(root + path.sep)) throw new Error('lane is outside the workspace');
    const listed = await scanFolder(dir, { meta: false });
    return listed.filter((f) => f.kind === 'image' || f.kind === 'raw').map((f) => (lane ? `${lane}/${f.name}` : f.name));
  }
  const pickSchema = {
    files: z.array(z.string()).optional().describe('paths relative to the workspace'),
    lane: z.string().optional().describe('use every image in this lane; omit both to use the inbox'),
  };
  const image = (data, extra) => ({ content: [{ type: 'image', data, mimeType: 'image/jpeg' }, { type: 'text', text: JSON.stringify(extra, null, 2) }] });

  tool('assess_photos', 'Measure sharpness (per region, so a sharp subject on a blurred background still scores well), exposure and clipping for each photo, find near-duplicate bursts and mark the sharpest frame of each, and rank the set. Flags are relative to the set: soft, dark, bright, duplicate. Treat them as evidence, then look with contact_sheet or preview_image before rejecting a photo.', pickSchema,
    async (args) => assessPhotos(root, await chooseImages(args)));

  server.registerTool('contact_sheet', {
    description: 'Return up to 16 photos as one numbered grid image you can look at, with a legend mapping numbers to files. Use it to compare a set: composition, faces, closed eyes, missed focus.',
    inputSchema: { ...pickSchema, offset: z.number().int().min(0).default(0).describe('skip this many photos, to page through a large set') },
  }, async ({ files, lane, offset }) => {
    try {
      const all = await chooseImages({ files, lane });
      const sheet = await contactSheet(root, all.slice(offset));
      return image(sheet.data, { legend: sheet.legend, total: all.length, nextOffset: offset + sheet.legend.length < all.length ? offset + sheet.legend.length : null });
    } catch (err) {
      return fail(err);
    }
  });

  server.registerTool('preview_image', {
    description: 'Return one photo as an image you can look at (up to 1024 px), with its measured quality. Use it to check focus on the eyes, expression or detail before deciding.',
    inputSchema: { file: z.string(), size: z.number().int().min(128).max(1024).default(768) },
  }, async ({ file, size }) => {
    try {
      const abs = path.resolve(root, file);
      if (!abs.startsWith(root + path.sep)) throw new Error('file is outside the workspace');
      const [data, quality] = await Promise.all([previewImage(abs, size), measurePhoto(abs)]);
      return image(data, { file, ...quality });
    } catch (err) {
      return fail(err);
    }
  });

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
