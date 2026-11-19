"""The Fooocus scripts' finishing step (generate-card-art-fooocus.py finish(),
which the inpaint script reuses) must give a new card master every size and
format the app serves, and write PNGs near-losslessly. Runs the real node +
sharp step; no GPU, no network.

    python3 -m unittest discover -s scripts/tests -p 'test_*.py'
"""

import importlib.util
import shutil
import struct
import tempfile
import unittest
import zlib
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "generate-card-art-fooocus.py"
spec = importlib.util.spec_from_file_location("gen", SCRIPT)
gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)


def png(width, height):
    """An RGB gradient PNG, written by hand so the test needs no imaging library."""
    rows = b"".join(
        b"\x00" + bytes(v for x in range(width) for v in ((x * 7) % 256, (y * 5) % 256, (x + y) % 256))
        for y in range(height)
    )
    chunk = lambda tag, data: struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b""))


def size_of(path):
    data = Path(path).read_bytes()
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return struct.unpack(">II", data[16:24])
    return None


@unittest.skipUnless(shutil.which("node"), "needs node")
class FinishWritesVariants(unittest.TestCase):
    def test_a_card_master_gets_thumb_and_mid_in_webp_and_avif(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / "render.png"
            src.write_bytes(png(96, 128))
            cards = Path(tmp) / "public" / "cards"
            master = cards / "77.webp"
            gen.finish(src, [
                {"path": str(master), "width": 768, "height": 1024, "format": "webp"},
                {"path": str(cards / "thumbs" / "77.webp"), "width": 192, "height": 256, "format": "webp"},
            ])
            self.assertTrue(master.exists())
            for rel in ("thumbs/77.webp", "thumbs/77.avif", "mid/77.webp", "mid/77.avif"):
                out = cards / rel
                self.assertTrue(out.exists(), rel)
                self.assertGreater(out.stat().st_size, 0, rel)
            self.assertEqual((cards / "thumbs" / "77.avif").read_bytes()[4:12], b"ftypavif")

    def test_other_outputs_get_no_variants_and_pngs_keep_their_size(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / "render.png"
            src.write_bytes(png(64, 64))
            icon = Path(tmp) / "public" / "icon-512.png"
            season = Path(tmp) / "public" / "seasons" / "x.webp"
            gen.finish(src, [
                {"path": str(icon), "width": 512, "height": 512, "format": "png"},
                {"path": str(season), "width": 300, "height": 200, "format": "webp"},
            ])
            self.assertEqual(size_of(icon), (512, 512))
            self.assertFalse((Path(tmp) / "public" / "seasons" / "thumbs").exists())
            self.assertFalse((Path(tmp) / "public" / "mid").exists())


if __name__ == "__main__":
    unittest.main()
