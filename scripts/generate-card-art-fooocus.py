#!/usr/bin/env python3
"""Generate Terrible Teddies art on a local Fooocus install.

Python dependency: requests. Nothing else. Resize and WebP/PNG/JPEG conversion
use the repo's sharp (npm install), called from this script.

Fooocus-API:

    POST {base}/v1/generation/text-to-image
    base defaults to http://127.0.0.1:8888

    python3 scripts/generate-card-art-fooocus.py --base-url http://127.0.0.1:8888 --force

Reads art/fooocus-manifest.json and every art/fooocus-manifest.d/*.json.
An entry whose output files already exist is skipped, unless --force.
When the primary file exists and a derived size does not, the derived size
is resized from the primary and Fooocus is not called.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BASE = "http://127.0.0.1:8888"
ENDPOINT = "/v1/generation/text-to-image"

FINISH = r"""
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const require = createRequire(process.argv[2]);
const sharp = require('sharp');
const jobs = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const src = process.argv[4];

const icoWrap = (png, size) => {
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(1, 4);
  const dim = size >= 256 ? 0 : size;
  head.writeUInt8(dim, 6);
  head.writeUInt8(dim, 7);
  head.writeUInt16LE(1, 10);
  head.writeUInt16LE(32, 12);
  head.writeUInt32LE(png.length, 14);
  head.writeUInt32LE(22, 18);
  return Buffer.concat([head, png]);
};

for (const job of jobs) {
  mkdirSync(dirname(job.path), { recursive: true });
  const inset = Number(job.inset || 1);
  const width = job.width;
  const height = job.height;
  const innerW = Math.max(1, Math.round(width * inset));
  const innerH = Math.max(1, Math.round(height * inset));
  let pipeline = sharp(src).resize(innerW, innerH, { fit: 'cover', position: 'attention' });
  if (inset < 1) {
    pipeline = pipeline.extend({
      top: Math.floor((height - innerH) / 2),
      bottom: Math.ceil((height - innerH) / 2),
      left: Math.floor((width - innerW) / 2),
      right: Math.ceil((width - innerW) / 2),
      background: job.background || '#100e0c',
    });
  }
  const format = String(job.format || 'webp').toLowerCase();
  if (format === 'ico') {
    const png = await pipeline.png().toBuffer();
    writeFileSync(job.path, icoWrap(png, width));
    continue;
  }
  if (format === 'png') pipeline = pipeline.png();
  else if (format === 'jpeg' || format === 'jpg') pipeline = pipeline.jpeg({ quality: job.quality || 82 });
  else pipeline = pipeline.webp({ quality: job.quality || 80 });
  await pipeline.toFile(job.path);
}
"""


def load_json(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return {"cards": data}
    if not isinstance(data, dict) or not isinstance(data.get("cards"), list):
        raise SystemExit(f"{path} must be a list or an object with a cards array")
    return data


def load_entries(manifest: Path, directory: Path):
    main = load_json(manifest)
    entries = list(main["cards"])
    style = main.get("style_prefix") or {}
    negative = main.get("negative_prompt") or ""
    if directory.is_dir():
        for path in sorted(directory.glob("*.json")):
            extra = load_json(path)
            entries.extend(extra["cards"])
            if isinstance(extra.get("style_prefix"), dict):
                style = {**style, **extra["style_prefix"]}
            if extra.get("negative_prompt"):
                negative = extra["negative_prompt"]
    seen = set()
    for entry in entries:
        ident = str(entry.get("id", ""))
        if not ident:
            raise SystemExit("a manifest entry is missing id")
        if ident in seen:
            raise SystemExit(f"duplicate manifest id {ident}")
        seen.add(ident)
    return entries, style, negative


def prompt_for(entry, style):
    prompt = str(entry.get("prompt") or "").strip()
    if not prompt:
        raise SystemExit(f"{entry.get('id')}: missing prompt")
    key = entry.get("prefix")
    prefix = style.get(key, "") if isinstance(style, dict) else ""
    if prefix and not prompt.startswith(prefix):
        return f"{prefix}, {prompt}"
    return prompt


def outputs_for(entry):
    outs = entry.get("outputs")
    if isinstance(outs, list) and outs:
        return outs
    path = entry.get("path")
    if not path:
        raise SystemExit(f"{entry.get('id')}: missing path")
    ext = Path(path).suffix.lower().lstrip(".")
    fmt = "jpeg" if ext in ("jpg", "jpeg") else (ext or "webp")
    return [{
        "path": path,
        "width": entry.get("width") or 768,
        "height": entry.get("height") or 1024,
        "format": fmt,
    }]


def http():
    import requests
    return requests


def image_bytes(payload, base):
    data = payload
    if isinstance(data, dict) and isinstance(data.get("images"), list):
        data = data["images"]
    first = data[0] if isinstance(data, list) else data
    url = None
    blob = first
    if isinstance(first, dict):
        blob = first.get("base64") or first.get("image")
        url = first.get("url")
    if isinstance(blob, str) and blob.startswith("http"):
        url = blob
        blob = None
    if isinstance(blob, str) and len(blob) > 100:
        if blob.startswith("data:"):
            blob = blob.split(",", 1)[1]
        return base64.b64decode(blob)
    if url:
        got = http().get(url, timeout=120)
        got.raise_for_status()
        return got.content
    reason = first.get("finish_reason") if isinstance(first, dict) else "unknown"
    raise RuntimeError(f"Fooocus returned no image ({reason})")


def call_fooocus(base, entry, prompt):
    url = base.rstrip("/") + ENDPOINT
    body = {
        "prompt": prompt,
        "negative_prompt": entry.get("negative_prompt") or "",
        "style_selections": ["Fooocus V2", "Fooocus Sharp"],
        "performance_selection": entry.get("performance") or "Speed",
        "aspect_ratios_selection": entry["aspect_ratio"],
        "image_number": 1,
        "image_seed": entry.get("seed", -1),
        "require_base64": True,
        "async_process": False,
    }
    res = http().post(url, json=body, timeout=600)
    if not res.ok:
        raise RuntimeError(f"Fooocus-API {res.status_code}: {res.text[:300]}")
    return image_bytes(res.json(), base)


def finish(src: Path, jobs):
    if not jobs:
        return
    with tempfile.TemporaryDirectory() as tmp:
        script = Path(tmp) / "finish.mjs"
        spec = Path(tmp) / "jobs.json"
        script.write_text(FINISH, encoding="utf-8")
        spec.write_text(json.dumps(jobs), encoding="utf-8")
        subprocess.run(
            ["node", str(script), str(ROOT / "package.json"), str(spec), str(src)],
            cwd=ROOT,
            check=True,
        )


def main():
    parser = argparse.ArgumentParser(description="Generate card and brand art with local Fooocus")
    parser.add_argument("--base-url", default=os.environ.get("FOOOCUS_URL", DEFAULT_BASE))
    parser.add_argument("--manifest", default=str(ROOT / "art" / "fooocus-manifest.json"))
    parser.add_argument("--manifest-dir", default=str(ROOT / "art" / "fooocus-manifest.d"))
    parser.add_argument("--only", default="", help="comma-separated ids")
    parser.add_argument("--force", action="store_true", help="regenerate even when the files exist")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    entries, style, default_negative = load_entries(Path(args.manifest), Path(args.manifest_dir))
    only = {part.strip() for part in args.only.split(",") if part.strip()}
    if only:
        entries = [entry for entry in entries if str(entry["id"]) in only]

    done = skipped = failed = 0
    for entry in entries:
        ident = str(entry["id"])
        entry.setdefault("negative_prompt", default_negative)
        outs = outputs_for(entry)
        for out in outs:
            if ".." in Path(out["path"]).parts or out["path"].startswith(("/", "\\")):
                raise SystemExit(f"{ident}: output path must stay inside the repo ({out['path']})")
        missing = [out for out in outs if not (ROOT / out["path"]).exists()]
        primary = ROOT / entry["path"]
        if args.dry_run:
            state = "missing" if missing else "present"
            print(f"{ident}\t{entry.get('type')}\t{entry.get('aspect_ratio')}\t{entry['path']}\t{state}")
            continue
        if not missing and not args.force:
            skipped += 1
            print(f"skip {ident} (exists)")
            continue
        src = None
        owns_src = False
        try:
            if args.force or not primary.exists():
                raw = call_fooocus(args.base_url, entry, prompt_for(entry, style))
                with tempfile.NamedTemporaryFile(suffix=".img", delete=False) as handle:
                    handle.write(raw)
                    src = Path(handle.name)
                owns_src = True
                targets = outs if args.force else missing
            else:
                src = primary
                targets = missing
            absolute = []
            for out in targets:
                job = dict(out)
                job["path"] = str(ROOT / out["path"])
                absolute.append(job)
            finish(src, absolute)
            done += 1
            print(f"wrote {ident} -> {entry['path']}")
        except (subprocess.CalledProcessError, RuntimeError, OSError) as err:
            failed += 1
            print(f"failed {ident}: {err}", file=sys.stderr)
            if failed >= 3 and done == 0:
                print("First three calls failed. Check that Fooocus-API is running.", file=sys.stderr)
                break
        finally:
            if owns_src and src is not None:
                src.unlink(missing_ok=True)

    if args.dry_run:
        print(f"{len(entries)} assets")
        return
    print(f"{done} generated, {skipped} skipped, {failed} failed")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
