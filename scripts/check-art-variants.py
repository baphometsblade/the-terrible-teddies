"""Quality gate for the card art variants (scripts/lib/card-art-variants.mjs).

Scores every shipped thumb and mid file against a lossless resize of its
master with SSIMULACRA2, a perceptual metric (90 and up: visually lossless
at 1:1; 80: very high quality; 70: high quality). The bars:

  thumb-avif  at least as faithful as the WebP thumb it stands in for, or
              >= 80 where that WebP was better than 80
  mid-webp    >= 80
  mid-avif    >= 80

A picture that misses its bar is listed with the quality to put in
QUALITY_OVERRIDES, found by re-encoding it up the ladder until it passes.

    pip install ssimulacra2 pillow numpy
    npm run art:quality                     # every card
    npm run art:quality -- --only 51,ma-3   # some
    npm run art:quality -- --report art/variant-quality.json
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BAR = 80.0
LADDER = (65, 70, 75, 80, 85, 90, 95)

RE_ENCODE = r"""
import { createRequire } from 'node:module';
const require = createRequire(process.argv[2]);
const sharp = require('sharp');
const [, , , ref, format, quality, out] = process.argv;
const q = Number(quality);
const img = sharp(ref);
const buf = format === 'avif' ? await img.avif({ quality: q, effort: 6, chromaSubsampling: '4:2:0' }).toBuffer() : await img.webp({ quality: q, effort: 6 }).toBuffer();
await sharp(buf).png().toFile(out);
process.stdout.write(String(buf.length));
"""


def score(pair):
    from ssimulacra2 import compute_ssimulacra2

    ref, dist = pair
    return compute_ssimulacra2(ref, dist)


def bar_for(row, by_key):
    if row["variant"] == "thumb-avif":
        webp = by_key.get((row["id"], "thumb-webp"))
        shipped = webp["score"] if webp and webp.get("score") is not None else BAR
        return min(shipped, BAR)
    if row["variant"] in ("mid-webp", "mid-avif"):
        return BAR
    return None


def suggest(row, tmp):
    script = Path(tmp) / "re-encode.mjs"
    script.write_text(RE_ENCODE, encoding="utf-8")
    fmt = row["variant"].split("-")[1]
    for q in LADDER:
        out = Path(tmp) / f"{row['id']}-{row['variant']}-q{q}.png"
        size = subprocess.run(
            ["node", str(script), str(ROOT / "package.json"), row["ref"], fmt, str(q), str(out)],
            cwd=ROOT, check=True, capture_output=True, text=True,
        ).stdout
        if score((row["ref"], str(out))) >= row["bar"]:
            return q, int(size)
    return None, None


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", default="", help="comma-separated card ids")
    parser.add_argument("--report", help="write the scores here as JSON")
    parser.add_argument("--jobs", type=int, default=os.cpu_count() or 2)
    args = parser.parse_args(argv)
    try:
        import ssimulacra2  # noqa: F401
    except ImportError:
        raise SystemExit("needs the ssimulacra2 package: pip install ssimulacra2 pillow numpy")

    with tempfile.TemporaryDirectory() as tmp:
        cmd = ["node", str(ROOT / "scripts" / "lib" / "dump-art-variants.mjs"), tmp]
        if args.only:
            cmd.append(args.only)
        rows = json.loads(subprocess.run(cmd, cwd=ROOT, check=True, capture_output=True, text=True).stdout)
        present = [r for r in rows if r["file"]]
        with ProcessPoolExecutor(max(1, args.jobs)) as pool:
            for row, value in zip(present, pool.map(score, [(r["ref"], r["file"]) for r in present])):
                row["score"] = round(value, 2)
        by_key = {(r["id"], r["variant"]): r for r in rows}
        failures = []
        for row in rows:
            if not row["file"]:
                row["ok"] = False
                failures.append(row)
                continue
            row["bar"] = bar_for(row, by_key)
            row["ok"] = row["bar"] is None or row["score"] >= row["bar"]
            if not row["ok"]:
                failures.append(row)
        overrides = {}
        for row in failures:
            if not row["file"]:
                print(f"MISSING {row['variant']} for {row['id']} (run npm run art:thumbs)")
                continue
            q, size = suggest(row, tmp)
            row["suggested_quality"] = q
            print(f"FAIL {row['id']} {row['variant']}: {row['score']} < {row['bar']:.2f}"
                  + (f"; quality {q} passes ({size} bytes)" if q else "; no quality on the ladder passes"))
            if q:
                overrides.setdefault(row["variant"], {})[row["id"]] = q

    summary = {}
    for row in rows:
        if row.get("score") is None:
            continue
        s = summary.setdefault(row["variant"], {"files": 0, "bytes": 0, "scores": []})
        s["files"] += 1
        s["bytes"] += row["bytes"]
        s["scores"].append(row["score"])
    for name, s in sorted(summary.items()):
        sc = sorted(s["scores"])
        s.update(mean=round(sum(sc) / len(sc), 2), min=sc[0], p10=sc[len(sc) // 10])
        del s["scores"]
        print(f"{name:11s} {s['files']:4d} files {s['bytes'] / 1024:8.1f} KB  SSIMULACRA2 mean {s['mean']:6.2f}  p10 {s['p10']:6.2f}  min {s['min']:6.2f}")
    if args.report:
        clean = [{k: v for k, v in r.items() if k not in ("ref", "file")} for r in rows]
        Path(args.report).write_text(json.dumps({"bar": BAR, "summary": summary, "rows": clean}, indent=1) + "\n", encoding="utf-8")
    if overrides:
        print("QUALITY_OVERRIDES to add:", json.dumps(overrides))
    print("ok" if not failures else f"{len(failures)} below the bar")
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
