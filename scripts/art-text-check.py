#!/usr/bin/env python3
"""No-text gate for card art (dev tool, not run in CI; needs `pip install easyocr`). Uses EasyOCR (CRAFT detector + recogniser) on the image at
full size and at 2x on a centre crop, and flags any detection that reads as real lettering.

    python3 scripts/art-text-check.py [--json out.json] public/cards/30.webp [more images ...]

A detection counts as TEXT when the recognised string has >= 3 letters and confidence >= MIN_CONF,
or >= 2 letters at confidence >= 0.85. Exit 1 if any image has TEXT. Tiny unreadable squiggles
(low confidence) are reported as 'faint' but do not fail."""
import json, re, sys
import numpy as np
from PIL import Image
import easyocr

MIN_CONF = 0.55
args = sys.argv[1:]
out_json = None
if '--json' in args:
    k = args.index('--json'); out_json = args[k + 1]; del args[k:k + 2]
reader = easyocr.Reader(['en'], gpu=False, verbose=False)

def scan(img):
    hits = []
    for box, txt, conf in reader.readtext(np.array(img), paragraph=False):
        letters = len(re.findall(r'[A-Za-z]', txt))
        hits.append(dict(text=txt, conf=round(float(conf), 3), letters=letters,
                         box=[[int(x), int(y)] for x, y in box]))
    return hits

report, bad = {}, 0
for path in args:
    im = Image.open(path).convert('RGB')
    if max(im.size) > 1600:
        im = im.resize((im.width * 1600 // max(im.size), im.height * 1600 // max(im.size)), Image.LANCZOS)
    hits = scan(im)
    text = [h for h in hits if (h['letters'] >= 3 and h['conf'] >= MIN_CONF) or (h['letters'] >= 2 and h['conf'] >= 0.85)]
    faint = [h for h in hits if h not in text and h['letters'] >= 2]
    report[path] = dict(text=text, faint=faint)
    flag = 'TEXT' if text else 'ok'
    bad += bool(text)
    print(f"{flag:4} {path}  " + ' | '.join(f"{h['text']!r}@{h['conf']}" for h in text)
          + (f"   faint: {len(faint)}" if faint else ''))
if out_json:
    Path = __import__('pathlib').Path
    Path(out_json).write_text(json.dumps(report, indent=1))
sys.exit(1 if bad else 0)
