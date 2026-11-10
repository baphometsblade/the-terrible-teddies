# Art style

One look for the whole game. The reference is a photoreal plush teddy in a moody neon dive bar: warm amber practicals, magenta neon, a little cyan tubing, cinematic shallow depth of field, rich saturated colour. Wood-black, not nursery purple. Every character is a grown bear. The age gate still holds the photographs until the door is passed.

Code paints the chrome from the tokens below. Photographs (cards, the app icon, the share image) are regenerated on a local Fooocus install from `art/fooocus-manifest.json`. Thumbs are a resize of the full plate, not a second prompt.

## Palette

| Token | Hex | Use |
| --- | --- | --- |
| Ink (`night-950`, `--bar-ink`) | `#100e0c` | Page, card face, button text on brass |
| Panel (`night-900`, `--bar-panel`) | `#1a1410` | Panels, dialogs, the colour-safe ink ground |
| Wood (`night-800`, `--bar-wood`) | `#261c16` | Room gradient, card-back mid |
| Rail (`night-700`, `--bar-rail`) | `#36281e` | Dialog tops, glass |
| Ivory (`plush-100`, `--bar-ivory`) | `#f7f1e8` | Body text |
| Muted (`plush-300`) | `#cbb59a` | Secondary text |
| Brass (`brass-300`, `--bar-brass`) | `#fbbf24` | Primary buttons, stitching, coin |
| Amber neon | `#FF9A2C` | Practical glow, Dive Bar lamp. Core `#FFF2D6` |
| Magenta neon | `#FF2F86` | Neon Pit, premium pack, dialog hairline. Core `#FFE3F1` |
| Cyan neon | `#3EC8FF` | The second tube, the blue sign. Core `#DBFFFB` |
| Felt | `#163423` | The house cloth, with an amber lamp at the top |
| Steel | `#3b4049` | The age door only. It stays a plate, not a neon sign |

Neon cores and glows live in `tailwind.config.js`. `--bar-amber`, `--bar-magenta` and `--bar-cyan` read them through `theme()` so the stylesheet does not keep a second copy. The other tokens are `:root` variables in `src/index.css` and the matching Tailwind shades.

## Light, framing, type

Light comes from above and slightly in front: an amber pool, then magenta at one edge and cyan at the other. Shadows are soft and deep. Nothing is flat vector illustration.

Typography stays Baloo 2 for display and neon tubing, and the system face for body. Neon signs are uppercase, tracked out, core colour with a glow. Do not put type inside a generated photograph. The negative prompt forbids letters.

| Asset | Fooocus aspect | Written size | Performance |
| --- | --- | --- | --- |
| Card plate | `896*1152` (3:4) | `public/cards/<id>.webp` 768×1024, thumb 192×256 | Speed |
| App icon | `1024*1024` | 512, 192, apple-touch 180, favicon 48 and 32, maskable inset to 80% | Quality |
| Share image | `1408*704` | `public/og-image.jpg` 1200×630 | Quality |

Card backs, table cloths (Dive Bar, Neon Pit, The Casino and the house felt), pack wrappers, buttons, foils and the room are CSS. They use the tokens. They are not in the raster manifest.

## Tone

Adult, tongue-in-cheek, photographic. Prompts say the bear is an adult. They do not describe a cub, a child, a teen, or anyone underage. Suggestive wardrobe and bar business are in bounds. The pictures stay behind the age gate (`data-content="sfw"` shows the emoji, not the plate).

## Fooocus prefix and negative

Bear prefix, prepended when a manifest row's prompt does not already start with it:

> RAW photo, adult plush teddy bear, photoreal worn fur, cinematic shallow depth of field, moody neon-lit dive bar, warm amber practical light, magenta neon, rich saturated colour, raunchy NSFW, tongue-in-cheek

Object prefix, for traps and specials:

> RAW photo, photoreal object, cinematic shallow depth of field, on a sticky dive-bar table, warm amber practical light, magenta neon, rich saturated colour, raunchy NSFW

Negative:

> cartoon, illustration, drawing, anime, 3d render, cgi, plastic, human, person, human skin, child, children, kid, kids, baby, toddler, teen, minor, underage, cub, loli, shota, watermark, text, letters, logo, signature, extra limbs, deformed, blurry, lowres, frame, border

A bear whose fur is not brown also gets `brown fur, tan fur, beige fur` on the negative, so the model does not paint everything chocolate.

Style selections are Fooocus V2 and Fooocus Sharp. `performance_selection` is the table above. `require_base64` is true.

## What is which

Matching, and still regenerated so the set is one shoot: the existing card plates and thumbs, the goon plates, the PWA icons, the favicon, the share image.

Restyled in code, not regenerated: the room (`.bar-backdrop`), glass panels, brass and glass buttons, dialogs, the player rail, the house felt and the three bought cloths, card backs, pack faces, epic foil, the boot splash, the offline page, theme colour.

Needs a new plate because the file was never shipped: cards 22–27 (night two), 96–99 (quickie), and 109 (Door-Staff Donna). Until those files exist, the card shows the felt back.

## Generating

From the repo root, with Fooocus-API on the owner's machine and `npm install` already done:

```bash
python3 scripts/generate-card-art-fooocus.py --base-url http://127.0.0.1:8888 --force
```

Without `--force`, files that are already there are left alone and only missing plates (and missing derived sizes) are written. `--only 22,109` limits the run. The base URL also comes from `FOOOCUS_URL`.

`art/fooocus-manifest.d/*.json` is read after the main file. Each file is either a list of entries or `{ "cards": [ ... ] }`. An entry needs `id`, `type`, `path`, `aspect_ratio`, `prompt`, and `negative_prompt`. A card entry should use `prefix: "bear"` or `"object"`, `aspect_ratio: "896*1152"`, and `outputs` for the 768×1024 plate and the 192×256 thumb. Ids must be unique across the main file and the directory. Rebuild the main list with `npm run art:manifest` after the catalog changes. Do not put the other agents' cards in the main file. Put them in the directory.
