# Card art

Drop card illustrations here as `<cardId>.webp` (player cards use their
`ALL_CARDS` ids; Chuck's goons use their opponent ids 101–108).
`TeddyCard`'s `ArtOrEmoji` slot picks them up automatically — any card
without a file here (or whose image fails to load) falls back to the emoji
cast, so partial art is safe to ship.

## Generating the set (local Fooocus / Stable Diffusion)

The full set renders through `scripts/generate-card-art.mjs`, which reads
`ALL_CARDS` directly (single source of truth for ids/names/descriptions)
and talks to a self-hosted endpoint:

```bash
# Fooocus via Fooocus-API (default flavor; its default port is 8888)
FOOOCUS_URL=https://<your-endpoint> npm run art:generate

# AUTOMATIC1111-compatible webui (--api)
FOOOCUS_URL=https://<your-endpoint> FOOOCUS_FLAVOR=a1111 npm run art:generate

npm run art:generate -- --dry-run       # print the prompt manifest
npm run art:generate -- --only 1,6,30   # subset
npm run art:generate -- --force         # regenerate existing files
npm run art:generate -- --self-test     # exercise the pipeline w/ a mock server
npm run art:generate -- --monitor       # serve the live dashboard during the run
```

No endpoint at all? `scripts/generate-card-art-diffusers.py` renders the
same manifest directly through huggingface diffusers (sd-turbo by default,
GPU or CPU) — see its docstring.

## Watching a run

```bash
npm run art:monitor    # http://127.0.0.1:8877
```

Opens a live dashboard: the generation queue with per-card state
(pending / generating / done / failed, size, duration) and a clickable
gallery of every finished file — click a card to open the full-size
image. Works with all runners (they report progress to a shared status
file) and standalone, whenever your local Fooocus is grinding through a
batch. `ART_MONITOR_PORT` / `ART_DIR` override the defaults.

If this repo runs in a cloud session, a Fooocus instance on your own
machine needs a tunnel to be reachable, e.g.
`cloudflared tunnel --url http://127.0.0.1:8888` or ngrok — pass the public
URL as `FOOOCUS_URL` (optional `FOOOCUS_AUTH` is sent as the Authorization
header).

Output is post-processed automatically: 3:4 cover crop at 384×512, webp
stepped down in quality until each file is ≤60 KB. Seeds are stable per
card id, so re-runs are reproducible.

## Style contract (baked into the script's prompts)

> Flat stylized illustration of a single plush teddy bear character,
> chest-up, facing viewer, on a plain dark plum background (#2a1b3d),
> moody amber rim light, worn fabric texture, visible stitches,
> [CHARACTER], thick clean outlines, high contrast, no text, no watermark,
> children's-book style gone noir.

Traps and specials get object-centric art (the trap/item itself, same
style, no bear).
