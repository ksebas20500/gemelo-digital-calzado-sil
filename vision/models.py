"""Locations of the trained models and a safe loader for PatchCore."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = ROOT / "models"
PATCHCORE_DIR = MODELS_DIR / "patchcore"
PATCHCORE_PATH = PATCHCORE_DIR / "weights" / "torch" / "model.pt"
DEFECT_TYPE_PATH = MODELS_DIR / "defect_type.joblib"
THRESHOLD_PATH = MODELS_DIR / "patchcore_threshold.json"
REPORTS_DIR = ROOT / "reports"


def load_patchcore(path: Path = PATCHCORE_PATH):
    """Loads the PatchCore model exported by vision.train_patchcore.

    Anomalib refuses pickled checkpoints unless TRUST_REMOTE_CODE=1, because
    unpickling can run code. We only trust files trained locally into
    models/, so the flag is enabled just for this load and only for a file
    inside that folder; it is restored afterwards.
    """
    from anomalib.deploy import TorchInferencer

    path = Path(path).resolve()
    if not path.is_relative_to(MODELS_DIR.resolve()):
        raise ValueError(f"Refusing to unpickle a model outside {MODELS_DIR}: {path}")
    if not path.is_file():
        raise FileNotFoundError(
            f"{path} not found. Train it with: python -m vision.train_patchcore"
        )
    previous = os.environ.get("TRUST_REMOTE_CODE")
    os.environ["TRUST_REMOTE_CODE"] = "1"
    try:
        return TorchInferencer(path)
    finally:
        if previous is None:
            os.environ.pop("TRUST_REMOTE_CODE", None)
        else:
            os.environ["TRUST_REMOTE_CODE"] = previous


def load_threshold(path: Path = THRESHOLD_PATH) -> float:
    """Calibrated PatchCore threshold written by vision.train_patchcore."""
    import json

    if not path.is_file():
        raise FileNotFoundError(
            f"{path} not found. Train it with: python -m vision.train_patchcore"
        )
    return float(json.loads(path.read_text())["threshold"])
