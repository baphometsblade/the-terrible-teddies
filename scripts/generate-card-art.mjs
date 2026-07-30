/**
 * Card-art generator: renders every card's illustration through a
 * self-hosted Stable Diffusion endpoint (Fooocus via Fooocus-API, or any
 * AUTOMATIC1111-compatible /sdapi server) and writes CSP-safe static
 * assets to public/cards/<id>.webp — the ArtOrEmoji slot picks them up
 * with zero code changes.
 *
 * Run with vite-node so the store's `@/` aliases resolve and ALL_CARDS
 * stays the single source of truth:
 *
 *   FOOOCUS_URL=https://<your-tunnel-or-lan-host> npm run art:generate
 *
 * The endpoint must be reachable FROM THIS MACHINE. A Fooocus instance on
 * your own box needs a tunnel (e.g. `cloudflared tunnel --url http://127.0.0.1:8888`
 * against Fooocus-API, or ngrok) unless you run this repo on the same LAN.
 *
 * Env:
 *   FOOOCUS_URL     required. Base URL of the endpoint.
 *   FOOOCUS_FLAVOR  'fooocus' (Fooocus-API, default) | 'a1111' (AUTOMATIC1111 webui --api)
 *   FOOOCUS_AUTH    optional. Sent as the Authorization header verbatim.
 *
 * Flags:
 *   --only 1,6,30   generate only these card ids
 *   --force         regenerate even if public/cards/<id>.webp exists
 *   --dry-run       print the prompt manifest and exit
 *   --self-test     run against a built-in mock server (no endpoint needed)
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import sharp from 'sharp';

// The game store touches localStorage at import time (zustand persist);
// stub it before pulling in ALL_CARDS.
globalThis.localStorage ??= {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
const { ALL_CARDS } = await import('@/stores/gameStore');

// Chuck's goons (GameBoard.jsx opponent deck, base stats). They have no
// descriptions in code, so the character lines live here.
const GOONS = [
  { id: 101, name: 'Repo Ted', type: 'action', description: 'A burly repo-man teddy with a clipboard and zero sympathy.' },
  { id: 102, name: 'Loan-Shark Larry', type: 'action', description: 'A slick pinstriped teddy loan shark with a gold tooth.' },
  { id: 103, name: 'Off-the-Grid Greg', type: 'action', description: 'A twitchy survivalist teddy in a tinfoil-lined beanie.' },
  { id: 104, name: 'Unhinged Cuddles', type: 'action', description: 'A wide-eyed teddy with a too-big smile and loose stitching.' },
  { id: 105, name: 'Whiskey Whiskers', type: 'action', description: 'A grizzled barfly teddy nursing a tiny tumbler.' },
  { id: 106, name: 'Landlord Lucifur', type: 'action', description: 'A horned slumlord teddy in a smoking jacket, holding an eviction notice.' },
  { id: 107, name: 'Custody-Battle Cub', type: 'action', description: 'A small sad-eyed teddy cub dragging a half-packed suitcase.' },
  { id: 108, name: 'Void Where Prohibited', type: 'action', description: 'A glitchy void-black teddy, edges dissolving into static.' },
];

const STYLE =
  "flat stylized illustration, plain dark plum background (#2a1b3d), moody amber rim light, " +
  "worn fabric texture, visible stitches, thick clean outlines, high contrast, " +
  "children's-book style gone noir";
const NEGATIVE =
  'text, letters, watermark, logo, signature, photo, photorealistic, human, person, ' +
  'extra limbs, deformed, blurry, frame, border';

const promptFor = (card) => {
  if (card.type === 'trap') {
    return `A sinister spring-loaded toy trap object: ${card.name}. ${card.description ?? ''} ` +
      `Single object centered, no bear, ${STYLE}`;
  }
  if (card.type === 'special') {
    return `A noir still-life object representing "${card.name}". ${card.description ?? ''} ` +
      `Single object centered, no bear, ${STYLE}`;
  }
  return `A single plush teddy bear character, chest-up, facing viewer: ${card.name}. ` +
    `${card.description ?? ''} ${STYLE}`;
};

const seedFor = (id) => 40_000 + id * 97; // stable per card, arbitrary base

// ---------------------------------------------------------------------------
// Endpoint flavors
// ---------------------------------------------------------------------------
async function callFooocus(base, auth, prompt, seed) {
  const res = await fetch(`${base.replace(/\/$/, '')}/v1/generation/text-to-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
    body: JSON.stringify({
      prompt,
      negative_prompt: NEGATIVE,
      style_selections: ['Fooocus V2', 'Fooocus Sharp'],
      performance_selection: 'Speed',
      aspect_ratios_selection: '896*1152',
      image_number: 1,
      image_seed: seed,
      require_base64: true,
      async_process: false,
    }),
  });
  if (!res.ok) throw new Error(`Fooocus-API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const first = Array.isArray(data) ? data[0] : data.images?.[0] ?? data[0];
  const b64 = first?.base64 ?? first;
  if (typeof b64 !== 'string' || b64.length < 100) {
    throw new Error(`Fooocus-API returned no image (finish_reason: ${first?.finish_reason ?? 'unknown'})`);
  }
  return Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
}

async function callA1111(base, auth, prompt, seed) {
  const res = await fetch(`${base.replace(/\/$/, '')}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
    body: JSON.stringify({
      prompt,
      negative_prompt: NEGATIVE,
      width: 896,
      height: 1152,
      seed,
      steps: 30,
      cfg_scale: 7,
    }),
  });
  if (!res.ok) throw new Error(`A1111 ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const b64 = data.images?.[0];
  if (typeof b64 !== 'string' || b64.length < 100) throw new Error('A1111 returned no image');
  return Buffer.from(b64, 'base64');
}

// ---------------------------------------------------------------------------
// Post-processing: 3:4 cover crop, webp stepped down to <= 60 KB
// ---------------------------------------------------------------------------
async function toCardWebp(buf) {
  for (const quality of [80, 65, 50, 38]) {
    const out = await sharp(buf)
      .resize(384, 512, { fit: 'cover', position: 'attention' })
      .webp({ quality })
      .toBuffer();
    if (out.length <= 60 * 1024) return out;
  }
  // Last resort: smaller canvas
  return sharp(buf).resize(288, 384, { fit: 'cover' }).webp({ quality: 40 }).toBuffer();
}

// ---------------------------------------------------------------------------
// Built-in mock endpoint (--self-test): serves a generated placeholder PNG in
// both flavors so the whole pipeline can be exercised without a real backend.
// ---------------------------------------------------------------------------
async function startMockServer() {
  const png = await sharp({
    create: { width: 896, height: 1152, channels: 3, background: { r: 42, g: 27, b: 61 } },
  }).png().toBuffer();
  const body = png.toString('base64');
  const server = http.createServer((req, res) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url.includes('/v1/generation/')) res.end(JSON.stringify([{ base64: body, finish_reason: 'SUCCESS' }]));
      else if (req.url.includes('/sdapi/')) res.end(JSON.stringify({ images: [body] }));
      else { res.statusCode = 404; res.end('{}'); }
    });
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const has = (f) => args.includes(f);
  const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

  const selfTest = has('--self-test');
  const outDir = selfTest
    ? fs.mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp', 'card-art-'))
    : path.resolve('public/cards');

  let mock = null;
  let base = process.env.FOOOCUS_URL;
  let flavor = (process.env.FOOOCUS_FLAVOR ?? 'fooocus').toLowerCase();
  const auth = process.env.FOOOCUS_AUTH ?? null;

  const cards = [...ALL_CARDS, ...GOONS];
  const only = argOf('--only')?.split(',').map(Number);
  const todo = cards.filter((c) => !only || only.includes(c.id));

  if (has('--dry-run')) {
    for (const c of todo) console.log(`#${c.id} [seed ${seedFor(c.id)}] ${promptFor(c)}\n`);
    console.log(`${todo.length} cards.`);
    return;
  }

  if (selfTest) {
    mock = await startMockServer();
    base = mock.url;
  }
  if (!base) {
    console.error(
      'FOOOCUS_URL is not set.\n' +
      'Point it at a reachable Fooocus-API (or A1111 --api) endpoint, e.g.\n' +
      '  FOOOCUS_URL=https://your-tunnel.example npm run art:generate\n' +
      'From a cloud session your local instance needs a tunnel:\n' +
      '  cloudflared tunnel --url http://127.0.0.1:8888   (Fooocus-API default port)'
    );
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const call = flavor === 'a1111' ? callA1111 : callFooocus;
  let done = 0, skipped = 0, failed = 0;

  for (const card of todo) {
    const dest = path.join(outDir, `${card.id}.webp`);
    if (!has('--force') && fs.existsSync(dest)) { skipped++; continue; }
    try {
      const raw = await call(base, auth, promptFor(card), seedFor(card.id));
      const webp = await toCardWebp(raw);
      fs.writeFileSync(dest, webp);
      done++;
      console.log(`✓ #${card.id} ${card.name} (${(webp.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      failed++;
      console.error(`✗ #${card.id} ${card.name}: ${err.message}`);
      if (failed >= 3 && done === 0) {
        console.error('First three calls all failed — aborting. Check FOOOCUS_URL/FOOOCUS_FLAVOR.');
        break;
      }
    }
  }

  console.log(`\n${done} generated, ${skipped} skipped (exist), ${failed} failed → ${outDir}`);
  if (selfTest) {
    // Exercise the a1111 flavor once too, then clean up.
    const raw = await callA1111(base, null, 'self-test', 1);
    const webp = await toCardWebp(raw);
    if (webp.length === 0) throw new Error('a1111 self-test produced empty output');
    console.log(`a1111 flavor self-test OK (${(webp.length / 1024).toFixed(1)} KB)`);
    mock.server.close();
    fs.rmSync(outDir, { recursive: true, force: true });
    if (failed > 0 || done === 0) process.exit(1);
    console.log('SELF-TEST PASSED');
  }
}

await main();
