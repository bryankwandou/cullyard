// Seals a sorting run on Solana devnet: the SHA-256 of .cullyard/log.jsonl goes into
// a Memo transaction. Anyone holding the log can recompute the hash and compare it
// with the memo on-chain. The secret key is read from a file and never logged.
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import { appendLog } from './lanes.js';

export const MEMO_PROGRAM = new PublicKey('Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo');
export const DEVNET = 'https://api.devnet.solana.com';

export async function logDigest(root) {
  const file = path.join(root, '.cullyard', 'log.jsonl');
  const data = await fs.readFile(file).catch(() => Buffer.alloc(0));
  const lines = data.toString('utf8').split('\n').filter(Boolean).length;
  return { sha256: createHash('sha256').update(data).digest('hex'), entries: lines };
}

export function memoText({ sha256, entries }) {
  return `cullyard:v1 log=${sha256} entries=${entries}`;
}

export async function loadKeypair(file) {
  const raw = (await fs.readFile(file, 'utf8')).replace(/^﻿/, '').trim();
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

export async function sealRun(root, { keypairPath = process.env.CULLYARD_KEYPAIR, rpc = process.env.CULLYARD_RPC ?? DEVNET } = {}) {
  if (!keypairPath) throw new Error('set CULLYARD_KEYPAIR to a devnet keypair file to seal runs');
  const digest = await logDigest(root);
  if (digest.entries === 0) throw new Error('nothing to seal yet; sort some files first');
  const payer = await loadKeypair(keypairPath);
  const conn = new Connection(rpc, 'confirmed');
  const memo = memoText(digest);
  const tx = new Transaction().add(new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [], data: Buffer.from(memo, 'utf8') }));
  const signature = await sendAndConfirmTransaction(conn, tx, [payer]);
  const explorer = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
  await appendLog(root, { action: 'seal', signature, sealedSha256: digest.sha256 });
  return { signature, explorer, memo, signer: payer.publicKey.toBase58() };
}

// Recomputes the hash of the log as it stood at seal time (every line before the
// seal entry) and checks it against the memo stored on-chain.
export async function verifySeal(root, signature, { rpc = process.env.CULLYARD_RPC ?? DEVNET } = {}) {
  const file = path.join(root, '.cullyard', 'log.jsonl');
  const lines = (await fs.readFile(file, 'utf8')).split('\n').filter(Boolean);
  const idx = lines.findIndex((l) => JSON.parse(l).signature === signature);
  if (idx < 0) throw new Error('signature not found in this workspace log');
  const before = lines.slice(0, idx).map((l) => l + '\n').join('');
  const local = createHash('sha256').update(before).digest('hex');
  const conn = new Connection(rpc, 'confirmed');
  const tx = await conn.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
  if (!tx) throw new Error('transaction not found on chain');
  const memo = tx.transaction.message.instructions
    .filter((ix) => ix.programId.equals(MEMO_PROGRAM))
    .map((ix) => (typeof ix.parsed === 'string' ? ix.parsed : ''))
    .find((m) => m.startsWith('cullyard:v1')) ?? '';
  return { signature, localSha256: local, onChain: memo, match: memo.includes(`log=${local}`) };
}
