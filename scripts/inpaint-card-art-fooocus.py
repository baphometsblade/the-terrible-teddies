#!/usr/bin/env python3
"""Repaint part of an existing plate with a local Fooocus-API (inpaint).

Python dependency: requests. Nothing else. The input image is converted to
PNG, and finished plates are exported to WebP, with the repo's sharp (npm
install), the same way scripts/generate-card-art-fooocus.py does it.

Fooocus-API:

    POST {base}/v2/generation/image-inpaint-outpaint
    base defaults to http://127.0.0.1:8888

The mask is a PNG the same size as the image: white is repainted, black is
kept. Give one with --mask, or build one from ellipses on the command line:

    python3 scripts/inpaint-card-art-fooocus.py --id 51 \
        --image public/cards/51.webp \
        --ellipse 0.42,0.12,0.07,0.05 --ellipse 0.62,0.45,0.08,0.06,30 \
        --wobble 0.25 --mask-out ../art-preview/51-mask.png \
        --prompt "bald patch of bare stitched felt" --seed 100 --count 4 \
        --out-root ../art-preview --provenance ../art-preview/51-inpaint.json

An ellipse is cx,cy,rx,ry[,degrees]. When every number but the angle is at
most 1 they are fractions of the image width (cx, rx) and height (cy, ry),
otherwise pixels. --wobble makes the edge ragged (0 is a clean ellipse), and
--mask-seed makes that raggedness repeatable.

Each seed writes <out-root>/cand/<id>__s<seed>.png. --export <path> also
writes the first render as a card plate (768x1024 WebP) plus its
public/cards/thumbs/ thumb (192x256), under --out-root or the repo.
After reviewing the candidates, --export-from <png> --export <path>
writes a chosen one through the same sharp pipeline without rendering.

Like the generator, it checks nvidia-smi when the endpoint is loopback,
records prompt, seed, timing, GPU peak and sha256 per render in
--provenance, retries a failed call (--retries), and --self-test runs the
whole path against a built-in mock Fooocus-API.

No hosted generator is used (src/artPipeline.test.js enforces it).
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import importlib.util
import json
import math
import os
import random
import struct
import subprocess
import sys
import tempfile
import threading
import time
import zlib
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BASE = "http://127.0.0.1:8888"
ENDPOINT = "/v2/generation/image-inpaint-outpaint"
PNG_SIG = b"\x89PNG\r\n\x1a\n"


def _load_generator():
    """The text-to-image generator owns the shared helpers (GPU, sharp, base64)."""
    path = Path(__file__).resolve().parent / "generate-card-art-fooocus.py"
    spec = importlib.util.spec_from_file_location("fooocus_generator", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


gen = _load_generator()

TO_PNG = r"""
import { createRequire } from 'node:module';
const require = createRequire(process.argv[2]);
const sharp = require('sharp');
await sharp(process.argv[3]).removeAlpha().png().toFile(process.argv[4]);
"""


# --- PNG helpers (no imaging library) ---------------------------------------

def png_size(data: bytes):
    """(width, height) from a PNG's IHDR, or ValueError."""
    if len(data) < 24 or not data.startswith(PNG_SIG) or data[12:16] != b"IHDR":
        raise ValueError("not a PNG")
    return struct.unpack(">II", data[16:24])


def encode_gray_png(width: int, height: int, rows) -> bytes:
    """8-bit greyscale PNG from `height` rows of `width` byte values."""
    raw = b"".join(b"\x00" + bytes(row) for row in rows)

    def chunk(kind, payload):
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)

    return (
        PNG_SIG
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def decode_gray_png(data: bytes):
    """(width, height, rows) for an 8-bit greyscale PNG written by encode_gray_png (filter 0 only)."""
    width, height = png_size(data)
    pos, idat = 8, b""
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        kind = data[pos + 4:pos + 8]
        if kind == b"IDAT":
            idat += data[pos + 8:pos + 8 + length]
        pos += 12 + length
    raw = zlib.decompress(idat)
    stride = width + 1
    return width, height, [raw[y * stride + 1:(y + 1) * stride] for y in range(height)]


# --- masks ------------------------------------------------------------------

def parse_ellipse(spec: str, width: int, height: int):
    """cx,cy,rx,ry[,deg] -> pixel (cx, cy, rx, ry, radians)."""
    try:
        parts = [float(part) for part in spec.split(",")]
    except ValueError:
        raise SystemExit(f"--ellipse {spec!r}: numbers only (cx,cy,rx,ry[,degrees])") from None
    if len(parts) not in (4, 5):
        raise SystemExit(f"--ellipse {spec!r}: needs cx,cy,rx,ry[,degrees]")
    cx, cy, rx, ry = parts[:4]
    angle = math.radians(parts[4]) if len(parts) == 5 else 0.0
    if rx <= 0 or ry <= 0:
        raise SystemExit(f"--ellipse {spec!r}: radii must be positive")
    if all(0 <= value <= 1 for value in (cx, cy, rx, ry)):
        cx, rx = cx * width, rx * width
        cy, ry = cy * height, ry * height
    if not (0 <= cx <= width and 0 <= cy <= height):
        raise SystemExit(f"--ellipse {spec!r}: centre is outside the {width}x{height} image")
    return cx, cy, rx, ry, angle


def ellipse_mask(width: int, height: int, ellipses, wobble: float = 0.0, seed: int = 0):
    """Rows of 0/255: 255 inside any (optionally ragged) ellipse."""
    if not 0 <= wobble < 1:
        raise SystemExit("--wobble must be in [0, 1)")
    rng = random.Random(seed)
    shapes = []
    for cx, cy, rx, ry, angle in ellipses:
        # A few low-frequency sines on the radius give a torn, irregular edge.
        harmonics = [(rng.randint(2, 7), rng.uniform(0, 2 * math.pi), rng.uniform(0.3, 1.0)) for _ in range(4)]
        total = sum(amp for _, _, amp in harmonics) or 1.0
        shapes.append((cx, cy, rx, ry, math.cos(angle), math.sin(angle), harmonics, total))
    rows = []
    for y in range(height):
        row = bytearray(width)
        for cx, cy, rx, ry, cos_a, sin_a, harmonics, total in shapes:
            reach = max(rx, ry) * (1 + wobble)
            if abs(y + 0.5 - cy) > reach:
                continue
            x0 = max(0, int(cx - reach))
            x1 = min(width, int(cx + reach) + 1)
            for x in range(x0, x1):
                if row[x]:
                    continue
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                u = (dx * cos_a + dy * sin_a) / rx
                v = (-dx * sin_a + dy * cos_a) / ry
                dist = math.hypot(u, v)
                limit = 1.0
                if wobble:
                    theta = math.atan2(v, u)
                    limit += wobble * sum(amp * math.sin(k * theta + phase) for k, phase, amp in harmonics) / total
                if dist <= limit:
                    row[x] = 255
        rows.append(row)
    return rows


def mask_coverage(rows) -> float:
    cells = sum(len(row) for row in rows) or 1
    return sum(1 for row in rows for value in row if value) / cells


def load_mask(path: Path, width: int, height: int) -> bytes:
    data = path.read_bytes()
    try:
        mask_w, mask_h = png_size(data)
    except ValueError:
        raise SystemExit(f"--mask {path}: must be a PNG") from None
    if (mask_w, mask_h) != (width, height):
        raise SystemExit(f"--mask {path}: is {mask_w}x{mask_h}, the image is {width}x{height}")
    return data


# --- request ----------------------------------------------------------------

def seeds_for(start: int, count: int):
    if count < 1:
        raise SystemExit("--count must be at least 1")
    if start < 0:
        raise SystemExit("--seed must be 0 or more (each render needs a known seed)")
    return [start + offset for offset in range(count)]


def request_body(args, image_png: bytes, mask_png: bytes, seed: int):
    styles = [part.strip() for part in args.styles.split(",") if part.strip()] if args.styles else []
    body = {
        "prompt": args.prompt,
        "negative_prompt": args.negative or "",
        "style_selections": styles,
        "performance_selection": args.performance,
        "image_number": 1,
        "image_seed": seed,
        "guidance_scale": args.guidance_scale,
        "sharpness": args.sharpness,
        "require_base64": True,
        "async_process": False,
        "input_image": base64.b64encode(image_png).decode("ascii"),
        "input_mask": base64.b64encode(mask_png).decode("ascii"),
        "inpaint_additional_prompt": args.additional_prompt or "",
        "outpaint_selections": [],
        "advanced_params": {
            "inpaint_strength": args.strength,
            "inpaint_respective_field": args.respective_field,
            "inpaint_erode_or_dilate": args.erode_dilate,
            "inpaint_engine": args.inpaint_engine,
            "invert_mask_checkbox": False,
            "inpaint_advanced_masking_checkbox": True,
        },
    }
    if args.base_model:
        body["base_model_name"] = args.base_model
    return body


def post_with_retries(base, body, retries, backoff, timeout=900, sleep=time.sleep):
    """POST one inpaint; retry transport errors and 5xx. Returns (bytes, seed)."""
    url = base.rstrip("/") + ENDPOINT
    attempt = 0
    while True:
        attempt += 1
        try:
            res = gen.http().post(url, json=body, timeout=timeout)
            if res.status_code >= 500:
                raise RuntimeError(f"Fooocus-API {res.status_code}: {res.text[:300]}")
            if not res.ok:
                # A 4xx is a bad request; another try will not fix it.
                raise ValueError(f"Fooocus-API {res.status_code}: {res.text[:300]}")
            return gen.image_bytes(res.json(), base)
        except ValueError as err:
            raise RuntimeError(str(err)) from None
        except Exception as err:  # requests' ConnectionError/Timeout, or RuntimeError above
            if attempt > retries:
                raise RuntimeError(f"gave up after {attempt} attempt(s): {err}") from None
            wait = backoff * (2 ** (attempt - 1))
            print(f"retry {attempt}/{retries} in {wait:.1f}s: {err}", file=sys.stderr)
            sleep(wait)


def to_png(path: Path) -> bytes:
    data = path.read_bytes()
    if data.startswith(PNG_SIG):
        return data
    with tempfile.TemporaryDirectory() as tmp:
        script = Path(tmp) / "to-png.mjs"
        out = Path(tmp) / "in.png"
        script.write_text(TO_PNG, encoding="utf-8")
        subprocess.run(["node", str(script), str(ROOT / "package.json"), str(path), str(out)], cwd=ROOT, check=True)
        return out.read_bytes()


def card_outputs(export: str):
    stem = Path(export).stem
    return [
        {"path": export, "width": 768, "height": 1024, "format": "webp"},
        {"path": f"public/cards/thumbs/{stem}.webp", "width": 192, "height": 256, "format": "webp"},
    ]


def build_mask(args, width, height):
    if args.mask and args.ellipse:
        raise SystemExit("give --mask or --ellipse, not both")
    if args.mask:
        return load_mask(Path(args.mask), width, height), None
    if not args.ellipse:
        raise SystemExit("a mask is required: --mask <png> or one or more --ellipse")
    ellipses = [parse_ellipse(spec, width, height) for spec in args.ellipse]
    rows = ellipse_mask(width, height, ellipses, args.wobble, args.mask_seed)
    coverage = mask_coverage(rows)
    if coverage == 0:
        raise SystemExit("the ellipses cover no pixels")
    return encode_gray_png(width, height, rows), coverage


def export_only(args):
    """Write a chosen candidate as the card plate and thumb, without rendering."""
    src = Path(args.export_from)
    if not src.exists():
        raise SystemExit(f"--export-from {src} does not exist")
    if not args.export:
        raise SystemExit("--export-from needs --export <public/cards/<id>.webp>")
    out_root = Path(args.out_root).resolve() if args.out_root else ROOT
    outs = card_outputs(args.export)
    gen.finish(src, [{**out, "path": str(gen.resolve_out(out_root, out["path"]))} for out in outs])
    for out in outs:
        print(f"exported {src.name} -> {gen.resolve_out(out_root, out['path'])}")
    return outs


def run(args):
    if args.export_from:
        return export_only(args)
    if not args.id or any(ch in args.id for ch in "/\\") or ".." in args.id:
        raise SystemExit("--id is required and must be a plain name")
    if not args.prompt.strip():
        raise SystemExit("--prompt is required")
    if not 0 < args.strength <= 1:
        raise SystemExit("--strength must be in (0, 1]")
    seeds = seeds_for(args.seed, args.count)
    image_path = Path(args.image)
    if not image_path.exists():
        raise SystemExit(f"--image {image_path} does not exist")
    image_png = to_png(image_path)
    width, height = png_size(image_png)
    mask_png, coverage = build_mask(args, width, height)
    out_root = Path(args.out_root).resolve() if args.out_root else ROOT
    if args.mask_out:
        mask_out = Path(args.mask_out)
        mask_out.parent.mkdir(parents=True, exist_ok=True)
        mask_out.write_bytes(mask_png)
        print(f"mask -> {mask_out}" + (f" ({coverage:.1%} of the image)" if coverage is not None else ""))
    if args.dry_run:
        for seed in seeds:
            body = request_body(args, image_png, mask_png, seed)
            print(f"{args.id}__s{seed}\t{width}x{height}\tstrength {body['advanced_params']['inpaint_strength']}")
        return {"renders": []}

    check_gpu = args.gpu_check == "require" or (args.gpu_check == "auto" and gen.is_loopback(args.base_url))
    gpu_name = None
    if check_gpu:
        gpus = gen.gpu_snapshot()
        if not gpus:
            raise SystemExit("No NVIDIA GPU visible to nvidia-smi. Run this on the art PC, or pass --gpu-check off.")
        gpu_name = gpus[0]["name"]

    record = {
        "generator": "fooocus-api-inpaint",
        "base_url": args.base_url,
        "endpoint": ENDPOINT,
        "date": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "gpu": gpu_name,
        "input": {"path": str(image_path), "sha256": hashlib.sha256(image_png).hexdigest(), "width": width, "height": height},
        "mask": {"source": args.mask or "ellipses", "ellipses": args.ellipse or [], "wobble": args.wobble,
                 "mask_seed": args.mask_seed, "coverage": coverage, "sha256": hashlib.sha256(mask_png).hexdigest()},
        "renders": [],
    }
    done = failed = 0
    first = None
    for seed in seeds:
        ident = f"{args.id}__s{seed}"
        body = request_body(args, image_png, mask_png, seed)
        try:
            started = time.monotonic()
            with gen.GpuSampler(check_gpu) as sampler:
                raw, used_seed = post_with_retries(args.base_url, body, args.retries, args.backoff)
            elapsed = round(time.monotonic() - started, 2)
            rel = f"cand/{ident}.png"
            out = gen.resolve_out(out_root, rel)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(raw)
            render = {
                "id": ident, "prompt": body["prompt"], "negative_prompt": body["negative_prompt"],
                "styles": body["style_selections"], "performance": body["performance_selection"],
                "seed": used_seed if used_seed is not None else seed, "requested_seed": seed,
                "guidance_scale": body["guidance_scale"], "advanced_params": body["advanced_params"],
                "elapsed_s": elapsed, "gpu_peak_util": sampler.peak_util, "gpu_peak_mem_mib": sampler.peak_mem,
                "outputs": [{"path": rel, "sha256": gen.sha256_file(out)}],
            }
            record["renders"].append(render)
            first = first or out
            done += 1
            print(f"rendered {ident} in {elapsed}s -> {out}")
        except (RuntimeError, OSError) as err:
            failed += 1
            print(f"failed {ident}: {err}", file=sys.stderr)
            if failed >= 3 and done == 0:
                print("First three calls failed. Check that Fooocus-API is running.", file=sys.stderr)
                break

    if args.export and first is not None:
        outs = card_outputs(args.export)
        jobs = [{**out, "path": str(gen.resolve_out(out_root, out["path"]))} for out in outs]
        gen.finish(first, jobs)
        record["export"] = [{"path": out["path"], "sha256": gen.sha256_file(gen.resolve_out(out_root, out["path"]))}
                            for out in outs]
        print(f"exported {first.name} -> {args.export} and its thumb")
    if args.provenance:
        prov = Path(args.provenance)
        prov.parent.mkdir(parents=True, exist_ok=True)
        prov.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
        print(f"provenance -> {prov}")
    print(f"{done} rendered, {failed} failed")
    if failed:
        raise SystemExit(1)
    return record


# --- self-test --------------------------------------------------------------

def self_test(args):
    from http.server import BaseHTTPRequestHandler, HTTPServer

    seen = []
    reply = base64.b64encode(encode_gray_png(48, 64, [bytes([90]) * 48] * 64)).decode()

    class Mock(BaseHTTPRequestHandler):
        def do_POST(self):  # noqa: N802 (http.server API)
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            seen.append((self.path, body))
            status, payload = 404, b"{}"
            if self.path == ENDPOINT:
                status = 200
                payload = json.dumps([{"base64": reply, "seed": body.get("image_seed"), "finish_reason": "SUCCESS"}]).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *_):
            pass

    server = HTTPServer(("127.0.0.1", 0), Mock)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    failures = []
    with tempfile.TemporaryDirectory() as tmp:
        image = Path(tmp) / "in.png"
        image.write_bytes(encode_gray_png(48, 64, [bytes([200]) * 48] * 64))
        test_args = parse_args([
            "--id", "t", "--image", str(image), "--ellipse", "0.5,0.5,0.2,0.1", "--wobble", "0.2",
            "--prompt", "bald patch", "--seed", "7", "--count", "2", "--out-root", str(Path(tmp) / "out"),
            "--provenance", str(Path(tmp) / "prov.json"), "--gpu-check", "off",
            "--base-url", f"http://127.0.0.1:{server.server_address[1]}",
        ])
        try:
            record = run(test_args)
        except SystemExit as err:
            failures.append(f"run exited: {err}")
            record = None
        finally:
            server.shutdown()
        if len(seen) != 2:
            failures.append(f"expected 2 calls, saw {len(seen)}")
        for _path, body in seen:
            if not body.get("input_image") or not body.get("input_mask"):
                failures.append("request is missing the image or the mask")
            if body.get("require_base64") is not True:
                failures.append("request must ask for base64")
        if [body.get("image_seed") for _, body in seen] != [7, 8]:
            failures.append("seeds were not 7 and 8")
        if record:
            for render in record["renders"]:
                written = Path(tmp) / "out" / render["outputs"][0]["path"]
                if not written.exists() or gen.sha256_file(written) != render["outputs"][0]["sha256"]:
                    failures.append(f"{render['id']} was not written or its sha256 is wrong")
            if not (Path(tmp) / "prov.json").exists():
                failures.append("provenance file not written")
    if failures:
        for failure in failures:
            print(f"self-test FAIL: {failure}", file=sys.stderr)
        raise SystemExit(1)
    print("self-test ok")


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Inpaint part of a plate with local Fooocus on the GPU")
    parser.add_argument("--base-url", default=os.environ.get("FOOOCUS_URL", DEFAULT_BASE))
    parser.add_argument("--id", default="", help="name for the candidates (<id>__s<seed>.png)")
    parser.add_argument("--image", default="", help="plate to repaint (PNG, JPEG or WebP)")
    parser.add_argument("--mask", default="", help="PNG mask, same size as the image, white = repaint")
    parser.add_argument("--ellipse", action="append", default=[], help="cx,cy,rx,ry[,degrees]; repeatable")
    parser.add_argument("--wobble", type=float, default=0.0, help="ragged edge for --ellipse masks, 0..1")
    parser.add_argument("--mask-seed", type=int, default=0)
    parser.add_argument("--mask-out", default="", help="also save the mask PNG here")
    parser.add_argument("--prompt", default="")
    parser.add_argument("--negative", default="")
    parser.add_argument("--additional-prompt", default="", help="Fooocus inpaint_additional_prompt")
    parser.add_argument("--styles", default="Fooocus V2", help="comma-separated Fooocus styles; empty for none")
    parser.add_argument("--performance", default="Quality")
    parser.add_argument("--guidance-scale", type=float, default=6.0)
    parser.add_argument("--sharpness", type=float, default=2.0)
    parser.add_argument("--strength", type=float, default=1.0, help="inpaint denoising strength (0, 1]")
    parser.add_argument("--respective-field", type=float, default=0.618)
    parser.add_argument("--erode-dilate", type=int, default=0)
    parser.add_argument("--inpaint-engine", default="v2.6")
    parser.add_argument("--base-model", default="")
    parser.add_argument("--seed", type=int, default=0, help="first seed")
    parser.add_argument("--count", type=int, default=1, help="renders, one per seed from --seed up")
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--backoff", type=float, default=3.0, help="seconds before the first retry; doubles")
    parser.add_argument("--export", default="", help="also write the first render as this card plate + thumb")
    parser.add_argument("--export-from", default="", help="skip rendering: export this PNG to --export")
    parser.add_argument("--out-root", default="", help="write outputs under this directory instead of the repo")
    parser.add_argument("--provenance", default="")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--gpu-check", choices=("auto", "require", "off"),
                        default=os.environ.get("FOOOCUS_GPU_CHECK", "auto"))
    parser.add_argument("--self-test", action="store_true")
    return parser.parse_args(argv)


def main():
    args = parse_args()
    if args.self_test:
        self_test(args)
        return
    run(args)


if __name__ == "__main__":
    main()
