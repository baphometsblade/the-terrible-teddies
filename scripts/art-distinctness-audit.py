#!/usr/bin/env python3
"""Art distinctness audit (dev tool, not run in CI).

Builds an in-app card-size contact sheet (TeddyCard 96x144 CSS px at 2x, metal
frame, top and bottom scrims, name) and a thumbnail grid of every bear, then
scores every pair: 0.6 x CLIP ViT-B-32 image cosine + 0.25 x HSV colour
histogram Bhattacharyya + 0.15 x pHash similarity. Also ranks each bear's own
art against its signature text with CLIP.

    pip install torch open_clip_torch imagehash pillow numpy
    python3 scripts/art-distinctness-audit.py . <out-dir> [overrides.json]

overrides.json maps a bear id to a candidate image path, for scoring a redo
before it ships.
"""
import json, sys, itertools, os
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

REPO = Path(sys.argv[1]); OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
override = {}  # id -> path of candidate art (for "after" runs)
if len(sys.argv) > 3:
    override = json.loads(Path(sys.argv[3]).read_text())
bib = json.loads((REPO/'art/bear-bibles.json').read_text())['bears']
names = {}
for f in [REPO/'art/fooocus-manifest.json', *sorted((REPO/'art/fooocus-manifest.d').glob('*.json'))]:
    d = json.loads(f.read_text()); rows = d['cards'] if isinstance(d, dict) else d
    for r in rows:
        if r.get('name'): names[r['id']] = r['name']
for k, b in bib.items():
    if k not in names: names[k] = b['gag'].split(',')[0].strip()
ids = list(bib.keys())

def full(i):
    return Image.open(override.get(i) or REPO/f'public/cards/{i}.webp').convert('RGB')

try:
    FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
    SMALL = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
except OSError:
    FONT = SMALL = ImageFont.load_default()

def grad(h, w, top_alpha, bottom_alpha):
    a = np.linspace(top_alpha, bottom_alpha, h)[:, None].repeat(w, 1)
    return Image.fromarray((a*255).astype('uint8'), 'L')

def in_app_card(i, scale=2):
    """TeddyCard w-24 h-36 (96x144 CSS px) at 2x: 2px metal border, full-bleed cover art,
    h-9 top scrim (black/80 -> transparent), 62px bottom scrim (black/95 -> transparent), name."""
    W, H = 96*scale, 144*scale
    card = Image.new('RGB', (W, H), (16, 14, 12))
    art = full(i)
    # object-cover into the inner box
    iw, ih = W-4*scale, H-4*scale
    r = max(iw/art.width, ih/art.height)
    a = art.resize((round(art.width*r), round(art.height*r)), Image.LANCZOS)
    l = (a.width-iw)//2; t = (a.height-ih)//2
    a = a.crop((l, t, l+iw, t+ih))
    black = Image.new('RGB', a.size, (0, 0, 0))
    top = Image.new('L', a.size, 0); top.paste(grad(36*scale, iw, .8, 0), (0, 0))
    a = Image.composite(black, a, top)
    bot = Image.new('L', a.size, 0); bot.paste(grad(62*scale, iw, 0, .95), (0, ih-62*scale))
    a = Image.composite(black, a, bot)
    card.paste(a, (2*scale, 2*scale))
    d = ImageDraw.Draw(card)
    d.rounded_rectangle([0, 0, W-1, H-1], radius=10*scale, outline=(201, 162, 39), width=2*scale)
    # name, two lines max
    words = names[i].split(); lines = ['']
    for w in words:
        if d.textlength((lines[-1]+' '+w).strip(), font=FONT) > W-12*scale and lines[-1]: lines.append(w)
        else: lines[-1] = (lines[-1]+' '+w).strip()
    for n, line in enumerate(lines[:2]):
        d.text((6*scale, 4*scale+n*16), line, font=FONT, fill=(245, 230, 200))
    mask = Image.new('L', (W, H), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, W-1, H-1], radius=10*scale, fill=255)
    bg = Image.new('RGB', (W, H), (30, 26, 22)); bg.paste(card, (0, 0), mask)
    return bg

def sheet(tiles, cols, label_fn, path, pad=8, label_h=16):
    w, h = tiles[0][1].size
    rows = (len(tiles)+cols-1)//cols
    S = Image.new('RGB', (cols*(w+pad)+pad, rows*(h+pad+label_h)+pad), (24, 22, 20))
    d = ImageDraw.Draw(S)
    for n, (i, t) in enumerate(tiles):
        x = pad+(n % cols)*(w+pad); y = pad+(n//cols)*(h+pad+label_h)
        S.paste(t, (x, y)); d.text((x, y+h+1), label_fn(i)[:int(w/7)], font=SMALL, fill=(200, 200, 200))
    S.save(path, quality=88)

cards = [(i, in_app_card(i)) for i in ids]
sheet(cards, 13, lambda i: i, OUT/'in-app-sheet.jpg')
thumbs = [(i, full(i).resize((144, 192), Image.LANCZOS)) for i in ids]
sheet(thumbs, 13, lambda i: f'{i} {names[i]}', OUT/'thumb-grid.jpg', label_h=16)

# --- similarity ---
import torch, open_clip, imagehash
model, _, pre = open_clip.create_model_and_transforms('ViT-B-32', pretrained='laion2b_s34b_b79k')
model.eval()
with torch.no_grad():
    emb = torch.cat([model.encode_image(pre(full(i)).unsqueeze(0)) for i in ids])
    emb = emb/emb.norm(dim=-1, keepdim=True)
clip = (emb@emb.T).numpy()
ph = [imagehash.phash(full(i)) for i in ids]
def hist(i):
    hsv = np.asarray(full(i).resize((128, 170)).convert('HSV')).reshape(-1, 3)
    h, _ = np.histogramdd(hsv, bins=(12, 4, 4), range=((0, 256),)*3)
    h = h.flatten(); return h/h.sum()
hs = [hist(i) for i in ids]
n = len(ids); pairs = []
for a, b in itertools.combinations(range(n), 2):
    p = 1-(ph[a]-ph[b])/64
    c = float(np.sum(np.sqrt(hs[a]*hs[b])))  # Bhattacharyya coefficient
    combo = 0.6*clip[a, b]+0.25*c+0.15*p
    pairs.append(dict(a=ids[a], b=ids[b], an=names[ids[a]], bn=names[ids[b]], clip=round(float(clip[a, b]), 4),
                      colour=round(c, 4), phash=round(p, 4), combined=round(float(combo), 4)))
pairs.sort(key=lambda r: -r['combined'])
per = {}
for r in pairs:
    for k, o in (('a', 'b'), ('b', 'a')):
        if r[k] not in per or per[r[k]]['combined'] < r['combined']:
            per[r[k]] = dict(nearest=r[o], **{x: r[x] for x in ('clip', 'colour', 'phash', 'combined')})
# name readability: CLIP text-image score of "a picture of <gag>" vs the bear's own art rank
tok = open_clip.get_tokenizer('ViT-B-32')
with torch.no_grad():
    tx = model.encode_text(tok([f"{bib[i]['render'].split(',')[0]}, {bib[i]['gag'][:200]}" for i in ids]))
    tx = tx/tx.norm(dim=-1, keepdim=True)
ti = (emb@tx.T).numpy()  # image x text
rank = {ids[k]: int((ti[:, k] > ti[k, k]).sum())+1 for k in range(n)}  # rank of own image among all for own text
res = dict(pairs_top=pairs[:60], per_bear=per, text_rank=rank,
           stats=dict(max_combined=pairs[0]['combined'], mean_top20=float(np.mean([p['combined'] for p in pairs[:20]])),
                      max_clip=float(max(p['clip'] for p in pairs))))
(OUT/'similarity.json').write_text(json.dumps(res, indent=1))
np.save(OUT/'clip.npy', emb.numpy())
for r in pairs[:25]:
    print(f"{r['combined']:.3f} clip {r['clip']:.3f} col {r['colour']:.3f} ph {r['phash']:.2f}  {r['a']} {r['an']}  <>  {r['b']} {r['bn']}")
print('worst text ranks', sorted(rank.items(), key=lambda kv: -kv[1])[:20])
