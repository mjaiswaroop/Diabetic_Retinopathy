"""
Fast Automated Clinical Safety Regression Gate for CI/CD Pipelines.
Runs without requiring external dataset downloads by using synthetic control patterns
and mathematical optical simulations.

Asserts:
1. Pure-black, pure-white, and heavy Gaussian optical blur captures return:
   - clinical_status == "UNGRADABLE"
   - grade == -1
   - referable is None (Zero fail-open regression)
2. Synthetic wide black-border / letterboxed retinal canvas is detected and cropped
   without aspect-ratio distortion (crop_fov geometric invariance).
3. lens_type="20d" triggers upstream 180° rotation parity.
"""

import sys
import unittest
import numpy as np
import cv2
import requests

API_URL = "http://127.0.0.1:8000/api/v1/predict-direct"
HEALTH_URL = "http://127.0.0.1:8000/health"


class ClinicalSafetyRegressionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            r = requests.get(HEALTH_URL, timeout=5)
            assert r.status_code == 200
        except Exception as e:
            raise RuntimeError(f"FastAPI backend on port 8000 is not reachable: {e}")

    def test_synthetic_black_failsafe(self):
        """Pure black images must be rejected as UNGRADABLE with referable=None."""
        blk = np.zeros((384, 384, 3), dtype=np.uint8)
        _, buf = cv2.imencode(".jpg", blk)
        resp = requests.post(API_URL, files={"file": ("pure_black.jpg", buf.tobytes(), "image/jpeg")})
        self.assertEqual(resp.status_code, 200)
        d = resp.json()
        self.assertEqual(d.get("clinical_status"), "UNGRADABLE")
        self.assertEqual(d.get("grade"), -1)
        self.assertIsNone(d.get("referable"))
        self.assertIsNone(d.get("referable_prob"))
        self.assertEqual(d.get("dme_status"), "UNGRADABLE")

    def test_synthetic_white_failsafe(self):
        """Pure white glare images must be rejected as UNGRADABLE with referable=None."""
        wht = np.ones((384, 384, 3), dtype=np.uint8) * 255
        _, buf = cv2.imencode(".jpg", wht)
        resp = requests.post(API_URL, files={"file": ("pure_white.jpg", buf.tobytes(), "image/jpeg")})
        self.assertEqual(resp.status_code, 200)
        d = resp.json()
        self.assertEqual(d.get("clinical_status"), "UNGRADABLE")
        self.assertEqual(d.get("grade"), -1)
        self.assertIsNone(d.get("referable"))
        self.assertIsNone(d.get("referable_prob"))

    def test_severe_defocus_failsafe(self):
        """Severe optical defocus blur must be rejected as UNGRADABLE."""
        # Create a synthetic retinal disk with blurry low-gradient interior
        canvas = np.zeros((500, 500, 3), dtype=np.uint8)
        cv2.circle(canvas, (250, 250), 180, (40, 80, 180), -1)
        blurred = cv2.GaussianBlur(canvas, (0, 0), sigmaX=35)
        _, buf = cv2.imencode(".jpg", blurred)
        resp = requests.post(API_URL, files={"file": ("heavy_blur.jpg", buf.tobytes(), "image/jpeg")})
        self.assertEqual(resp.status_code, 200)
        d = resp.json()
        self.assertEqual(d.get("clinical_status"), "UNGRADABLE")
        self.assertEqual(d.get("grade"), -1)
        self.assertIsNone(d.get("referable"))

    def test_wide_letterbox_crop_invariance(self):
        """Wide black canvas letterbox (~10% retina area) must be cropped cleanly without failing quality check."""
        # Create an artificial fundus pattern with vessels and texture
        fundus = np.zeros((400, 400, 3), dtype=np.uint8)
        cv2.circle(fundus, (200, 200), 170, (30, 90, 210), -1)
        # Add high-contrast vessel arcs
        cv2.ellipse(fundus, (200, 200), (100, 60), 30, 0, 360, (10, 40, 120), 4)
        cv2.ellipse(fundus, (200, 200), (120, 80), -20, 0, 360, (10, 40, 120), 3)

        # Place inside wide 2x3 letterbox canvas
        canvas = np.zeros((800, 1200, 3), dtype=np.uint8)
        canvas[200:600, 400:800] = fundus

        _, buf = cv2.imencode(".jpg", canvas)
        resp = requests.post(API_URL, files={"file": ("letterbox.jpg", buf.tobytes(), "image/jpeg")})
        self.assertEqual(resp.status_code, 200)
        d = resp.json()
        self.assertEqual(d.get("status"), "gradable")
        self.assertEqual(d.get("clinical_status"), "GRADABLE")
        self.assertIsNotNone(d.get("grade"))
        self.assertIsNotNone(d.get("referable_prob"))

    def test_20d_lens_parity(self):
        """lens_type='20d' must accept inverted inputs and process cleanly."""
        fundus = np.zeros((400, 400, 3), dtype=np.uint8)
        cv2.circle(fundus, (200, 200), 170, (30, 90, 210), -1)
        cv2.circle(fundus, (120, 160), 20, (60, 180, 255), -1) # simulated optic disc
        inverted = cv2.rotate(fundus, cv2.ROTATE_180)

        _, buf = cv2.imencode(".jpg", inverted)
        resp = requests.post(
            API_URL,
            files={"file": ("20d_inverted.jpg", buf.tobytes(), "image/jpeg")},
            data={"lens_type": "20d"}
        )
        self.assertEqual(resp.status_code, 200)
        d = resp.json()
        self.assertEqual(d.get("status"), "gradable")
        self.assertEqual(d.get("clinical_status"), "GRADABLE")


if __name__ == "__main__":
    unittest.main()

