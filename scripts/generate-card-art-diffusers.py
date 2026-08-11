#!/usr/bin/env python3
"""Card-art generation via local diffusers (no server needed).

Companion to generate-card-art.mjs for machines (or CI/cloud sandboxes)
where no Fooocus/A1111 endpoint is reachable: runs Stable Diffusion
directly through huggingface diffusers, on GPU if present, otherwise CPU
(turbo models make CPU batches tolerable at 1-4 steps).

Usage:
  npm run art:generate -- --manifest /tmp/art-manifest.json   # export prompts
  python3 scripts/generate-card-art-diffusers.py /tmp/art-manifest.json public/cards [--force] [--only 1,6,30]

Env:
  SD_MODEL  huggingface model id (default stabilityai/sdxl-turbo, which is
            natively 1024-trained — sd-turbo is 512-trained and doubles
            subjects at card resolution. SD_MODEL=stabilityai/sd-turbo with
            SD_WIDTH/SD_HEIGHT=512 stays available for fast/low-RAM runs.)
  SD_STEPS  inference steps (default 4)
  SD_GUIDANCE classifier-free guidance (default 0.0). Turbo models are
            distilled for 0.0, where the negative prompt has NO effect.
            Raise it (e.g. 2.0, with SD_STEPS=8) when prompt adherence
            matters more than speed — that also switches the negative
            prompt on.
  SD_DEVICE force cuda | mps | cpu (default: auto-detect, GPU preferred)
  SD_WIDTH  render width in px (default 768)
  SD_HEIGHT render height in px (default 1024)
  ART_NO_MONITOR    set to skip the forced progress dashboard
  ART_MONITOR_PORT  port the dashboard serves on (default 8877)

Output matches the JS pipeline's contract: public/cards/<id>.webp,
768x1024 (3:4), <= 150 KB each.
"""
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
import webbrowser

STATUS_PATH = os.path.join(tempfile.gettempdir(), "card-art-status.json")


def make_status(items):
    """Progress feed for scripts/art-monitor.mjs (npm run art:monitor)."""
    state = {
        "startedAt": int(time.time() * 1000),
        "finishedAt": None,
        "items": [
            {"id": m["id"], "name": m["name"], "state": "pending", "kb": None, "ms": None}
            for m in items
        ],
    }

    def flush():
        with open(STATUS_PATH, "w") as fh:
            json.dump(state, fh)

    def update(card_id, **fields):
        for it in state["items"]:
            if it["id"] == card_id:
                it.update(fields)
        flush()

    flush()
    return state, update, flush


def ensure_monitor():
    """Force the watch window during generation (skip with ART_NO_MONITOR=1).

    Reuses a monitor that is already serving; otherwise spawns
    `node scripts/art-monitor.mjs` detached (it survives the batch so the
    finished gallery stays clickable) and opens the dashboard in a browser.
    """
    if os.environ.get("ART_NO_MONITOR"):
        return
    port = os.environ.get("ART_MONITOR_PORT", "8877")
    url = f"http://127.0.0.1:{port}"
    try:
        urllib.request.urlopen(f"{url}/status.json", timeout=1)
        running = True
    except Exception:
        running = False
    if not running:
        node = shutil.which("node")
        script = os.path.join(os.path.dirname(__file__), "art-monitor.mjs")
        if node and os.path.exists(script):
            subprocess.Popen(
                [node, script],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
            time.sleep(0.6)
    print(f"art monitor: {url}", flush=True)
    try:
        webbrowser.open(url)
    except Exception:
        pass  # headless — the URL still works


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = [a for a in sys.argv[1:] if a.startswith("--")]
    if len(args) < 2:
        print(__doc__)
        return 1
    manifest_path, out_dir = args[0], args[1]
    force = "--force" in flags
    only = None
    only_given = any(f.startswith("--only") for f in flags)
    for f in flags:
        if f.startswith("--only"):
            raw = f.split("=", 1)[1] if "=" in f else args[2] if len(args) > 2 else ""
            only = {int(x) for x in raw.replace(",", " ").split()}
    # An empty --only (no ids parsed) is an error, not "all cards". Falling
    # through to the full set — which with --force silently overwrites every
    # rendered card — is never what someone who typed --only intended.
    if only_given and not only:
        print(
            "error: --only was given but no card ids were parsed from it. "
            "Refusing to fall back to ALL cards (with --force that would "
            "overwrite the whole set). Pass ids like --only=3,7 or omit --only.",
            file=sys.stderr,
        )
        return 1

    with open(manifest_path) as fh:
        manifest = json.load(fh)
    if only:
        manifest = [m for m in manifest if m["id"] in only]

    os.makedirs(out_dir, exist_ok=True)
    todo = [
        m for m in manifest
        if force or not os.path.exists(os.path.join(out_dir, f"{m['id']}.webp"))
    ]
    if not todo:
        print("nothing to do — all files exist (use --force to regenerate)")
        return 0

    import torch  # deferred: heavy
    from diffusers import AutoPipelineForText2Image
    from PIL import Image

    model = os.environ.get("SD_MODEL", "stabilityai/sdxl-turbo")
    steps = int(os.environ.get("SD_STEPS", "4"))
    guidance = float(os.environ.get("SD_GUIDANCE", "0.0"))
    width = int(os.environ.get("SD_WIDTH", "768"))
    height = int(os.environ.get("SD_HEIGHT", "1024"))

    # GPU is used automatically whenever CUDA (NVIDIA) or MPS (Apple silicon)
    # is present — roughly 20-40x faster than CPU for this batch. Force a
    # device with SD_DEVICE=cuda|mps|cpu.
    if os.environ.get("SD_DEVICE"):
        device = os.environ["SD_DEVICE"]
    elif torch.cuda.is_available():
        device = "cuda"
    elif getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"
    dtype = torch.float32 if device == "cpu" else torch.float16

    if device == "cuda":
        name = torch.cuda.get_device_name(0)
        vram = torch.cuda.get_device_properties(0).total_memory / 1024**3
        print(f"GPU: {name} ({vram:.1f} GB VRAM)", flush=True)
    elif device == "cpu":
        print("no GPU detected — running on CPU (slow). See README for the GPU path.", flush=True)

    print(f"loading {model} on {device} ({len(todo)} cards to render)…", flush=True)
    load_kwargs = {"torch_dtype": dtype}
    if device == "cuda":
        # fp16 weights: half the download, half the VRAM, same output.
        load_kwargs.update(variant="fp16", use_safetensors=True)
    try:
        pipe = AutoPipelineForText2Image.from_pretrained(model, **load_kwargs)
    except Exception:
        # Not every repo publishes an fp16 variant — fall back to the default.
        load_kwargs.pop("variant", None)
        pipe = AutoPipelineForText2Image.from_pretrained(model, **load_kwargs)
    pipe = pipe.to(device)
    pipe.set_progress_bar_config(disable=True)
    if device == "cuda":
        # Keeps 8 GB cards comfortable at 768x1024; no-op on big GPUs.
        pipe.enable_attention_slicing()

    def to_card_webp(img: Image.Image, dest: str) -> int:
        # center-crop to 3:4, resize to 768x1024, quality-step to <= 150 KB
        w, h = img.size
        target = 3 / 4
        if w / h > target:
            new_w = int(h * target)
            img = img.crop(((w - new_w) // 2, 0, (w + new_w) // 2, h))
        else:
            new_h = int(w / target)
            img = img.crop((0, (h - new_h) // 2, w, (h + new_h) // 2))
        img = img.resize((768, 1024), Image.LANCZOS)
        budget = 150 * 1024
        for quality in (85, 75, 65, 55):
            buf = io.BytesIO()
            img.save(buf, "WEBP", quality=quality)
            if buf.tell() <= budget:
                break
        if buf.tell() > budget:
            # Last resort: smaller canvas, regardless of budget.
            buf = io.BytesIO()
            img.resize((576, 768), Image.LANCZOS).save(buf, "WEBP", quality=50)
        with open(dest, "wb") as out:
            out.write(buf.getvalue())
        return buf.tell()

    ensure_monitor()
    state, update, flush = make_status(todo)
    done = failed = 0
    for i, m in enumerate(todo, 1):
        dest = os.path.join(out_dir, f"{m['id']}.webp")
        t0 = time.time()
        update(m["id"], state="generating")
        try:
            gen = torch.Generator(device=device).manual_seed(m["seed"])
            # Turbo models are distilled for guidance 0.0, where classifier-free
            # guidance — and therefore the negative prompt — is inactive. Only
            # send the negative when guidance is actually on, so the default
            # path stays exactly as before.
            kwargs = {}
            if guidance > 0 and m.get("negative"):
                kwargs["negative_prompt"] = m["negative"]
            img = pipe(
                prompt=m["prompt"],
                num_inference_steps=steps,
                guidance_scale=guidance,
                width=width,
                height=height,
                generator=gen,
                **kwargs,
            ).images[0]
            size = to_card_webp(img, dest)
            done += 1
            update(m["id"], state="done", kb=round(size / 1024, 1), ms=int((time.time() - t0) * 1000))
            print(
                f"[{i}/{len(todo)}] ✓ #{m['id']} {m['name']} "
                f"({size / 1024:.1f} KB, {time.time() - t0:.0f}s)",
                flush=True,
            )
        except Exception as err:  # noqa: BLE001 — keep the batch going
            failed += 1
            update(m["id"], state="failed")
            print(f"[{i}/{len(todo)}] ✗ #{m['id']} {m['name']}: {err}", flush=True)
            if failed >= 3 and done == 0:
                print("first three renders failed — aborting")
                return 1

    state["finishedAt"] = int(time.time() * 1000)
    flush()
    print(f"\n{done} generated, {failed} failed → {out_dir}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
