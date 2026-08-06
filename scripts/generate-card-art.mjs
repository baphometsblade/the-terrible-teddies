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
 *   ART_MONITOR_PORT  port for the forced progress dashboard (default 8877)
 *
 * Flags:
 *   --only 1,6,30      generate only these card ids
 *   --force            regenerate even if public/cards/<id>.webp exists
 *   --dry-run          print every prompt and exit
 *   --manifest <path>  write the prompts as JSON for the python diffusers
 *                      runner, then exit
 *   --monitor          keep the dashboard serving after the batch finishes
 *   --no-monitor       skip the dashboard entirely (CI / headless)
 *   --self-test        run against a built-in mock server (no endpoint needed)
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import sharp from 'sharp';
import { startMonitor, statusWriter, openInBrowser } from './art-monitor.mjs';

// The game store touches localStorage at import time (zustand persist);
// stub it before pulling in ALL_CARDS.
globalThis.localStorage ??= {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
const { ALL_CARDS } = await import('@/stores/gameStore');
// fur/visual/scene were split out of ALL_CARDS into a store-adjacent data
// file so they don't ship in the client bundle (see src/data/cardArt.js for
// why). Re-merge them here so promptFor() and everything below sees the same
// shape it always did.
const { CARD_ART } = await import('@/data/cardArt');

// Chuck's goons (GameBoard.jsx opponent deck, base stats). They have no
// descriptions in code, so the character lines live here.
const GOONS = [
  { id: 101, name: 'Repo Ted', type: 'action', fur: 'gunmetal grey', visual: 'burly bear, hi-vis work vest, bolt cutters, repossession clipboard', scene: 'Low angle in a parking lot under blue-and-red cop lights, towing a car mid-argument.' },
  { id: 102, name: 'Loan-Shark Larry', type: 'action', fur: 'silver white', visual: 'sleek bear, pinstripe suit, gold tooth, fat cigar, pinky rings', scene: 'Over-the-shoulder in a casino back office under a green banker lamp, counting a fat roll of cash.' },
  { id: 103, name: 'Off-the-Grid Greg', type: 'action', fur: 'sand beige', visual: 'twitchy bear, tinfoil beanie, mismatched goggles, hand-drawn conspiracy map', scene: 'Fisheye in a cluttered bunker under a flickering camp lantern, pinning string to a corkboard.' },
  { id: 104, name: 'Unhinged Cuddles', type: 'action', fur: 'bubblegum pink', visual: 'bear with a too-wide stitched grin, popped seams leaking stuffing', scene: 'Extreme close-up in a padded room under harsh white strip light, grinning directly into the lens.' },
  { id: 105, name: 'Whiskey Whiskers', type: 'action', fur: 'russet ginger', visual: 'grizzled bear, greying muzzle, half-moon glasses, tiny tumbler', scene: 'Tight profile at the far end of the bar under amber lamplight, staring into his last drink.' },
  { id: 106, name: 'Landlord Lucifur', type: 'action', fur: 'crimson black', visual: 'horned bear, velvet smoking jacket, eviction notice, ring of keys', scene: 'Low hero angle in a condemned stairwell under a red exit-sign glow, nailing a notice to a door.' },
  { id: 107, name: 'Custody-Battle Cub', type: 'action', fur: 'pale cream', visual: 'small cub, one drooping eye, oversized coat, battered suitcase', scene: 'Wide shot in an empty courthouse corridor at dawn, dragging a suitcase toward the doors.' },
  { id: 108, name: 'Void Where Prohibited', type: 'action', fur: 'matte void black', visual: 'bear dissolving into static at the edges, hollow glowing eye sockets', scene: 'Dutch tilt in a pitch-dark room lit only by a buzzing broken TV, half-eaten by static.' },
];

// Kept terse on purpose: CLIP truncates at 77 tokens, so subject identity
// and the raunchy dive-bar mood must land before any tail gets clipped.
const MOOD = 'warm dive-bar bokeh, amber light, hyper realistic, hyper detailed';
const NEGATIVE =
  'cartoon, illustration, drawing, flat colors, cel shading, text, letters, watermark, ' +
  'logo, signature, human, person, extra limbs, deformed, blurry, frame, border';

// Raunchy R-rated-comedy art direction: worn plush bears living badly.
//
// Every card carries three hand-authored fields, because names and descriptions
// are jokes ("It felt nice for exactly one second") and give a diffusion model
// nothing to paint: `fur` (colour), `visual` (build/wardrobe/props) and `scene`
// (action, camera, setting, lighting).
//
// Two rules are load-bearing, both learned by shipping the failure first:
//   1. Colour leads and is stated twice. The prior for "teddy bear" is
//      overwhelmingly brown plush; a colour buried mid-sentence loses to it.
//   2. Composition is per-card. A shared "chest-up, facing viewer, centered,
//      blurred background" made 41 bears read as recolours of one portrait
//      however different their fur and wardrobe were, so there is no global
//      framing tail at all now.
//
// Segment order doubles as a truncation strategy: CLIP hard-cuts at 77 tokens
// and silently drops the overflow, so medium, colour and subject are
// front-loaded and the scene's lighting clause sits last — an overflow costs an
// adjective rather than a wardrobe. Check with `--dry-run` after editing.
// Adult register. The game is an 18+ dive-bar comedy, so this is ON by default;
// set ART_SFW=1 for a tamer pass. It pushes the tone to the raunchy, crude,
// suggestive, morning-after end the writing already lives at — innuendo and bad
// decisions, deliberately NOT explicit anatomy or sex acts (the subjects are
// plush toys and the joke is the squalor, not pornography).
//
// The marker sits EARLY — right after the medium/colour clause, before the
// per-card subject — not appended at the end. CLIP truncates at 77 tokens and
// the busiest cards already run to ~59 words, so a tail-appended tag would be
// the first thing clipped on exactly the prompts that overflow. Placed early it
// always survives; the descriptive wardrobe/scene tail still clips an adjective
// at most, as before.
const SFW = /^(1|true|yes|on)$/i.test(process.env.ART_SFW ?? '');
const ADULT = SFW ? '' : ', raunchy adult NSFW comedy, risqué, suggestive';

const promptFor = (card) => {
  const subject = card.visual || card.description || card.name;
  const scene = card.scene || MOOD;
  if (card.type === 'trap' || card.type === 'special') {
    return `Product photo${ADULT}, single object filling the frame — ${subject}. ${scene}`;
  }
  const fur = card.fur ? `${card.fur} ` : '';
  return `RAW photo, ${fur}plush teddy bear, ${fur}fur${ADULT} — ${subject}. ${scene}`;
};

// Non-brown bears fight the model's brown-plush prior; when guidance is on
// (SD_GUIDANCE>0) the runner sends this as the negative prompt.
const BROWNISH = /brown|tan|chocolate|espresso|caramel|amber|auburn|khaki|russet|beige|oxblood/i;
const negativeFor = (card) =>
  card.type === 'action' && card.fur && !BROWNISH.test(card.fur)
    ? `${NEGATIVE}, brown fur, tan fur, beige fur`
    : NEGATIVE;

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
// Post-processing: 3:4 cover crop, webp stepped down to <= 150 KB
// ---------------------------------------------------------------------------
async function toCardWebp(buf) {
  for (const quality of [85, 75, 65, 55]) {
    const out = await sharp(buf)
      .resize(768, 1024, { fit: 'cover', position: 'attention' })
      .webp({ quality })
      .toBuffer();
    if (out.length <= 150 * 1024) return out;
  }
  // Last resort: smaller canvas, regardless of budget.
  return sharp(buf).resize(576, 768, { fit: 'cover' }).webp({ quality: 50 }).toBuffer();
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

  const cards = [...ALL_CARDS.map((c) => ({ ...c, ...(CARD_ART[c.id] ?? {}) })), ...GOONS];
  const only = argOf('--only')?.split(',').map(Number);
  const todo = cards.filter((c) => !only || only.includes(c.id));

  if (has('--dry-run')) {
    for (const c of todo) console.log(`#${c.id} [seed ${seedFor(c.id)}] ${promptFor(c)}\n`);
    console.log(`${todo.length} cards.`);
    return;
  }

  // Machine-readable prompt manifest, so external backends (e.g. a python
  // diffusers runner) can reuse the exact same prompts and seeds.
  const manifestPath = argOf('--manifest');
  if (manifestPath) {
    const manifest = todo.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      prompt: promptFor(c),
      negative: negativeFor(c),
      seed: seedFor(c.id),
    }));
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`wrote ${manifest.length} prompts to ${manifestPath}`);
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

  // Live dashboard — forced on for every generation run so there's always
  // a window to watch (opt out with --no-monitor; self-test stays headless).
  let monitorServer = null;
  const wantMonitor = !has('--no-monitor') && !selfTest;
  if (wantMonitor) {
    monitorServer = await startMonitor({ dir: outDir });
    openInBrowser(`http://127.0.0.1:${Number(process.env.ART_MONITOR_PORT ?? 8877)}`);
  }
  const pending = todo.filter((c) => has('--force') || !fs.existsSync(path.join(outDir, `${c.id}.webp`)));
  const status = statusWriter(pending);

  for (const card of todo) {
    const dest = path.join(outDir, `${card.id}.webp`);
    if (!has('--force') && fs.existsSync(dest)) { skipped++; continue; }
    const t0 = Date.now();
    status.generating(card.id);
    try {
      const raw = await call(base, auth, promptFor(card), seedFor(card.id));
      const webp = await toCardWebp(raw);
      fs.writeFileSync(dest, webp);
      done++;
      status.done(card.id, +(webp.length / 1024).toFixed(1), Date.now() - t0);
      console.log(`✓ #${card.id} ${card.name} (${(webp.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      failed++;
      status.failed(card.id);
      console.error(`✗ #${card.id} ${card.name}: ${err.message}`);
      if (failed >= 3 && done === 0) {
        console.error('First three calls all failed — aborting. Check FOOOCUS_URL/FOOOCUS_FLAVOR.');
        break;
      }
    }
  }
  status.finish();

  console.log(`\n${done} generated, ${skipped} skipped (exist), ${failed} failed → ${outDir}`);
  if (has('--monitor') && wantMonitor) {
    console.log('monitor is still serving — Ctrl-C to exit');
    return; // keep the server (and process) alive for browsing the results
  }
  if (monitorServer) {
    monitorServer.close();
    console.log('monitor closed — browse results any time with: npm run art:monitor');
  }
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
