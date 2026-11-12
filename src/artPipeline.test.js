// @vitest-environment node
/**
 * Art pipeline guards.
 *
 * Mark's call (Nov 2026): every image goes through Fooocus on his own GPU, and
 * nothing in the game depends on a hosted generator (the Fal service or similar). These tests
 * keep it that way: the shipped code, scripts, functions and package manifests
 * must not reference one, and the local Fooocus generator must pass its own
 * end-to-end self-test against a mock Fooocus-API.
 *
 * docs/ and art/renders/ are left out on purpose: they hold the provenance of
 * plates made before the switch, which is history, not a dependency.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Built from parts so this file does not match itself.
const HOSTED = new RegExp(
  ['fal' + '\\.ai', 'fal' + '\\.run', 'fal' + '\\.media', '@fal' + '-ai', 'fal' + '-ai/', 'fal' + '_client',
    'FAL' + '_KEY', 'FAL' + '_API', 'nano' + '-?banana', 'replicate' + '\\.com', 'api\\.' + 'stability\\.ai'].join('|'),
  'i',
);

const tracked = () => {
  try {
    return execFileSync('git', ['ls-files', '-z', 'src', 'scripts', 'supabase', 'public/*.json', 'package.json',
      'package-lock.json', 'vite.config.js', 'vercel.json', '.env.example'], { cwd: ROOT, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean);
  } catch {
    return [];
  }
};

describe('art pipeline', () => {
  it('ships no hosted image-generation service', () => {
    const files = tracked().filter((file) => /\.(m?[jt]sx?|py|json|sql|sh|toml|ya?ml|example)$/.test(file));
    expect(files.length).toBeGreaterThan(50);
    const hits = [];
    for (const file of files) {
      const path = join(ROOT, file);
      if (!existsSync(path)) continue;
      readFileSync(path, 'utf8').split('\n').forEach((line, index) => {
        if (HOSTED.test(line)) hits.push(`${file}:${index + 1}: ${line.trim().slice(0, 120)}`);
      });
    }
    expect(hits).toEqual([]);
  });

  const python = ['python3', 'python'].find(
    (bin) => spawnSync(bin, ['-c', 'import requests'], { stdio: 'ignore' }).status === 0,
  );

  it.skipIf(!python)('local Fooocus generator passes its end-to-end self-test', () => {
    const run = spawnSync(python, [join(ROOT, 'scripts/generate-card-art-fooocus.py'), '--self-test'], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 60_000,
    });
    expect(run.stderr).not.toMatch(/FAIL/);
    expect(run.stdout).toContain('self-test ok');
    expect(run.status).toBe(0);
  }, 70_000);
});
