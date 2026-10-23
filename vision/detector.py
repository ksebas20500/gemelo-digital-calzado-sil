"""Defect detectors with the interface the SIL controller expects.

    predict(image_rgb) -> {"label": str, "score": float}

`label == "ok"` means a good piece; any other label is the defect type.
`score` is a defect score in [0, 1] (higher = more likely defective);
for ModelDetector, score >= 0.5 exactly when the piece is rejected.

Choose one with load_detector(name) or the DETECTOR environment variable:
- "modelo" (default): PatchCore + defect-type classifier (vision/train_*.py).
- "heuristico": the original dark-pixel heuristic, for tests and demos
  without trained models.
"""
import base64
import os

import cv2
import numpy as np


def decode_png_b64(data: str) -> np.ndarray:
    """Base64 PNG -> RGB uint8 array (grayscale PNGs become 3 equal channels)."""
    buf = np.frombuffer(base64.b64decode(data), dtype=np.uint8)
    image = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("la imagen no es un PNG válido")
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


def encode_png_b64(image: np.ndarray) -> str:
    """Grayscale or RGB uint8 array -> base64 PNG."""
    if image.ndim == 3:
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
    ok, buf = cv2.imencode(".png", image)
    if not ok:
        raise ValueError("no se pudo codificar la imagen")
    return base64.b64encode(buf.tobytes()).decode("ascii")


class HeuristicDetector:
    """Heurística: proporción de píxeles oscuros (mancha) sobre el umbral."""

    def __init__(self, dark_level: int = 60, defect_ratio: float = 0.01):
        self.dark_level = dark_level
        self.defect_ratio = defect_ratio

    def predict(self, image: np.ndarray) -> dict:
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY) if image.ndim == 3 else image
        ratio = float(np.mean(gray < self.dark_level))
        score = min(1.0, ratio / (self.defect_ratio * 4))
        label = "mancha" if ratio >= self.defect_ratio else "ok"
        return {"label": label, "score": score}


class ModelDetector:
    """PatchCore decides OK/defect; the type classifier names the defect."""

    def __init__(self):
        from vision.defect_type import DefectTypeClassifier
        from vision.models import DEFECT_TYPE_PATH, load_patchcore, load_threshold

        self.patchcore = load_patchcore()
        self.threshold = load_threshold()
        self.classifier = DefectTypeClassifier.load(DEFECT_TYPE_PATH)

    def predict(self, image: np.ndarray) -> dict:
        from vision.calibration import rescale
        from vision.defect_type import crop_at_peak, to_input

        image = to_input(image)
        pred = self.patchcore.predict(image)
        raw = float(pred.pred_score.item())
        # Calibrated threshold, rescaled so that score >= 0.5 means defect.
        score = rescale(raw, self.threshold)
        if raw < self.threshold:
            return {"label": "ok", "score": score}
        heat = pred.anomaly_map.squeeze().cpu().numpy()
        [(label, _)] = self.classifier.predict([crop_at_peak(image, heat)])
        return {"label": label, "score": score}


DETECTORS = {"modelo": ModelDetector, "heuristico": HeuristicDetector}


def load_detector(name: str | None = None):
    name = name or os.getenv("DETECTOR", "modelo")
    if name not in DETECTORS:
        raise ValueError(f"DETECTOR desconocido: {name!r}. Opciones: {', '.join(DETECTORS)}")
    return DETECTORS[name]()
