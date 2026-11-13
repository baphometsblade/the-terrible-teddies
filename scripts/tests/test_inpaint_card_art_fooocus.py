"""Unit tests for scripts/inpaint-card-art-fooocus.py (no GPU, no network).

    python3 -m unittest discover -s scripts/tests -p 'test_*.py'
"""

import base64
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SCRIPT = Path(__file__).resolve().parents[1] / "inpaint-card-art-fooocus.py"
spec = importlib.util.spec_from_file_location("inpaint", SCRIPT)
inpaint = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inpaint)


def solid_png(width, height, value=128):
    return inpaint.encode_gray_png(width, height, [bytes([value]) * width] * height)


class FakeResponse:
    def __init__(self, status, payload=None, text=""):
        self.status_code = status
        self.ok = 200 <= status < 300
        self._payload = payload
        self.text = text or json.dumps(payload)

    def json(self):
        return self._payload


class FakeHttp:
    """Stands in for `requests`: replays a list of responses or exceptions."""

    def __init__(self, replies):
        self.replies = list(replies)
        self.calls = []

    def post(self, url, json=None, timeout=None):
        self.calls.append((url, json))
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply


def ok_reply(seed=1):
    # Fooocus answers with a full PNG; a noisy one keeps the base64 realistic in size.
    rows = [bytes((x * 7 + y * 13) % 256 for x in range(64)) for y in range(64)]
    blob = base64.b64encode(inpaint.encode_gray_png(64, 64, rows)).decode()
    return FakeResponse(200, [{"base64": blob, "seed": seed, "finish_reason": "SUCCESS"}])


class EllipseTests(unittest.TestCase):
    def test_fractions_scale_to_pixels(self):
        cx, cy, rx, ry, angle = inpaint.parse_ellipse("0.5,0.25,0.1,0.2", 200, 400)
        self.assertEqual((cx, cy, rx, ry), (100, 100, 20, 80))
        self.assertEqual(angle, 0)

    def test_pixels_and_angle(self):
        cx, cy, rx, ry, angle = inpaint.parse_ellipse("50,60,10,5,90", 200, 400)
        self.assertEqual((cx, cy, rx, ry), (50, 60, 10, 5))
        self.assertAlmostEqual(angle, 3.14159265 / 2, places=5)

    def test_bad_specs_exit(self):
        for spec in ("1,2,3", "a,b,c,d", "0.5,0.5,0,0.1", "900,10,5,5"):
            with self.subTest(spec=spec), self.assertRaises(SystemExit):
                inpaint.parse_ellipse(spec, 200, 400)


class MaskTests(unittest.TestCase):
    def test_clean_ellipse_area(self):
        rows = inpaint.ellipse_mask(100, 100, [(50, 50, 20, 10, 0)])
        self.assertEqual(rows[50][50], 255)
        self.assertEqual(rows[50][75], 0)
        self.assertEqual(rows[0][0], 0)
        # pi * 20 * 10 / 10000 ~= 0.0628
        self.assertAlmostEqual(inpaint.mask_coverage(rows), 0.0628, delta=0.004)
        self.assertTrue(set(value for row in rows for value in row) <= {0, 255})

    def test_wobble_is_ragged_and_repeatable(self):
        shape = [(50, 50, 20, 20, 0)]
        clean = inpaint.ellipse_mask(100, 100, shape)
        ragged = inpaint.ellipse_mask(100, 100, shape, wobble=0.3, seed=4)
        again = inpaint.ellipse_mask(100, 100, shape, wobble=0.3, seed=4)
        other = inpaint.ellipse_mask(100, 100, shape, wobble=0.3, seed=5)
        self.assertNotEqual(clean, ragged)
        self.assertEqual(ragged, again)
        self.assertNotEqual(ragged, other)

    def test_wobble_range(self):
        with self.assertRaises(SystemExit):
            inpaint.ellipse_mask(10, 10, [(5, 5, 2, 2, 0)], wobble=1.5)

    def test_png_round_trip(self):
        rows = inpaint.ellipse_mask(31, 17, [(15, 8, 6, 4, 0)])
        data = inpaint.encode_gray_png(31, 17, rows)
        self.assertEqual(inpaint.png_size(data), (31, 17))
        width, height, back = inpaint.decode_gray_png(data)
        self.assertEqual((width, height), (31, 17))
        self.assertEqual([bytes(row) for row in rows], [bytes(row) for row in back])

    def test_load_mask_checks_format_and_size(self):
        with tempfile.TemporaryDirectory() as tmp:
            good = Path(tmp) / "m.png"
            good.write_bytes(solid_png(20, 30, 255))
            self.assertEqual(inpaint.png_size(inpaint.load_mask(good, 20, 30)), (20, 30))
            with self.assertRaises(SystemExit):
                inpaint.load_mask(good, 21, 30)
            bad = Path(tmp) / "m.jpg"
            bad.write_bytes(b"\xff\xd8not a png")
            with self.assertRaises(SystemExit):
                inpaint.load_mask(bad, 20, 30)


class ArgTests(unittest.TestCase):
    def test_defaults(self):
        args = inpaint.parse_args(["--id", "51"])
        self.assertEqual(args.base_url, inpaint.DEFAULT_BASE)
        self.assertEqual(args.count, 1)
        self.assertEqual(args.styles, "Fooocus V2")
        self.assertEqual(args.ellipse, [])

    def test_repeatable_ellipse(self):
        args = inpaint.parse_args(["--ellipse", "0.1,0.1,0.1,0.1", "--ellipse", "0.2,0.2,0.1,0.1"])
        self.assertEqual(len(args.ellipse), 2)

    def test_seeds(self):
        self.assertEqual(inpaint.seeds_for(10, 3), [10, 11, 12])
        with self.assertRaises(SystemExit):
            inpaint.seeds_for(10, 0)
        with self.assertRaises(SystemExit):
            inpaint.seeds_for(-1, 2)

    def test_mask_or_ellipse_required_not_both(self):
        args = inpaint.parse_args([])
        with self.assertRaises(SystemExit):
            inpaint.build_mask(args, 10, 10)
        args = inpaint.parse_args(["--mask", "m.png", "--ellipse", "1,1,1,1"])
        with self.assertRaises(SystemExit):
            inpaint.build_mask(args, 10, 10)

    def test_run_validates_before_calling(self):
        for argv in (["--prompt", "x"], ["--id", "../x", "--prompt", "x"], ["--id", "51"],
                     ["--id", "51", "--prompt", "x", "--strength", "0"],
                     ["--id", "51", "--prompt", "x", "--image", "/nope.png"]):
            with self.subTest(argv=argv), self.assertRaises(SystemExit):
                inpaint.run(inpaint.parse_args(argv))


class PayloadTests(unittest.TestCase):
    def test_body_shape(self):
        args = inpaint.parse_args(["--id", "51", "--prompt", "bald patch", "--negative", "dog",
                                   "--styles", "Fooocus V2, Fooocus Sharp", "--strength", "0.9",
                                   "--erode-dilate", "4", "--guidance-scale", "7"])
        body = inpaint.request_body(args, b"IMG", b"MASK", 33)
        self.assertEqual(base64.b64decode(body["input_image"]), b"IMG")
        self.assertEqual(base64.b64decode(body["input_mask"]), b"MASK")
        self.assertEqual(body["image_seed"], 33)
        self.assertEqual(body["style_selections"], ["Fooocus V2", "Fooocus Sharp"])
        self.assertEqual(body["negative_prompt"], "dog")
        self.assertIs(body["require_base64"], True)
        self.assertIs(body["async_process"], False)
        self.assertEqual(body["outpaint_selections"], [])
        adv = body["advanced_params"]
        self.assertEqual(adv["inpaint_strength"], 0.9)
        self.assertEqual(adv["inpaint_erode_or_dilate"], 4)
        self.assertIs(adv["invert_mask_checkbox"], False)
        self.assertIs(adv["inpaint_advanced_masking_checkbox"], True)
        self.assertNotIn("base_model_name", body)

    def test_empty_styles_means_none(self):
        args = inpaint.parse_args(["--styles", ""])
        self.assertEqual(inpaint.request_body(args, b"", b"", 1)["style_selections"], [])


class HttpTests(unittest.TestCase):
    def call(self, replies, retries=2):
        fake = FakeHttp(replies)
        sleeps = []
        with mock.patch.object(inpaint.gen, "http", return_value=fake):
            result = inpaint.post_with_retries("http://127.0.0.1:8888/", {"x": 1}, retries, 0.5, sleep=sleeps.append)
        return result, fake, sleeps

    def test_success_hits_v2_endpoint(self):
        (data, seed), fake, sleeps = self.call([ok_reply(9)])
        self.assertTrue(data.startswith(inpaint.PNG_SIG))
        self.assertEqual(seed, 9)
        self.assertEqual(fake.calls[0][0], "http://127.0.0.1:8888/v2/generation/image-inpaint-outpaint")
        self.assertEqual(sleeps, [])

    def test_retries_5xx_and_transport_errors_with_backoff(self):
        (_, seed), fake, sleeps = self.call([FakeResponse(503, text="busy"), ConnectionError("down"), ok_reply(2)])
        self.assertEqual(seed, 2)
        self.assertEqual(len(fake.calls), 3)
        self.assertEqual(sleeps, [0.5, 1.0])

    def test_gives_up_after_retries(self):
        with self.assertRaisesRegex(RuntimeError, "gave up after 3"):
            self.call([FakeResponse(500, text="x")] * 3, retries=2)

    def test_4xx_is_not_retried(self):
        fake = FakeHttp([FakeResponse(422, text="bad mask"), ok_reply()])
        with mock.patch.object(inpaint.gen, "http", return_value=fake):
            with self.assertRaisesRegex(RuntimeError, "422"):
                inpaint.post_with_retries("http://h", {}, 3, 0, sleep=lambda _s: None)
        self.assertEqual(len(fake.calls), 1)


class RunTests(unittest.TestCase):
    def test_end_to_end_with_mock_http(self):
        with tempfile.TemporaryDirectory() as tmp:
            image = Path(tmp) / "plate.png"
            image.write_bytes(solid_png(40, 50))
            mask_out = Path(tmp) / "mask.png"
            fake = FakeHttp([ok_reply(5), ok_reply(6)])
            args = inpaint.parse_args([
                "--id", "51", "--image", str(image), "--ellipse", "0.5,0.3,0.2,0.1",
                "--ellipse", "0.3,0.7,0.1,0.1", "--wobble", "0.2", "--mask-out", str(mask_out),
                "--prompt", "bald patch", "--seed", "5", "--count", "2", "--gpu-check", "off",
                "--out-root", str(Path(tmp) / "out"), "--provenance", str(Path(tmp) / "prov.json"),
                "--backoff", "0", "--retries", "0",
            ])
            with mock.patch.object(inpaint.gen, "http", return_value=fake):
                record = inpaint.run(args)
            self.assertEqual([body["image_seed"] for _, body in fake.calls], [5, 6])
            sent_mask = base64.b64decode(fake.calls[0][1]["input_mask"])
            self.assertEqual(inpaint.png_size(sent_mask), (40, 50))
            self.assertEqual(mask_out.read_bytes(), sent_mask)
            self.assertEqual([r["id"] for r in record["renders"]], ["51__s5", "51__s6"])
            for render in record["renders"]:
                self.assertTrue((Path(tmp) / "out" / render["outputs"][0]["path"]).exists())
            prov = json.loads((Path(tmp) / "prov.json").read_text())
            self.assertEqual(prov["endpoint"], inpaint.ENDPOINT)
            self.assertGreater(prov["mask"]["coverage"], 0)

    def test_dry_run_makes_no_calls(self):
        with tempfile.TemporaryDirectory() as tmp:
            image = Path(tmp) / "plate.png"
            image.write_bytes(solid_png(20, 20))
            fake = FakeHttp([])
            args = inpaint.parse_args(["--id", "51", "--image", str(image), "--ellipse", "10,10,4,4",
                                       "--prompt", "x", "--count", "3", "--dry-run"])
            with mock.patch.object(inpaint.gen, "http", return_value=fake):
                inpaint.run(args)
            self.assertEqual(fake.calls, [])

    def test_card_outputs_match_the_card_pipeline(self):
        outs = inpaint.card_outputs("public/cards/51.webp")
        self.assertEqual(outs[0], {"path": "public/cards/51.webp", "width": 768, "height": 1024, "format": "webp"})
        self.assertEqual(outs[1]["path"], "public/cards/thumbs/51.webp")
        self.assertEqual((outs[1]["width"], outs[1]["height"]), (192, 256))

    def test_export_must_stay_inside_out_root(self):
        with self.assertRaises(SystemExit):
            inpaint.gen.resolve_out(Path("/tmp/x"), "../escape.webp")


if __name__ == "__main__":
    unittest.main()
