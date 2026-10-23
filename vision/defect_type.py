"""Defect-type classifier.

PatchCore says *whether* a piece is defective and *where* (anomaly map). This
module crops the image around the anomaly peak and classifies that crop with
pretrained ResNet-18 features plus a logistic regression, so small defects are
not diluted by the rest of the leather.
"""
from pathlib import Path

import cv2
import joblib
import numpy as np

# Resolution the SIL simulator publishes and every model sees (pixels).
INPUT_SIZE = 256
CROP_SIZE = INPUT_SIZE // 4
_BACKBONE = None


def to_input(image_rgb: np.ndarray) -> np.ndarray:
    """Resizes an RGB image to the resolution used across the SIL loop."""
    if image_rgb.shape[:2] == (INPUT_SIZE, INPUT_SIZE):
        return image_rgb
    return cv2.resize(image_rgb, (INPUT_SIZE, INPUT_SIZE), interpolation=cv2.INTER_AREA)


def crop_at_peak(image: np.ndarray, heat: np.ndarray, size: int = CROP_SIZE) -> np.ndarray:
    """Square crop of `image` centered on the max of `heat`, kept inside the image.

    `heat` may have a different resolution than `image`; its peak is scaled.
    """
    h, w = image.shape[:2]
    iy, ix = np.unravel_index(int(np.argmax(heat)), heat.shape)
    cy = int((iy + 0.5) * h / heat.shape[0])
    cx = int((ix + 0.5) * w / heat.shape[1])
    top = min(max(cy - size // 2, 0), h - size)
    left = min(max(cx - size // 2, 0), w - size)
    return image[top : top + size, left : left + size]


def _backbone():
    """ImageNet ResNet-18 without its head (512-d features), loaded once."""
    global _BACKBONE
    if _BACKBONE is None:
        import torch
        from torchvision.models import ResNet18_Weights, resnet18

        weights = ResNet18_Weights.IMAGENET1K_V1
        model = resnet18(weights=weights)
        model.fc = torch.nn.Identity()
        model.eval()
        _BACKBONE = (model, weights.transforms())
    return _BACKBONE


def embed(crops: list[np.ndarray]) -> np.ndarray:
    """512-d feature vector per RGB uint8 crop."""
    import torch

    model, transform = _backbone()
    batch = torch.stack(
        [transform(torch.from_numpy(np.ascontiguousarray(c)).permute(2, 0, 1)) for c in crops]
    )
    with torch.no_grad():
        return model(batch).numpy()


class DefectTypeClassifier:
    def __init__(self, pipeline=None):
        self.pipeline = pipeline

    def fit(self, crops: list[np.ndarray], labels: list[str], seed: int = 42):
        from sklearn.linear_model import LogisticRegression
        from sklearn.pipeline import make_pipeline
        from sklearn.preprocessing import StandardScaler

        self.pipeline = make_pipeline(
            StandardScaler(),
            LogisticRegression(max_iter=5000, class_weight="balanced", random_state=seed),
        )
        self.pipeline.fit(embed(crops), labels)
        return self

    def predict(self, crops: list[np.ndarray]) -> list[tuple[str, float]]:
        probs = self.pipeline.predict_proba(embed(crops))
        classes = self.pipeline.classes_
        return [(str(classes[i]), float(p[i])) for p, i in zip(probs, probs.argmax(axis=1))]

    def save(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.pipeline, path)

    @classmethod
    def load(cls, path: Path) -> "DefectTypeClassifier":
        return cls(joblib.load(path))
