#!/usr/bin/env node
/**
 * Runs a repo Python script with whichever interpreter this machine has.
 * The art PC is Windows, where Python is `python` or `py -3` and `python3`
 * does not exist; Linux and macOS have `python3`.
 *
 *   node scripts/run-python.mjs scripts/generate-card-art-fooocus.py --self-test
 */
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const CANDIDATES = [['python3'], ['python'], ['py', '-3']];
const works = ([bin, ...pre]) =>
  spawnSync(bin, [...pre, '-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)'], {
    stdio: 'ignore',
  }).status === 0;

const found = CANDIDATES.find(works);
if (!found) {
  console.error('No Python 3.9+ found (tried python3, python, py -3).');
  process.exit(127);
}
const [bin, ...pre] = found;
const run = spawnSync(bin, [...pre, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(run.status ?? 1);
