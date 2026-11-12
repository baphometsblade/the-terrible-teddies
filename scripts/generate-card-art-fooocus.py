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

This is the only image backend for the game's art. No hosted generator is
used: every plate is rendered by Fooocus-API on the art PC's own GPU
(src/artPipeline.test.js enforces it).

GPU check. When the endpoint is on this machine (loopback), the script reads
nvidia-smi before the first call and refuses to run without an NVIDIA GPU,
then samples GPU load while each render is in flight and warns when the load
never rises, which is what a CPU fallback looks like. --gpu-check require
forces the preflight for a non-loopback host; --gpu-check off skips it.

Previews. --out-root writes the outputs under another directory instead of
the repo, so a test render never touches public/:

    python3 scripts/generate-card-art-fooocus.py --only xm-desk --force \
        --out-root ../art-preview --provenance ../art-preview/xm-desk.json

--provenance records, per render: prompt, negative, styles, seed, timing,
the GPU name and its peak load, and the sha256 of every file written.

--self-test runs the whole pipeline against a built-in mock Fooocus-API
(no GPU, no network) and exits non-zero on any failure.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import ipaddress
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import threading
import time
import zlib
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

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
    # Bear prompts carry the guard after the medium and the gag (see
    # scripts/bear-bibles.mjs), so it is only added when it is missing.
    if prefix and prefix not in prompt:
        return f"{prefix}, {prompt}"
    return prompt


def normalize(entry, default_negative):
    """Accept this repo's rows and the expansion files (target + aspect)."""
    path = entry.get("path") or entry.get("target")
    aspect = entry.get("aspect_ratio") or entry.get("aspect")
    if not path or not aspect:
        raise SystemExit(f"{entry.get('id')}: needs a path and an aspect ratio")
    row = dict(entry)
    row["path"] = path
    row["aspect_ratio"] = aspect
    row.setdefault("negative_prompt", default_negative)
    if row.get("type") == "card" and not row.get("outputs"):
        plate = path
        thumb = f"public/cards/thumbs/{Path(path).stem}.webp"
        row["outputs"] = [
            {"path": plate, "width": row.get("width") or 768, "height": row.get("height") or 1024, "format": "webp"},
            {"path": thumb, "width": 192, "height": 256, "format": "webp"},
        ]
    return row


def outputs_for(entry):
    outs = entry.get("outputs")
    if isinstance(outs, list) and outs:
        return outs
    path = entry.get("path") or entry.get("target")
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
    seed = first.get("seed") if isinstance(first, dict) else None
    if isinstance(blob, str) and len(blob) > 100:
        if blob.startswith("data:"):
            blob = blob.split(",", 1)[1]
        return base64.b64decode(blob), seed
    if url:
        got = http().get(url, timeout=120)
        got.raise_for_status()
        return got.content, seed
    reason = first.get("finish_reason") if isinstance(first, dict) else "unknown"
    raise RuntimeError(f"Fooocus returned no image ({reason})")


def request_body(entry, prompt):
    body = {
        "prompt": prompt,
        "negative_prompt": entry.get("negative_prompt") or "",
        # An explicit empty list means no Fooocus style at all (no V2 expansion).
        "style_selections": entry["styles"] if isinstance(entry.get("styles"), list) else ["Fooocus V2", "Fooocus Sharp"],
        "performance_selection": entry.get("performance") or "Speed",
        "aspect_ratios_selection": entry["aspect_ratio"],
        "image_number": 1,
        "image_seed": entry.get("seed", -1),
        "require_base64": True,
        "async_process": False,
    }
    # Optional per-entry sampler knobs. Fooocus-API's defaults apply when unset.
    for key in ("guidance_scale", "sharpness", "base_model_name"):
        if entry.get(key) is not None:
            body[key] = entry[key]
    return body


def call_fooocus(base, entry, prompt):
    """POST one render. Returns (image bytes, seed Fooocus used)."""
    url = base.rstrip("/") + ENDPOINT
    body = request_body(entry, prompt)
    res = http().post(url, json=body, timeout=600)
    if not res.ok:
        raise RuntimeError(f"Fooocus-API {res.status_code}: {res.text[:300]}")
    return image_bytes(res.json(), base)


# --- GPU evidence -----------------------------------------------------------

GPU_QUERY = [
    "nvidia-smi",
    "--query-gpu=name,utilization.gpu,memory.used,memory.total",
    "--format=csv,noheader,nounits",
]
# A Fooocus render on an NVIDIA card drives it well past this; a CPU fallback
# leaves it near idle for minutes.
GPU_BUSY_PERCENT = 30


def is_loopback(base):
    host = (urlparse(base).hostname or "").strip("[]").lower()
    if host == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def gpu_snapshot():
    """Every NVIDIA GPU nvidia-smi sees, or None when there is none."""
    if not shutil.which("nvidia-smi"):
        return None
    try:
        out = subprocess.run(GPU_QUERY, capture_output=True, text=True, timeout=15, check=True).stdout
    except (subprocess.SubprocessError, OSError):
        return None
    gpus = []
    for line in out.strip().splitlines():
        parts = [part.strip() for part in line.split(",")]
        if len(parts) != 4:
            continue
        try:
            gpus.append({
                "name": parts[0],
                "util": int(float(parts[1])),
                "mem_used_mib": int(float(parts[2])),
                "mem_total_mib": int(float(parts[3])),
            })
        except ValueError:
            continue
    return gpus or None


class GpuSampler:
    """Polls nvidia-smi in the background while one render runs."""

    def __init__(self, enabled, interval=0.5):
        self.enabled = enabled
        self.interval = interval
        self.peak_util = None
        self.peak_mem = None
        self.samples = 0
        self._stop = threading.Event()
        self._thread = None

    def _run(self):
        while not self._stop.is_set():
            snap = gpu_snapshot()
            if snap:
                self.samples += 1
                util = max(gpu["util"] for gpu in snap)
                mem = max(gpu["mem_used_mib"] for gpu in snap)
                self.peak_util = util if self.peak_util is None else max(self.peak_util, util)
                self.peak_mem = mem if self.peak_mem is None else max(self.peak_mem, mem)
            self._stop.wait(self.interval)

    def __enter__(self):
        if self.enabled:
            self._thread = threading.Thread(target=self._run, daemon=True)
            self._thread.start()
        return self

    def __exit__(self, *exc):
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=20)
        return False


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


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


def resolve_out(out_root: Path, rel: str) -> Path:
    if ".." in Path(rel).parts or rel.startswith(("/", "\\")) or Path(rel).is_absolute():
        raise SystemExit(f"output path must stay inside the output root ({rel})")
    return out_root / rel


def run(args):
    entries, style, default_negative = load_entries(Path(args.manifest), Path(args.manifest_dir))
    only = {part.strip() for part in args.only.split(",") if part.strip()}
    if only:
        entries = [entry for entry in entries if str(entry["id"]) in only]
        unknown = only - {str(entry["id"]) for entry in entries}
        if unknown:
            raise SystemExit(f"unknown manifest id(s): {', '.join(sorted(unknown))}")

    out_root = Path(args.out_root).resolve() if args.out_root else ROOT
    check_gpu = args.gpu_check == "require" or (args.gpu_check == "auto" and is_loopback(args.base_url))
    gpu_name = None
    if check_gpu and not args.dry_run:
        gpus = gpu_snapshot()
        if not gpus:
            raise SystemExit(
                "No NVIDIA GPU visible to nvidia-smi. Fooocus would fall back to the CPU. "
                "Run this on the art PC, or pass --gpu-check off for a remote endpoint."
            )
        gpu_name = gpus[0]["name"]
        print(f"gpu {gpu_name}: {gpus[0]['mem_used_mib']}/{gpus[0]['mem_total_mib']} MiB in use before rendering")

    record = {
        "generator": "fooocus-api",
        "base_url": args.base_url,
        "endpoint": ENDPOINT,
        "date": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "gpu": gpu_name,
        "renders": [],
    }

    done = skipped = failed = 0
    for raw in entries:
        entry = normalize(raw, default_negative)
        ident = str(entry["id"])
        outs = outputs_for(entry)
        for out in outs:
            resolve_out(out_root, out["path"])
        missing = [out for out in outs if not resolve_out(out_root, out["path"]).exists()]
        primary = resolve_out(out_root, entry["path"])
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
            render = None
            if args.force or not primary.exists():
                prompt = prompt_for(entry, style)
                started = time.monotonic()
                with GpuSampler(check_gpu) as sampler:
                    raw_bytes, seed = call_fooocus(args.base_url, entry, prompt)
                elapsed = round(time.monotonic() - started, 2)
                with tempfile.NamedTemporaryFile(suffix=".img", delete=False) as handle:
                    handle.write(raw_bytes)
                    src = Path(handle.name)
                owns_src = True
                targets = outs if args.force else missing
                body = request_body(entry, prompt)
                render = {
                    "id": ident,
                    "prompt": prompt,
                    "negative_prompt": body["negative_prompt"],
                    "styles": body["style_selections"],
                    "performance": body["performance_selection"],
                    "aspect_ratio": body["aspect_ratios_selection"],
                    "seed": seed,
                    "elapsed_s": elapsed,
                    "gpu_peak_util": sampler.peak_util,
                    "gpu_peak_mem_mib": sampler.peak_mem,
                    "gpu_samples": sampler.samples,
                    "raw_sha256": hashlib.sha256(raw_bytes).hexdigest(),
                }
                gpu_note = ""
                if check_gpu:
                    gpu_note = f", gpu peak {sampler.peak_util}% / {sampler.peak_mem} MiB"
                    if sampler.peak_util is None or sampler.peak_util < GPU_BUSY_PERCENT:
                        print(
                            f"warning {ident}: GPU load peaked at {sampler.peak_util}% during the render. "
                            "Fooocus may be running on the CPU.",
                            file=sys.stderr,
                        )
                print(f"rendered {ident} in {elapsed}s (seed {seed}{gpu_note})")
            else:
                src = primary
                targets = missing
            absolute = []
            for out in targets:
                job = dict(out)
                job["path"] = str(resolve_out(out_root, out["path"]))
                absolute.append(job)
            finish(src, absolute)
            if render is not None:
                render["outputs"] = [
                    {"path": out["path"], "sha256": sha256_file(resolve_out(out_root, out["path"]))}
                    for out in targets
                ]
                record["renders"].append(render)
            done += 1
            print(f"wrote {ident} -> {primary}")
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
        return record
    if args.provenance:
        prov = Path(args.provenance)
        prov.parent.mkdir(parents=True, exist_ok=True)
        prov.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
        print(f"provenance -> {prov}")
    print(f"{done} generated, {skipped} skipped, {failed} failed")
    if failed:
        raise SystemExit(1)
    return record


# --- self-test --------------------------------------------------------------

def tiny_png(width=96, height=128):
    """A solid-colour RGB PNG, built by hand so the self-test needs no imaging library."""
    rows = b"".join(b"\x00" + bytes((200, 60, 120)) * width for _ in range(height))

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(rows))
        + chunk(b"IEND", b"")
    )


def self_test(args):
    from http.server import BaseHTTPRequestHandler, HTTPServer

    seen = []
    png = base64.b64encode(tiny_png()).decode()

    class Mock(BaseHTTPRequestHandler):
        def do_POST(self):  # noqa: N802 (http.server API)
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            seen.append((self.path, body))
            if self.path != ENDPOINT:
                self.send_response(404)
                self.end_headers()
                return
            payload = json.dumps([{"base64": png, "seed": 4242, "finish_reason": "SUCCESS"}]).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *_):
            pass

    server = HTTPServer(("127.0.0.1", 0), Mock)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    entries, _, _ = load_entries(Path(args.manifest), Path(args.manifest_dir))
    card = next(entry for entry in entries if entry.get("type") == "card")
    failures = []
    with tempfile.TemporaryDirectory() as tmp:
        prov_path = Path(tmp) / "prov.json"
        test_args = argparse.Namespace(**{
            **vars(args),
            "base_url": f"http://127.0.0.1:{server.server_address[1]}",
            "only": str(card["id"]),
            "force": True,
            "dry_run": False,
            "out_root": str(Path(tmp) / "out"),
            "provenance": str(prov_path),
            "gpu_check": "off",
        })
        try:
            record = run(test_args)
        except SystemExit as err:
            failures.append(f"run exited: {err}")
            record = None
        finally:
            server.shutdown()
        if len(seen) != 1:
            failures.append(f"expected 1 Fooocus call, saw {len(seen)}")
        else:
            path, body = seen[0]
            for key in ("prompt", "negative_prompt", "aspect_ratios_selection"):
                if not body.get(key):
                    failures.append(f"request is missing {key}")
            # An empty list is valid: a bear with no Fooocus preset sends none.
            if not isinstance(body.get("style_selections"), list):
                failures.append("request is missing style_selections")
            want = card.get("styles") if isinstance(card.get("styles"), list) else None
            if want is not None and body.get("style_selections") != want:
                failures.append("request did not send the entry's own styles")
            for key in ("performance", "guidance_scale"):
                if card.get(key) is not None and body.get({"performance": "performance_selection"}.get(key, key)) != card[key]:
                    failures.append(f"request did not send the entry's {key}")
            if body.get("require_base64") is not True:
                failures.append("request must ask for base64")
        if record:
            renders = record.get("renders") or []
            if len(renders) != 1 or renders[0].get("seed") != 4242:
                failures.append("provenance did not record the seed")
            outs = renders[0].get("outputs", []) if renders else []
            if len(outs) < 2:
                failures.append("expected the plate and its thumb")
            for out in outs:
                written = Path(tmp) / "out" / out["path"]
                if not written.exists() or written.stat().st_size == 0:
                    failures.append(f"{out['path']} was not written under --out-root")
                elif sha256_file(written) != out["sha256"]:
                    failures.append(f"{out['path']} sha256 mismatch")
            if not prov_path.exists():
                failures.append("provenance file not written")
            if any((ROOT / out["path"]).stat().st_mtime > time.time() - 5 for out in outs if (ROOT / out["path"]).exists()):
                failures.append("--out-root render touched the repo copy")
    if not is_loopback("http://127.0.0.1:8888") or not is_loopback("http://localhost:8888") or is_loopback("https://example.com"):
        failures.append("is_loopback is wrong")
    if failures:
        for failure in failures:
            print(f"self-test FAIL: {failure}", file=sys.stderr)
        raise SystemExit(1)
    print("self-test ok")


def main():
    parser = argparse.ArgumentParser(description="Generate card and brand art with local Fooocus on the GPU")
    parser.add_argument("--base-url", default=os.environ.get("FOOOCUS_URL", DEFAULT_BASE))
    parser.add_argument("--manifest", default=str(ROOT / "art" / "fooocus-manifest.json"))
    parser.add_argument("--manifest-dir", default=str(ROOT / "art" / "fooocus-manifest.d"))
    parser.add_argument("--only", default="", help="comma-separated ids")
    parser.add_argument("--force", action="store_true", help="regenerate even when the files exist")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--out-root", default="", help="write outputs under this directory instead of the repo")
    parser.add_argument("--provenance", default="", help="write a JSON record of every render here")
    parser.add_argument(
        "--gpu-check",
        choices=("auto", "require", "off"),
        default=os.environ.get("FOOOCUS_GPU_CHECK", "auto"),
        help="auto: check the local GPU when the endpoint is loopback (default)",
    )
    parser.add_argument("--self-test", action="store_true", help="run against a built-in mock Fooocus-API")
    args = parser.parse_args()
    if args.self_test:
        self_test(args)
        return
    run(args)


if __name__ == "__main__":
    main()
