#!/usr/bin/env node
// A small staging pass. Same harness, ten players. Refuses production.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const url = process.env.STAGING_SUPABASE_URL || '';
if (!url || url.includes('wqdrbywcktxgytkyqcco')) {
  console.error('Set STAGING_SUPABASE_URL to a non-production project. This script will not touch the live bar.');
  process.exit(2);
}
const script = fileURLToPath(new URL('./pub-brawl.mjs', import.meta.url));
const child = spawn(process.execPath, [script, '--players', '10', '--url', url], { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 1));
