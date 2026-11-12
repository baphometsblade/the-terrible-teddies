# Art direction: one bear, one look

Mark's brief (Nov 2026): the first Fooocus pass made every card look the same, because one long shared style block (plush teddy, moody neon dive bar, warm amber light, magenta neon, cinematic shallow depth of field) led every prompt and the bear-specific part was a short tail. Each bear now gets his own look, driven by his name and the joke it is making.

## What is shared

Only the plush guard, so every plate is still unmistakably an adult stuffed teddy and never a human or a real animal:

> `(stuffed plush teddy bear toy:1.2), adult plush teddy bear with a plush bear head, round plush ears, button eyes, stitched seams and plush paws, not a human`

The negative prompt for every bear keeps the safety terms (humans, real bears and other real animals, anyone under 18, costumes and mascot suits, text and watermarks), with `(text, lettering, ...:1.3)` and `(human, man, woman, person, ...:1.3)` weighted up front because SDXL letters anything that looks like a poster and draws a person under a described costume. Photographic bears also push away `anime, 3d render, cgi, plastic`; painterly bears push away `photo, photograph, photorealistic, depth of field, bokeh` instead, so their medium survives. When a bear's fur isn't brown, `brown fur, tan fur, honey fur` goes in the negative so his colour survives.

Nothing else is shared: no dive bar, no neon, no amber or magenta, no house lighting or lens.

## What each bear owns: the signature

Every bear has a signature in `art/bear-bibles.json`:

- **name** and **name_gag**: the card name, and the joke on it stated literally ("Slumlord Cotton is literally made of cotton bolls").
- **medium** and **medium_detail**: the art style, such as a papercut shadow box, scrimshaw, an embroidered patch, a fighting-game screenshot or a night-vision CCTV still.
- **styles**: Fooocus style presets that match the medium (`Papercraft Paper Quilling`, `Mk Embroidery`...). Empty means no preset at all.
- **palette**: 2-3 named colours.
- **fur**: colour, texture and build.
- **outfit**, **prop** (the signature prop), **setting**, **lighting**, **camera** (angle and framing) and **pose** (pose and expression).
- **gag**: the visual joke as the picture should show it.
- **character**: set only on Chuck's three cards, whose look the game fixes.

### Prompt order (tuned on Fooocus, Nov 2026)

The old order put the plush guard first at weight 1.4. On Fooocus SDXL that drew a generic cream plush on every card and the medium and joke washed out (the Under-Desk Uma test came out as a plain bear on a desk). Bear prompts now run:

`(medium, medium detail:1.35), (gag:1.25), pose, wearing outfit, signature prop, setting, colour palette, lighting, camera. <plush guard>, fur: <fur>. Cheeky adult humour, no text.`

Bear rows render on the **Quality** preset (60 steps) with `guidance_scale` 6, and with the bear's own `styles` (none by default, since `Fooocus V2` rewrites the prompt with generic words and `Fooocus Sharp` pulls every plate toward one grade). Each redo renders several seeds and the best one is kept.

### Uniqueness rules

`npm run art:unique` (`scripts/bear-signatures.mjs`) checks the whole set, and `src/artSignatures.test.js` runs the same checks in the unit suite, so `npm test` and `npm run ci:local` fail on a clash:

1. Every signature field is filled in, with 2-3 palette colours, and the name gag says the bear's name.
2. No two bears share a medium, or a medium + palette.
3. No two bears share a setting + signature prop, a signature prop, or a setting.
4. No two bears share an identical signature tuple.
5. No two bears of the same kind of picture (photo, print, painting, drawing, craft) share a palette, compared by hue: "Chuck's teal" and "thread teal" are both teal.
6. No two signatures are too alike in their words: TF-IDF cosine over the signature text, with the plush guard and Chuck's fixed look left out, must stay at or under 0.22.

The suite also checks that every bear row in the manifests carries exactly the composed prompt, negative and styles, so a bible edit without `node scripts/bear-bibles.mjs` fails.

## The Naughty List, third pass (Nov 2026)

Mark: "All the current bears art looks way too similar." The second pass gave the ten `xm-` bears different props and fur, but every bible still asked for a photograph of a toy, none was marked `painterly`, so every negative pushed away `anime, 3d render, cgi, plastic`, and all ten rendered as the same thing: a centred, warm-lit plush photo on a dark set. On the 96×144 card face the name and stat scrims darken the top quarter and the bottom 43% of the art, so ten dark photos read as one muddy brown bear.

The third pass gives each bear its own medium as well as its own gag, and no two share a medium or a dominant palette:

| Bear | Medium | Dominant palette |
| --- | --- | --- |
| Under-Desk Uma | night-vision security-camera still | phosphor green and black |
| Reply-All Rita | Swiss cut-paper collage poster | paper white and toner black |
| Open-Bar Ozzy | Baroque oil painting, Caravaggio chiaroscuro | burgundy, umber and candle gold |
| HR Holly | 1950s safety-poster gouache | mint teal, coral and cream |
| Eggnog Eddie | felt stop-motion still | butter yellow and custard cream |
| Clocked-Out Elf | 1980s synthwave airbrush | hot magenta and electric cyan |
| Secret Santa Stan | 1940s film-noir silver print | black and white, one red ribbon |
| Mistletoe Mandy | 1960s pop-art romance comic | primary red and lemon yellow |
| The Naughty List | illuminated manuscript miniature | lapis blue and gold leaf |
| Sleazy Santa | 1970s black-velvet blacklight painting | electric orange and red on black |

Each plate keeps the bear's face and gag in the clean band between the two scrims, and is checked as a card face, not only as a full plate. Fooocus was offline for this pass, so these ten plates came from a hosted generator (fal.ai), the only time one was used. `art/renders/naughty-list-v3.json` records the exact prompts, request ids, the pick and the crop, and the Fooocus manifest rows are recomposed from the same bibles, so a later Fooocus run aims at the same look. Hosted generators are retired; see "Image backend" below.

## The whole roster, name-first pass (Nov 2026)

Mark: "EVERY bear in the game looks too similar." The Naughty List finding held for the whole roster, and two more causes sat in code shared by every card:

- `scripts/generate-card-art.mjs` opened every bear prompt with a fixed `RAW photo`, so the legacy generator shot all of them as the same plush photograph. Each `CARD_ART` entry may now carry a short `medium` ("ukiyo-e woodblock print", "thermal camera image"), which replaces that lead. Entries without one still get `RAW photo`.
- The `scene` lines were drawn from a small shared pool of sets and light: "hot pink neon" in ten scenes, "sickly green fluorescent" in eight, plus "amber jukebox glow", "motel room", "bar top", "Dutch tilt" and "Low hero angle" again and again. Each redone bear's scene is now its own gag, set and medium.

The name drives everything else: the medium, palette, set, angle and joke. The only thing every bear shares is the adult plush-toy guard. The plates are generated in waves, and each wave's provenance is in `art/renders/roster-wave-N.json`.

## The distinctness pass (Nov 2026)

Goal: you can tell every bear from its art alone, and the art says its name.

**Audit.** `scripts/art-distinctness-audit.py` scores every pair of bear plates
with 0.6 × CLIP ViT-B-32 image cosine + 0.25 × HSV colour-histogram overlap +
0.15 × pHash. It also checks how well each plate matches its own medium + gag
text, ranked against all 117 plates. It writes an in-app-size contact sheet (a
PIL replica of TeddyCard at 2×, with frame and scrims) and a thumbnail grid.
Results: `art/audit/distinctness-before.json` and `art/audit/distinctness-after.json`.

The lookalikes came from one cluster: warm, dark old-master oil and varnish
in oxblood, umber and gold, with a centred honey-brown bear. Sixteen bears were
flagged, by eye and by score.

| | before | after |
|---|---|---|
| closest pair (combined) | 0.779 (65 ~ Chuck) | 0.745 (23 ~ hd-lap) |
| mean of top 20 pairs | 0.747 | 0.709 |
| closest CLIP pair | 0.846 | 0.799 |
| bears whose nearest neighbour is > 0.75 / > 0.72 / > 0.70 | 8 / 26 / 35 | 0 / 7 / 17 |

**Redone on Fooocus (13).** 4, 14, 18, 20, 65, 90, 91, 105, 106, ck-rita,
ck-tabitha, lo-owners-round, xm-ozzy. The settings were Quality, guidance 6,
juggernautXL v8, and each bear's own Fooocus style presets. A new plate was only
kept if it read better by eye *and* its nearest-neighbour score dropped. Seeds,
prompts and candidate scores are in `art/renders/distinct-pass.json`.

**Kept live (3).** 23, 55 and 61. No candidate was clearly better: they drew
humans, lost the gag, or read as blood. 23's signature was put back to match its
live art. 55's and 61's new signatures are the target for a future render.

**Second pass (same rules).** These bears were targeted: the pink trio (23, 24 and hd-lap), 21 against 68, 55, 61, the taxi pair 97 and ma-4, plus fuller framing for 65 and 106.

- **Redone (4):** 23 (cyanotype), 24 (Lite-Brite), hd-lap (Rococo plush) and 21 (misty jungle river).
- **Kept live:**
  - 55 and 61: no candidate beat the live art on the name gag. The retries drew humans, lost the ashtray hat, or never landed the slap. Their signatures went back to describing the live art.
  - 65 and 106: every fuller composition raised the nearest-neighbour score.
  - 97: its signature now owns a drive-in back seat, so only ma-4 keeps the cab. Four rounds of candidates (6 to 8 per bear) sat upright instead of sprawling, so the live taxi plate stays until a render beats it.

| | after pass 1 | after pass 2 |
|---|---|---|
| closest pair | 0.745 (23 ~ hd-lap) | 0.736 (51 ~ 62) |
| mean of top 20 pairs | 0.709 | 0.696 |
| bears whose nearest neighbour is > 0.72 / > 0.70 | 7 / 17 | 2 / 11 |

Results are in `art/audit/distinctness-after-2.json`.

## Image backend: local Fooocus on the GPU only

Mark's call (Nov 2026): every image goes through Fooocus-API on his own PC, on its NVIDIA GPU. No hosted generator (fal.ai or similar) is used, and nothing in the game, its Supabase functions or its Vercel project calls one at runtime. Card art is static files under `public/cards/`, so the live site never needs the art PC. `src/artPipeline.test.js` fails the suite if a hosted generator turns up in `src/`, `scripts/`, `supabase/` or the package files. `docs/` and `art/renders/` are exempt, because they hold the provenance of plates made before the switch.

Fooocus-API listens on `127.0.0.1:8888` on the art PC and is not exposed to the internet. Run the generator on that PC:

- `npm run art:fooocus -- --only <ids> --force` renders into the repo.
- Add `--out-root <dir>` to render a preview outside `public/`, and `--provenance <file>` to record each render's prompt, seed, timing, GPU and output sha256.
- With a loopback endpoint the generator checks `nvidia-smi` first and refuses to run without an NVIDIA GPU. It also samples GPU load during each render and warns if the load never passes 30%, which is what a CPU fallback looks like. `--gpu-check require|off` overrides this.
- `npm run art:fooocus -- --self-test` runs the whole path against a mock Fooocus-API, and the unit suite runs it too.

## Workflow

1. Edit a signature in `art/bear-bibles.json`, then run `npm run art:unique` until it passes.
2. Run `node scripts/bear-bibles.mjs` to write the composed prompts, negatives and styles into `art/fooocus-manifest.json` and `art/fooocus-manifest.d/*.json`. `scripts/build-fooocus-manifest.mjs` uses the same composer.
3. On the Fooocus machine, run `python scripts/generate-card-art-fooocus.py --force --only <ids> --out-root ../art-preview --provenance ../art-preview/prov.json`, review the previews, then run again without `--out-root` to write into `public/cards/`.
4. Check the result: no humans or real animals, the gag reads at thumbnail size, and the bear doesn't look like his neighbours.

Rules: adults only, cheeky and saucy, never explicit, no real people, no text in the image. Object and item plates, the app icon and the share image still use the shared bar style in `docs/ART_STYLE.md`.

## The 117 bear signatures

| Id | Bear | Name gag | Medium | Palette | Prop | Setting | Camera |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Shitstarter Ted | Shitstarter Ted: crouched under a bar stool striking a giant cartoon match against his own backside to light the fizzing fuse of a round black powder keg | 1940s rubber-hose cartoon animation cel | Fuse orange, ink black, old-cartoon cream | giant cartoon match | cartoon saloon floor under a bar stool, stools with scared faces | low wide cartoon staging |
| 2 | Feral Tim | Feral Tim: a wild matted ash-grey plush teddy bear with stuffing tufts poking out, crouched on top of a tipped-over wheelie bin in a back alley | Grimy 1990s skate-video still from a fisheye camcorder | Dumpster green, concrete grey, camcorder flash white | pizza crust clenched in teeth | tipped-over wheelie bin in a brick back alley | fisheye lens inches from his snout |
| 3 | Fluffy McFuckface | Fluffy McFuckface: beaming an innocent smile while very rudely raising one middle paw | 1990s neon kawaii sticker-book art | Candy pink, lilac, lemon | rude raised middle paw | rainbow sparkle cloud, die-cut sticker outline | front-on sticker portrait |
| 4 | Bar-Fight Barry | Bar-Fight Barry turns every pub into a fighting-game stage, bar stool first | 1990s arcade fighting-game screenshot | arcade purple, health-bar green, hit-flash white | a wooden bar stool swung overhead | a fighting-game pub stage with flying peanuts and beer foam | side-on fighting-game view, mid-air |
| 5 | Stitches the Snitch | Stitches the Snitch: a scrawny patchwork plush teddy bear sewn from plum, grey and tan scraps held together by huge visible cross-stitches | 1970s police-procedural 16mm film still | cold steel blue, swinging-bulb yellow, interrogation grey | tiny wire microphone taped to his chest | interrogation room, steel table, two-way mirror | eye-level across the table |
| 6 | Shit-Talk Sally | Shit-Talk Sally: leaning into a stand-up comedy microphone mid-insult | Expressionist oil painting with swirling | Blood-orange swirling sky, crimson, deep indigo | stand-up microphone | comedy club warped into swirling brushstrokes | low front-row angle |
| 7 | Peeping Pete | Peeping Pete: a scrawny moss-green moth-eaten plush teddy bear peeking out of an overflowing wicker laundry hamper, a lace bra perched on his head like a cap | 1950s Technicolor suspense-movie still seen through binoculars | Technicolor teal, lavender, lace cream | binoculars | overflowing wicker laundry hamper | double-circle binocular view |
| 8 | Chokehold Cuddles | Chokehold Cuddles: giving a smaller plush teddy a 'hug' in the ring that is plainly a sleeper hold | Mexican lucha-libre wrestling poster | Hot pink, royal blue, gold | smaller plush teddy in a sleeper hold | wrestling ring ropes | front-on poster hero |
| 9 | Shiv-in-a-Pillow | Shiv-in-a-Pillow: lying flat as a pillow, side-eyeing the viewer, a toothbrush shiv poking out of the seam | Prison tattoo flash sheet | Ballpoint blue, ink black, nicotine-yellowed paper | sharpened toothbrush shiv poking from the pillow seam | tattoo flash sheet border of roses, daggers and a swallow | front-on flash design |
| 10 | Anger-Management Gus | Anger-Management Gus: a hulking mustard-yellow plush teddy bear with bristling fur, tearing a stress ball clean in half with both paws | Japanese ukiyo-e woodblock print | Prussian indigo, mustard, rice-paper cream | stress ball torn in half | cracked tatami room | front-on woodblock composition |
| 11 | Restraining-Order Randy | Restraining-Order Randy: a broad slate-grey plush teddy bear with one button eye missing, in a neck brace with court papers stapled across his chest like a sash | Courtroom sketch artist drawing | Slate grey, oak brown, buff paper | neck brace | courtroom floor with a taped line | sketch-artist side view |
| 12 | 'Roid-Rage Reggie | 'Roid-Rage Reggie: Reggie the gym-floor show-off, a fuzzy brick-red plush teddy bear flexing comically over-stuffed plush biceps | 1980s bodybuilding-magazine cover photograph | Spray-tan orange, chrome, brick red | giant protein shaker | painted orange-to-chrome gradient backdrop | full-body front cover pose |
| 13 | The F-Bomb | The F-Bomb: a round jet-black singed plush teddy bear shaped like a cartoon bomb with a lit fuse sprouting from his head, mouth wide open mid-swear | World War Two bomber nose-art painting on riveted aluminium fuselage | Olive drab, cherry red, enamel cream | falling bomb ridden like a rodeo bull | riveted olive aluminium fuselage | nose-art pin-up framing |
| 14 | Slumlord Cotton | Slumlord Cotton is literally made of cotton bolls, a slumlord in stitches | embroidered patch on faded denim | denim blue, cotton white, thread scarlet | a fat roll of rent money | a crooked embroidered tenement with a leaking roof and tiny tenants in every window | patch centred on denim, slightly tilted |
| 15 | Tax-Fraud Teddy | Tax-Fraud Teddy: a lanky dusty-plum plush teddy bear with a shifty sideways glance, sweating | Banknote intaglio engraving | Banknote green, cream, plum | fake moustache slipping off his muzzle | ornate banknote oval cartouche with guilloche rosettes | centred currency portrait |
| 16 | Lord Fluffington, Disgraced | Lord Fluffington, Disgraced: posing proudly in a moth-eaten velvet smoking jacket and a lopsided powdered wig before a crumbling country estate | 18th-century aristocratic oil portrait in the grand manner | Faded ochre, powder blue | pawn ticket | crumbling country estate and pastoral sky | three-quarter grand portrait |
| 17 | Blackout Bjorn | Blackout Bjorn: a hulking dark-auburn shaggy plush teddy bear passed out on the deck of a stitched longship, a drinking horn still clutched in his paw | Medieval embroidered tapestry like the Bayeux Tapestry | Madder red, woad blue, ochre wool | drinking horn | stitched longship with shields, embroidered waves, a thieving gull | side-on tapestry frieze |
| 18 | Grandpa Warcrimes | Grandpa Warcrimes draws his tall war stories as battle plans on the blackboard | chalkboard chalk drawing | chalk white, slate black, chalk red | a pointer stick and exaggerated chalk battle-plan arrows | a retirement-home blackboard covered in wild battle diagrams | straight-on, the bear in the lower left, the diagrams filling the rest |
| 19 | The Seam Reaper | The Seam Reaper: a tall skeletal-thin bone-pale-grey plush teddy bear in a hooded reaper robe, round plush ears poking out of the hood | Medieval danse-macabre woodcut | bone white, woodcut black, aged-paper ochre | giant sewing scissors | conga line of nervous plush teddies, unspooled thread | procession frieze |
| 20 | The Godfluffer | The Godfluffer is the don: kiss the ring | papier-mache sculpture | cream paper, jet black paper, gold foil | a fat gold-foil ring held out to be kissed | a folded paper wingback chair on a bright white table | low angle looking up at the throne |
| 21 | Fluffpocalypse Now | Fluffpocalypse Now: rising out of a misty jungle river with his face camo-painted, torn stuffing drifting like smoke | 1970s jungle war-movie film still | jungle green, river-mist grey, khaki | cavalry hat | a misty jungle river at dawn with torn stuffing drifting like smoke | low wide at water level |
| 22 | Hungover Hank | Hungover Hank: a broad stale-beer-brown plush teddy bear with flattened fur, face-down in a bowl of cereal at a sunny kitchen table | 1950s magazine-cover illustration in the warm | Butter yellow, robin's-egg blue, breakfast warmth | ice pack on his head | sunny 1950s kitchen table with cereal bowl | homely eye-level table view |
| 23 | Morning-After May | Morning-After May: peeking from the curtains at dawn with last night's mascara smeared | cyanotype print | Prussian blue, paper white | an empty champagne coupe | half-drawn gauzy curtains at dawn | close portrait, the bear filling most of the frame |
| 24 | Smitten Sid | Smitten Sid: a lean blush-pink plush teddy bear with lovesick button eyes on bended knee, clutching a wilted bouquet | Lite-Brite glowing peg art | electric cyan, peg red, pegboard black | wilted bouquet | a black pegboard sky of glowing peg love hearts | centred, the bear filling the frame |
| 25 | Crush Cora | Crush Cora: flashing a sweet sugary smile while effortlessly crushing a cocktail glass in her paw | 1920s Art Deco cocktail poster | Jet black, polished silver | pearl strands | Art Deco sunburst fans and chrome geometry | bold poster close-up |
| 26 | Blackout Bea | Blackout Bea: a midnight-blue plush teddy bear splattered all over with glowing UV paint, dancing wildly blindfolded with her paws in the air | Ultraviolet blacklight rave photograph | UV violet, neon yellow-green | blindfold | rave dance floor with laser haze | low dancing angle |
| 27 | Lights-Out Lou | Lights-Out Lou: one paw flicking off the light switch while the other throws a huge haymaker punch | Thermal infrared camera image | Thermal false colour: purple, magenta, orange | light switch | pitch-dark corridor | corridor wide |
| 50 | Dumpster Dave | Dumpster Dave: a pot-bellied garbage-grey plush teddy bear lounging blissfully in an overflowing dumpster like a hot tub, a banana-peel crown on his head | 1980s gross-out collectible trading-card painting | Slime green, garbage grey, banana yellow | fish-skeleton backscratcher | overflowing dumpster with the lid propped like a sunroof | front-on gross-out card |
| 51 | Mange Marvin | Mange Marvin: a scrawny pale-tan plush teddy bear with comically bald patches showing stitched fabric underneath, wearing a cone of shame | Antique veterinary anatomy plate | Aged parchment, faded madder pink, iodine brown | cone of shame | aged specimen plate with callout lines | scientific full-figure plate |
| 52 | Two-Beer Tina | Two-Beer Tina: dancing triumphantly on a picnic table in a floral sundress and flip-flops | 1970s Kodachrome backyard barbecue snapshot | Kodachrome red, avocado green, harvest gold | floral sundress | backyard picnic table and smoking grill | snapshot from the lawn |
| 53 | Coupon Carl | Coupon Carl: standing heroically atop a towering shopping cart overflowing with coupons | Heroic fantasy paperback cover painting | Storm purple, heroic gold, cardigan beige | socks with sandals | stormy heroic sky | heroic low angle |
| 54 | Sticky Mickey | Sticky Mickey: a fuzzy honey-gold plush teddy bear completely stuck to a tiled wall by thick dripping honey, arms and legs splayed like a starfish | Extreme macro food photography | Molten amber, honey gold | honey strands | amber tiled wall | macro, shallow depth of field |
| 55 | Ashtray Annie | Ashtray Annie wears the ashtray as a hat | 1950s jazz record sleeve photograph | deep jazz blue, smoke white, cigarette-ember orange | an overflowing glass ashtray worn on her head like a pillbox hat | scorched old mattress | off-centre sleeve portrait |
| 56 | Bouncer Bruno | Bouncer Bruno: a colossal slab-shaped charcoal plush teddy bear so wide he completely fills a steel nightclub doorway, arms crossed | Brutalist architecture photograph from a worm's-eye view | Raw concrete grey, steel | earpiece | steel door in raw brutalist concrete | extreme worm's-eye |
| 57 | Hairball Harriet | Hairball Harriet: coughing up a giant hairball onto a satin pageant cushion | Dog-show pageant photograph | Satin royal blue, rosette red, cream | huge rosette | satin show cushion and ring drapes | eye-level pageant portrait |
| 58 | Prison-Wine Pierre | Prison-Wine Pierre: a squat plum-wine-coloured plush teddy bear in a striped prison shirt and a beret, sniffing a wine glass like a snooty connoisseur | 1890s Montmartre cabaret lithograph poster | Wine purple, absinthe green, cream | wine glass | prison cell bars and a stage spotlight | poster three-quarter view |
| 59 | Glitter Lungs | Glitter Lungs: a glitter-encrusted plush teddy bear coughing out an enormous explosive cloud of glitter, his fur shedding sparkles | Holographic foil trading card | Iridescent holo rainbow, silver | glitter cloud | holographic foil background | close three-quarter |
| 60 | Beargaritaville | Beargaritaville: in a loud Hawaiian shirt lounging in a giant salt-rimmed margarita glass like a hot tub | 1950s tiki travel poster | Lime green, sunset coral, turquoise | paper umbrella | tropical sunset, palms, tiki torch, stylised waves | poster front view |
| 61 | Snitchslap Sue | Snitchslap Sue snitches and slaps in the same breath, wire and all | Telenovela dramatic freeze-frame | Dusty rose, melodrama magenta | a tiny wire microphone peeking from her neckline | soap-opera glow with lens flare | extreme dramatic zoom |
| 62 | Chainsmoke Chad | Chainsmoke Chad: holding a fan of ten cigarettes in his mouth at once | 1950s magazine advertising illustration | Cream, nicotine yellow, ad-red | letterman sweater | cream advert backdrop | ad-style front view |
| 63 | Bail-Money Bonnie | Bail-Money Bonnie: a wiry dust-brown plush teddy bear in a cowboy hat and a bandana, standing behind a bail-bonds counter throwing stacks of cash into the air | Wild West tintype photograph | tintype silver, smoky black, gunpowder sepia | sheriff's star | wooden bail-bonds counter | waist-up tintype |
| 64 | Sgt. Snuggles, Dishonorable | Sgt. Snuggles, Dishonorable: saluting stiffly with his medals torn off leaving thread marks | Soviet constructivist propaganda poster | Revolution red, black, olive | military tunic with medals torn off | red and black geometric diagonals | low heroic diagonal |
| 65 | The Debt Collector | The Debt Collector has come to collect: kneecap-shaped plush pillows are weighed on his balance scale | layered papercut shadow-box diorama | ledger green, IOU-slip white, red-pen red | a giant red rubber mallet | a paper doorway with a nervous little paper teddy peeking out, paper coins and an open ledger | close medium shot, the bear filling most of the frame in a deep crowded paper scene |
| 66 | Mama Mauls | Mama Mauls: a big over-stuffed caramel plush teddy bear in a floral apron standing dead centre on a pastel kitchen counter, brandishing a rolling pin overhead | Perfectly symmetrical pastel storybook film still | Pastel pink, mint, butter | rolling pin | perfectly mirrored pastel dollhouse kitchen | dead-centre frontal |
| 67 | Whiskey Priest | Whiskey Priest: a portly whiskey-amber plush teddy bear in priest's vestments pouring whiskey into a golden chalice, a rosary made of bottle caps | Gothic stained-glass window | Jewel ruby, cobalt, whiskey amber | whiskey bottle | gothic window tracery | frontal icon |
| 68 | Duke of Dumpsterfire | Duke of Dumpsterfire: seated on a flaming dumpster throne raising a sceptre made of a toilet plunger | 1980s heavy-metal album cover airbrush painting | Fire orange, lightning violet, black | toilet-plunger sceptre | flaming dumpster throne under lightning | low epic throne view |
| 69 | Big Spoon, Last Warning | Big Spoon, Last Warning: a gigantic snow-white plush teddy bear towering over a tiny city like a kaiju, arms wide open for a hug | 1950s kaiju B-movie poster painting | Searchlight teal, pulp red, night navy | huge metal spoon | tiny night city under searchlights | street-level looking up at a giant |
| 80 | Nightcap Ned | Nightcap Ned: in a striped nightcap and nightgown creeping down a staircase with a candlestick in one paw and a glass of whisky raised in the other | Victorian penny-dreadful mezzotint | Mezzotint black, candle amber | striped nightcap | creaky gothic staircase | staircase three-quarter |
| 81 | Velvet Rope Vicky | Velvet Rope Vicky: blocking the red carpet with one paw raised in a firm no | 1950s Technicolor movie-premiere photograph | Velvet crimson, flashbulb gold | brass stanchion jewellery | red carpet between brass posts | waist-up glamour |
| 82 | Whiskey-Sour Walt | Whiskey-Sour Walt: a squat citrus-yellow plush teddy bear with a hugely puckered stitched mouth, holding a lemon in one paw and a whiskey sour in the other | Vintage citrus fruit crate label artwork | Lemon yellow, orchard green, sky blue | lemon | lemon orchard under a sunburst | label front view |
| 83 | Motel-Bible Mara | Motel-Bible Mara: a sly silver-blonde plush teddy bear sitting on a motel bed, opening a hollowed-out bedside bible stuffed with cash and a fake passport | 1970s motel Polaroid snapshot | Faded orange, brown panelling, flash white | hollowed-out book with cash | 70s motel bed and wood panelling | snapshot from the foot of the bed |
| 84 | Lap-Dance Lila | Lap-Dance Lila: a chubby fuzzy pink plush teddy bear with round ears and button eyes, sitting coyly on a velvet chair with a feather boa | Art Nouveau cabaret poster | Absinthe green, peach, gold | velvet chair | Art Nouveau floral mosaic frame | centred poster |
| 85 | Glory-Hole Gus | Glory-Hole Gus: a cheeky hard-hat-wearing teal-felt plush teddy bear peeking through a round hole in a plywood wall, a toolbelt on | Architectural blueprint drawing | Blueprint cyan, white line | toolbelt | plywood wall with a drilled hole | technical elevation |
| 86 | Safe-Word Sandy | Safe-Word Sandy: a sleek glossy black plush teddy bear in a leather corset and gloves holding up a giant red stop-sign paddle, calm and completely in charge | High-fashion editorial photograph | Black, signal red | red stop-sign paddle | stark black studio | editorial waist-up |
| 87 | Afterparty Andre | Afterparty Andre: a hulking confetti-gold glittery plush teddy bear dangling from a spinning ceiling fan by his own shirt, still dancing with his legs kicking | Disco mirrorball flash photograph | Mirrorball silver, electric blue | mirrorball | dark disco ceiling | looking up at the fan |
| 88 | Open-Tab Omar | Open-Tab Omar: in a shiny tuxedo jacket grinning as he unrolls an impossibly long receipt that spills down a neon-lit casino staircase and out of frame | Las Vegas neon night photograph | Neon pink, neon green, casino black | endless paper receipt | neon-lit casino staircase | low on the stairs |
| 89 | Last-Call Lana | Last-Call Lana: a tall chunky amber plush teddy bear with stubby plush limbs and round toy proportions, in a little sequin party dress | Mid-century American realist painting of a lonely all-night diner | Diner teal, fluorescent cream, night green | a high heel on one foot | empty all-night diner, rainy street through the window | doorway full figure |
| 90 | Cougar Carol | Cougar Carol is a cougar on the prowl, shot like big game on safari | telephoto safari wildlife documentary photograph | savannah gold, acacia olive, sunset pink | a glass of red wine | a flat rock under an acacia tree on the open savannah | telephoto from far away through tall grass, the bear small on the right third |
| 91 | Walk of Shame | Walk of Shame: the long sunrise walk home, cone hat and all | 1980s Japanese city-pop anime illustration | Sunrise peach, lavender, sky pink | a traffic cone worn as a party hat and a half-eaten kebab | an empty city zebra crossing at sunrise between skyscrapers | street-level walking toward camera |
| 92 | Spiked Punchbowl | Spiked Punchbowl: a squat punch-red plush teddy bear with a glass punchbowl for a belly sloshing with red punch, a spiky mohawk | Punk rock xerox gig flyer | xerox black, photocopy grey, punch red | glass punchbowl belly full of punch | torn xerox collage with safety pins | front-on flyer |
| 93 | The Morning After | The Morning After: lying in a bed floating in the sky | Surrealist oil painting in the Belgian style | Sky blue, cloud white, hangover grey | floating bed | clear blue sky with clouds | eye-level on the bed |
| 94 | Booty Call | Booty Call: in a trench coat standing impatiently in a doorway | Y2K chrome render | Chrome silver, plum, holographic lilac | chrome boot-shaped flip phone | chrome doorway | full figure in the doorway |
| 95 | Room Service | Room Service: in a bellhop cap and waistcoat pushing a silver room-service cart | 1980s luxury hotel catalogue photograph | Peach, champagne, hotel brass | silver cart | peach mirrored hotel corridor | waist-up at the cart |
| 96 | Quickie Quinn | Quickie Quinn: a lean hot-pink plush teddy bear sprinting out of a storeroom door at incredible speed, holding up a stopwatch | Italian Futurism painting | Hot pink, speed orange, steel grey | polka-dot hair bow | storeroom doorway fractured into speed planes | diagonal motion |
| 97 | Backseat Benny | Backseat Benny: sprawled shirtless across the back seat at the drive-in like he owns it | Fauvist painting | Fauve red, emerald green, drive-in violet | a fogged-up window with a paw-drawn heart | the back seat of a cherry-red convertible at a drive-in movie under the stars | wide view from outside the open-top car, the giant drive-in screen behind |
| 98 | Last-Round Rita | Last-Round Rita: slamming down an empty shot glass on a dusty saloon bar like a gunslinger drawing | Spaghetti western extreme close-up film still | Desert ochre, closing-time red, dust brown | poncho | dusty saloon bar | extreme close-up |
| 99 | One-Night Otto | One-Night Otto: in a striped tie climbing out of a hotel window by a rope of knotted bedsheets | 1960s caper movie title-sequence flat graphic illustration | Caper orange, black, moon white | room key | cut-paper hotel window and crescent moon | diagonal escape |
| 101 | Repo Ted | Repo Ted: in a hi-vis vest and cap hooking a tiny toy car onto his toy tow truck | 1980s toy commercial VHS freeze-frame | Toy primary yellow, tow-truck orange, VHS blue | tow hook | bright plastic playset | toy's-eye level |
| 102 | Loan-Shark Larry | Loan-Shark Larry: wearing a shark-fin hat and a pinstripe suit | Public aquarium photograph through glass | Aquarium blue, caustic white, pinstripe grey | gold tooth | office with a giant shark-tank wall | across the desk |
| 103 | Off-the-Grid Greg | Off-the-Grid Greg: a twitchy sand-beige plush teddy bear wrapped in tinfoil with a tinfoil hat, ripping a phone cord out of a wall with both paws | Harsh on-camera flash photograph of a conspiracy corkboard wall | Tinfoil silver, string red, corkboard tan | coiled phone cord | conspiracy corkboard with red string and maps | close and slightly overhead |
| 104 | Unhinged Cuddles | Unhinged Cuddles: a bubblegum-pink plush teddy bear with a too-wide stitched grin and wide staring button eyes, arms flung open for a hug | 1980s horror VHS cover painting | Bubblegum pink, horror green, black | too-wide stitched grin | dark hallway | lunging toward the lens |
| 105 | Whiskey Whiskers | Whiskey Whiskers has whiskers literally soaked in whiskey | scrimshaw engraving on whale-bone ivory | bone ivory, scrimshaw ink black, whiskey amber | a gigantic curling handlebar moustache dripping whiskey | a ship's porthole and a tiny whiskey cask | tight bust portrait, the moustache spanning the full width of the frame |
| 106 | Landlord Lucifur | Landlord Lucifur is the landlord from hell: horns, pitchfork and the keys to every flat | Chicano airbrush mural art | lava red, marigold orange, turquoise | an enormous ring of brass apartment keys | the doorway of a sun-baked pink apartment block with tiny plush tenants on the balconies above | tight low-angle close-up portrait, horns, grin and key ring filling the frame |
| 108 | Void Where Prohibited | Void Where Prohibited: a matte void-black plush teddy bear dissolving into TV static and corrupted pixels at the edges, hollow glowing white eye sockets | Glitch art | RGB glitch magenta, cyan, void black | glowing white eye sockets | black void | front-on |
| 109 | Door-Staff Donna | Door-Staff Donna: a tall jet-black plush teddy bear in a puffer jacket with a headset, holding a club door shut with one paw and an unimpressed stare | Cyberpunk rain-soaked neon street photograph | Neon teal, signal red | headset | rain-soaked club door | low by the door |
| ck-chuck | Chuck | Chuck: leaning on his bar with a gentle half-lidded smile, bar towel over one shoulder | 17th-century Dutch tavern genre painting | Tavern umber, ale gold, Chuck's teal | tankards | rowdy 17th-century tavern of plush regulars | across the bar |
| ck-closing | Closing-Time Chuck | Closing-Time Chuck: heaving a huge brass last-orders bell like a heroic worker | 1930s public-works mural painting | Mural brick red, brass, Chuck's teal | huge brass bell | mural geometry and a wall clock | heroic low front |
| ck-offduty | Off-Duty Chuck | Off-Duty Chuck: lounging on a pool float, shirt half off one shoulder, sunglasses pushed up | 1960s Californian swimming-pool painting | Pool turquoise, sun white, Chuck's teal | confiscated bottle | modernist house and turquoise pool | poolside eye level |
| ck-rita | Regular Rita | Regular Rita is such a regular that her stool is stitched into the pub's sampler | hand-stitched cross-stitch sampler | thread teal, cherry red, linen white | her own reserved bar stool with a blank brass plaque | a cosy stitched pub corner with a dartboard and empty stools | centred sampler composition inside an oval hoop |
| ck-tabitha | Tabitha | Tabitha keeps the bar tab, and she is made of the receipt | paper quilling art | receipt white, burgundy, gold foil | an endless bar-tab receipt curling out of her paws | a pale paper backdrop of spiralling quilled receipt paper | top-down flat-lay, the bear centred |
| hd-sash | Sash-Snatch Sue | Sash-Snatch Sue: sprinting across a rugby pitch like a try-scorer | Sports action photograph | Pitch green, floodlight white, satin pink | stolen pink satin bride sashes | floodlit rugby pitch | telephoto, frozen motion |
| hd-veil | Veil of Bad Ideas | Veil of Bad Ideas: drifting through a moonlit garden of lilies with a tiny sheer veil perched on her round bear ears | Romantic Victorian painting in the medieval-revival style | Lavender, moss green, moonlit silver | antique hotel key | moonlit lily garden | seated waist-up |
| hd-chorus | Chorus of Yes | Chorus of Yes: a ring of identical plush teddy showgirls kicking in unison, seen from directly above | 1930s Hollywood kaleidoscope musical overhead shot | Coral, silver, film black | mirrored dance floor | kaleidoscope stage from above | straight down overhead |
| hd-shot | Shot-Glass Shannon | Shot-Glass Shannon: tossing back a shot while the liquid explodes around her head in a frozen crown splash | High-speed liquid splash studio photograph | Tangerine, liquid gold, jet black | shot glass | pure black studio | close, centred |
| hd-lap | Lap-Line Lola | Lap-Line Lola: kicking off a satin slipper as a crowd of plush teddy courtiers in powdered wigs gasp behind their fans | Rococo pastel painting | Rose gold, powder blue, cream | gilded swing | powder-blue garden with teddy courtiers | low, looking up at the swing, the bear filling the upper frame |
| hd-bree | Bridesmaid Bree | Bridesmaid Bree: in an enormous puffed-sleeve satin bridesmaid dress striking a dramatic pose on top of a reception table | 1980s prom photograph | Seafoam, laser purple, cerulean blue | bouquet | laser prom backdrop | full figure, low |
| hd-honour | Maid of Honour | Maid of Honour: in a maid's apron and crooked tiara lying face down negotiating with an ornate carpet | Dutch blue-and-white delftware tile painting | Cobalt blue, glaze white, pale yellow | empty glass | tiled cobalt carpet and sky | floor level |
| hd-petra | Private-Dance Petra | Private-Dance Petra: peeking around a heavy gold-patterned curtain with a silk sleep mask pushed up on her brow | Vienna Secession gold-leaf painting | Gold leaf, copper, emerald | gold-spiral curtain | gold-leaf mosaic wall | close at the curtain edge |
| hd-bride | The Bride Says So | The Bride Says So: bride sitting bolt upright on a carved throne at the head table | Tudor royal state portrait | Pearl white, Tudor black, ruby red | ruff | carved gilt throne on black | frontal state pose |
| hd-luxe | Last-Dance Luxe | Last-Dance Luxe: taking an encore bow on a stage | Arena concert photograph | Platinum, spotlight violet, lighter amber | sequin gown | arena stage over a teddy crowd | wide from the pit |
| lo-velvet-rope | Velvet Rope Vera | Velvet Rope Vera: with a knowing smirk leaning close to the peephole on the other side of a door | Door peephole fisheye photograph | Emerald, brass, hallway shadow | velvet rope | dim hotel hallway | peephole fisheye |
| lo-two-for-one | Two-for-One Tess | Two-for-One Tess: winking and pushing two cocktails forward | Pop art silkscreen repeated grid | Peach, acid yellow, cyan | two cocktails with umbrellas | four-panel halftone grid | front-on, repeated |
| lo-last-pour | Last Pour Lola | Last Pour Lola: bowling a full cocktail down a long polished bowling lane like a bowling ball | 1950s atomic-age bowling alley photograph | Lane maple, atomic turquoise, copper | cocktail shaker | 50s bowling alley with boomerang murals | low down the lane |
| lo-on-the-house | On the House Hope | On the House Hope: sitting on the roof of a little isometric pub house offering a free drink up to the viewer | Isometric pixel art | Sky blue, terracotta roof, grass green | frothy pint | isometric floating pub island | isometric |
| lo-firm-hand | Firm Hand Frankie | Firm Hand Frankie: sealed in a toy blister pack | Action-figure blister-pack toy photograph | Charcoal, toy-box red, hazard yellow | black tee | striped blank toy card | front-on packshot |
| lo-sorry-mate | Sorry Mate Mack | Sorry Mate Mack: with a guilty grin apologising with his paws together to a giant saguaro cactus that has a pair of plush legs sticking out of it | Modernist desert painting | Desert sand, cactus sage, sunset coral | paws pressed together | desert with bones and mesas | wide, still |
| lo-lights-down | Lights-Down Dana | Lights-Down Dana: swinging a plush paw in a sudden power cut | 1950s science-fiction movie poster painting | Radioactive green, deep space navy, saucer silver | saucers overhead | dark bar under a starry sky | low heroic |
| lo-cut-the-line | Cut-the-Line Cole | Cut-the-Line Cole: smirking as he snips a velvet rope with giant bolt cutters | 1970s heist movie split-screen | Slate blue, burnt orange, avocado | giant bolt cutters | 70s club carpet and curtains | split-screen stack |
| lo-still-standing | Still Standing Sal | Still Standing Sal: standing in a boxing ring surrounded by knocked-out plush teddy bears | German Expressionist painting | Teal, blood orange, ring-canvas ivory | plaster | boxing ring with orange ropes | low in the ring |
| lo-owners-round | The Owner's Round | The Owner's Round: the owner flashes the wallet and the round is on him | high-key luxury advertising photograph | platinum, pure white, jet black | a fat wallet fanned open with cash | a white seamless studio with a tray of champagne coupes | eye-level advert, the bear on the left, the tray on the right |
| ma-1 | Heels-in-Hand Holly | Heels-in-Hand Holly: in an open coat limping over cobblestones at dawn with her stilettos dangling from one paw | Neo-impressionist pointillism painting | Lilac, dawn apricot, cobblestone grey | open coat | cobbled street at dawn | full figure walking |
| ma-2 | Sent-at-3am Tess | Sent-at-3am Tess: in bed at 3am wincing at her own glowing phone screen | Phone front-camera selfie | Cobalt blue, screen-glow cyan | glowing phone | dark bedroom | close selfie angle |
| ma-3 | Sauce-Stain Sam | Sauce-Stain Sam: covered in chilli sauce stains holding a kebab with a hopeful grin | Backlit takeaway menu photograph | Chilli red, lightbox white, lettuce green | loaded kebab wrap | glowing white lightbox | straight-on menu shot |
| ma-4 | Cab-of-Shame Cara | Cab-of-Shame Cara: the ride home in shame, asleep against the window of a red Hong Kong cab | 1990s Hong Kong film still | Plum rose, taxi red, neon smear green | a glitter heel dangling from one toe | back seat of a red Hong Kong cab streaking through Mong Kok neon | step-printed motion |
| ma-5 | Kebab Aristotle | Kebab Aristotle: in a toga lecturing a small crowd of plush teddy bears with a kebab skewer raised like a philosopher's pointer | Ancient Greek red-figure vase painting | Terracotta orange, glaze black | kebab skewer | black glaze with meander bands | frieze side-on |
| ma-6 | Blackout Brunch | Blackout Brunch: squinting into the sun over a brunch table, wearing someone else's oversized shirt | Overexposed overhead brunch flat-lay photograph | Hollandaise yellow, tomato red, marble white | croissant | white marble brunch table | overhead |
| ma-7 | Still-Warm Stella | Still-Warm Stella: sitting up in rumpled white sheets in a quiet room | Dutch Golden Age interior painting | Terracotta, ultramarine, soft window cream | white sheets | quiet room with a window and blue jar | seated in bed |
| xm-desk | Under-Desk Uma | Under-Desk Uma: button eyes glowing white with infrared eyeshine as she stares up into the lens | grainy night-vision security-camera still | phosphor green, deep black, infrared white | a kicked-off stiletto | the kneehole under an office desk in a dark open-plan office after hours, stuffed toy is the only figure | close medium shot from a wall-mounted security camera looking down into the kneehole, the bear fills the middle of the frame |
| xm-reply | Reply-All Rita | Reply-All Rita: paws to her cheeks in horror as her laptop blasts out a radial burst of blank envelopes | bold Swiss-modernist cut-paper collage poster | blinding paper white, toner black, one alarm-red dot | an open laptop with one red notification dot | a flat paper-cut poster field of exploding envelopes, stuffed toy is the only figure | straight-on and symmetrical, the bear dead centre |
| xm-ozzy | Open-Bar Ozzy | Open-Bar Ozzy: the bar is open, and so is Ozzy | 1960s psychedelic concert poster art | acid orange, electric purple, lime | a brimming goblet raised in each paw | an endless open bar of gushing beer taps melting into swirls | symmetrical front view, the bear centred and big |
| xm-holly | HR Holly | HR Holly: a holly-leaf-green stuffed teddy bear toy pointing one plush paw straight at the viewer like a recruitment poster, clipboard under her arm | 1950s mid-century corporate safety-poster illustration | mint teal, coral red, cream | clipboard | a flat poster field with a coral and cream sunburst, stuffed toy is the only figure | straight-on, leaning toward the viewer, paw foreshortened |
| xm-nog | Eggnog Eddie | Eggnog Eddie: wallowing waist-deep and blissful in a giant cut-glass punchbowl of frothy eggnog | handmade stop-motion animation still | butter yellow, custard cream, cinnamon | a ladle | a pastel miniature kitchen set with fairy lights, stuffed toy is the only figure | high three-quarter overhead into the punchbowl |
| xm-elf | Clocked-Out Elf | Clocked-Out Elf: a cream-tan stuffed teddy bear toy finally off the clock, a punch card clenched in his teeth | 1980s synthwave airbrush art | hot magenta, electric cyan, violet chrome | punch card in his teeth | a neon laser-grid dance floor under a striped synthwave sunset, stuffed toy is the only figure | low hero angle, full figure mid-dance |
| xm-secret | Secret Santa Stan | Secret Santa Stan: a stuffed teddy bear toy in a tiny trench coat, fedora and round dark sunglasses | 1940s black-and-white film-noir still | black-and-white monochrome, a single blood-red ribbon | a bottle-shaped gift with the only colour in frame | a dim detective office desk with a rotary phone and an ashtray, stuffed toy is the only figure | tight dutch-angle close-up across the desk |
| xm-mistletoe | Mistletoe Mandy | Mistletoe Mandy: with long lashes holding a mistletoe sprig high and planting a big smooch on a startled smaller honey-coloured adult stuffed teddy | 1960s pop-art romance comic panel | primary red, lemon yellow, cyan halftone dots | a mistletoe sprig held overhead | a comic-panel burst of halftone and hearts, only stuffed toys in frame | melodramatic close two-shot |
| xm-list | The Naughty List | The Naughty List: an ink-black stuffed teddy bear toy with a silver muzzle and tiny gold spectacles at a scriptorium lectern, quill in paw | medieval illuminated manuscript miniature | lapis-lazuli blue, burnished gold leaf, vermilion | a quill | a gothic scriptorium inside an illuminated border of holly vines and gold filigree, stuffed toy is the only figure | frontal miniature, the bear large in the upper middle |
| xm-santa | Sleazy Santa | Sleazy Santa: reclining on a round shag-carpet lounge bed | 1970s black-velvet blacklight painting | glowing electric orange, hot red, gold | cigar | a shag-carpet lounge bed on black velvet, stuffed toy is the only figure | low reclining three-quarter view |
