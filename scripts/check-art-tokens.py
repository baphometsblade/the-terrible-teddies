#!/usr/bin/env python3
"""Measure every card-art prompt against CLIP's 77-token window, for real.

Why this exists
---------------
CLIP silently discards anything past 77 tokens. Nothing errors, nothing warns —
the model just never sees the tail of the prompt, which is exactly where each
card's `scene` puts its staging and its visual punchline. So the only way to
know whether a prompt fits is to measure it with CLIP's own tokenizer.

The JS guard in src/data/cardArt.test.js is a fast *estimator* that runs in CI;
it has a few tokens of noise by design. This script is the authoritative check.

It also pins down the encoding, because getting that wrong is not hypothetical:
every prompt contains an em-dash (U+2014) as its subject/scene separator. Read
the prompt text as cp1252 instead of UTF-8 — the Windows console default — and
that one character becomes three mojibake characters worth ~4 extra tokens.
That is enough to push the ten prompts sitting closest to the ceiling over it,
producing a convincing but entirely false "these are truncated" list. This
script reads and encodes as UTF-8 explicitly so the number it prints is real.

Usage
-----
    pip install tokenizers
    npm run art:tokens

Exits non-zero if any prompt exceeds the limit, so it can gate an art run.
"""
import re
import subprocess
import sys

LIMIT = 77  # CLIP's context window, BOS and EOS included
MODEL = "openai/clip-vit-large-patch14"


def dump_prompts() -> dict[int, str]:
    """Get the prompts from the generator itself, so this can never drift from
    what actually gets sent to the endpoint."""
    proc = subprocess.run(
        ["npx", "vite-node", "scripts/generate-card-art.mjs", "--", "--dry-run"],
        capture_output=True,
        check=True,
    )
    # Decode explicitly: see the encoding note above.
    text = proc.stdout.decode("utf-8")
    prompts = {}
    for line in text.splitlines():
        m = re.match(r"^#(\d+) \[seed \d+\] (.*)$", line)
        if m:
            prompts[int(m.group(1))] = m.group(2)
    return prompts


def main() -> int:
    try:
        from tokenizers import Tokenizer
    except ImportError:
        print("needs the tokenizers package:  pip install tokenizers", file=sys.stderr)
        return 2

    tok = Tokenizer.from_pretrained(MODEL)
    tok.no_truncation()  # or it would silently cap every count at exactly 77
                         # — the same failure mode this script exists to detect

    prompts = dump_prompts()
    if not prompts:
        print("no prompts parsed from the generator's --dry-run output", file=sys.stderr)
        return 2

    counts = {cid: len(tok.encode(p).ids) for cid, p in prompts.items()}
    over = sorted((c, n) for c, n in counts.items() if n > LIMIT)

    print(f"{len(prompts)} prompts measured with {MODEL}")
    print(f"max {max(counts.values())} tokens (limit {LIMIT})")

    if over:
        print(f"\n{len(over)} prompt(s) OVER the limit — their scene tails are being discarded:")
        for cid, n in over:
            print(f"  #{cid}: {n} tokens ({n - LIMIT} over)")
        print("\nReword the `scene` for these ids in src/data/cardArt.js. Trim by hand:")
        print("mechanical truncation cuts mid-phrase and loses the joke just as surely.")
        return 1

    print("\nall prompts fit — nothing is being truncated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
