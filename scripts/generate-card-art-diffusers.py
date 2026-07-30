#!/usr/bin/env python3
"""Card-art generation via local diffusers (no server needed).

Companion to generate-card-art.mjs for machines (or CI/cloud sandboxes)
where no Fooocus/A1111 endpoint is reachable: runs Stable Diffusion
directly through huggingface diffusers, on GPU if present, otherwise CPU
(sd-turbo makes CPU batches tolerable at 1-4 steps).

Usage:
  npm run art:generate -- --manifest /tmp/art-manifest.json   # export prompts
  python3 scripts/generate-card-art-diffusers.py /tmp/art-manifest.json public/cards [--force] [--only 1,6,30]

Env:
  SD_MODEL  huggingface model id (default stabilityai/sd-turbo)
  SD_STEPS  inference steps (default 3)

Output matches the JS pipeline's contract: public/cards/<id>.webp,
384x512 (3:4), <= 60 KB each.
"""
import io
import json
import os
import sys
import tempfile
import time

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


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = [a for a in sys.argv[1:] if a.startswith("--")]
    if len(args) < 2:
        print(__doc__)
        return 1
    manifest_path, out_dir = args[0], args[1]
    force = "--force" in flags
    only = None
    for f in flags:
        if f.startswith("--only"):
            raw = f.split("=", 1)[1] if "=" in f else args[2] if len(args) > 2 else ""
            only = {int(x) for x in raw.replace(",", " ").split()}

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

    model = os.environ.get("SD_MODEL", "stabilityai/sd-turbo")
    steps = int(os.environ.get("SD_STEPS", "3"))
    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if device == "cuda" else torch.float32

    print(f"loading {model} on {device} ({len(todo)} cards to render)…", flush=True)
    pipe = AutoPipelineForText2Image.from_pretrained(model, torch_dtype=dtype)
    pipe = pipe.to(device)
    pipe.set_progress_bar_config(disable=True)

    def to_card_webp(img: Image.Image, dest: str) -> int:
        # center-crop to 3:4, resize to 384x512, quality-step to <= 60 KB
        w, h = img.size
        target = 3 / 4
        if w / h > target:
            new_w = int(h * target)
            img = img.crop(((w - new_w) // 2, 0, (w + new_w) // 2, h))
        else:
            new_h = int(w / target)
            img = img.crop((0, (h - new_h) // 2, w, (h + new_h) // 2))
        img = img.resize((384, 512), Image.LANCZOS)
        for quality in (80, 65, 50, 38):
            buf = io.BytesIO()
            img.save(buf, "WEBP", quality=quality)
            if buf.tell() <= 60 * 1024:
                break
        with open(dest, "wb") as out:
            out.write(buf.getvalue())
        return buf.tell()

    state, update, flush = make_status(todo)
    done = failed = 0
    for i, m in enumerate(todo, 1):
        dest = os.path.join(out_dir, f"{m['id']}.webp")
        t0 = time.time()
        update(m["id"], state="generating")
        try:
            gen = torch.Generator(device=device).manual_seed(m["seed"])
            # turbo models: guidance 0.0, negative prompt has no effect there
            img = pipe(
                prompt=m["prompt"],
                num_inference_steps=steps,
                guidance_scale=0.0,
                width=512,
                height=512,
                generator=gen,
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
