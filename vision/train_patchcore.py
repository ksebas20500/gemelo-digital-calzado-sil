"""Train PatchCore on MVTec AD `leather`, export it and write its metrics.

Usage: python -m vision.train_patchcore

- Downloads MVTec AD `leather` into data/MVTecAD the first time
  (vision.dataset.download) and checks the official image counts.
- Trains only on `leather/train/good`.
- Exports the model to models/patchcore/ (TorchInferencer format).
- Calibrates the decision threshold on real images outside the test set
  (vision.calibration) and saves it to models/patchcore_threshold.json.
- Writes reports/vision_patchcore.json with Anomalib's test metrics plus
  per-defect recall, false rejections on good pieces and latency.
"""
import json
import time
from pathlib import Path

import numpy as np
from anomalib.data import MVTecAD
from anomalib.deploy import ExportType, TorchInferencer
from anomalib.engine import Engine
from anomalib.models import Patchcore
from lightning.pytorch import seed_everything

from vision.calibration import choose_threshold
from vision.dataset import (
    CATEGORY,
    DATA_ROOT,
    DEFECT_LABELS,
    category_dir,
    download,
    load_rgb,
    split_defects,
)
from vision.defect_type import to_input
from vision.models import PATCHCORE_DIR, REPORTS_DIR, ROOT, THRESHOLD_PATH, load_patchcore

REPORT_PATH = REPORTS_DIR / "vision_patchcore.json"
SEED = 42


def build_datamodule() -> MVTecAD:
    """MVTec leather with a validation split that never touches the test set.

    20 % of train/good is kept out of PatchCore's memory (Anomalib uses it
    for synthetic validation). Those images, plus the classifier's defects,
    calibrate the real decision threshold in calibrate(). Anomalib's default
    (same_as_test) would tune on the test images and make the report
    optimistic.
    """
    return MVTecAD(
        root=DATA_ROOT,
        category=CATEGORY,
        train_batch_size=16,
        eval_batch_size=16,
        num_workers=4,
        val_split_mode="synthetic",
        val_split_ratio=0.2,
        seed=SEED,
    )


def train() -> tuple[dict, list[Path]]:
    """Fits and exports PatchCore; returns Anomalib's test metrics and the
    train/good images PatchCore did not memorize (used for calibration)."""
    download()
    seed_everything(SEED, workers=True)
    datamodule = build_datamodule()
    model = Patchcore()
    engine = Engine(default_root_dir=ROOT / "results")
    engine.fit(model=model, datamodule=datamodule)
    metrics = engine.test(model=model, datamodule=datamodule)[0]
    engine.export(model=model, export_type=ExportType.TORCH, export_root=PATCHCORE_DIR)
    fitted = {Path(p).resolve() for p in datamodule.train_data.samples.image_path}
    unseen_good = [
        p for p in sorted((category_dir() / "train" / "good").glob("*.png"))
        if p.resolve() not in fitted
    ]
    return {k: float(v) for k, v in metrics.items()}, unseen_good


def raw_score(inferencer: TorchInferencer, path: Path) -> float:
    """Anomalib's normalized image score at the SIL input resolution."""
    return float(inferencer.predict(to_input(load_rgb(path))).pred_score.item())


def calibrate(inferencer: TorchInferencer, unseen_good: list[Path]) -> dict:
    """Threshold from real images outside the test set; saved for the detector."""
    defects = [p for p, _ in split_defects(category_dir(), seed=SEED)["train"]]
    threshold = choose_threshold(
        good=[raw_score(inferencer, p) for p in unseen_good],
        defect=[raw_score(inferencer, p) for p in defects],
    )
    calibration = {
        "threshold": threshold,
        "good_images": len(unseen_good),
        "defect_images": len(defects),
        "source": "train/good not memorized by PatchCore + defects reserved for the type classifier",
    }
    THRESHOLD_PATH.write_text(json.dumps(calibration, indent=2) + "\n")
    return calibration


def evaluate(inferencer: TorchInferencer, threshold: float) -> dict:
    """Runs the exported model on every test image (SIL resolution), by folder."""
    test_root = category_dir() / "test"
    per_folder: dict[str, dict] = {}
    latencies: list[float] = []
    for folder in sorted(p for p in test_root.iterdir() if p.is_dir()):
        scores = []
        images = sorted(folder.glob("*.png"))
        for image in images:
            t0 = time.perf_counter()
            scores.append(raw_score(inferencer, image))
            latencies.append((time.perf_counter() - t0) * 1000)
        flagged = sum(s >= threshold for s in scores)
        per_folder[folder.name] = {
            "images": len(images),
            "flagged_as_defect": flagged,
            "rate": flagged / len(images),
            "score_min": min(scores),
            "score_max": max(scores),
        }
    good = per_folder.pop("good")
    return {
        "false_rejection_rate": good["rate"],
        "good": good,
        "recall_per_defect": {
            DEFECT_LABELS[name]: stats for name, stats in per_folder.items()
        },
        # The first prediction includes model warm-up; report it apart.
        "latency_ms": {
            "first": latencies[0],
            "median": float(np.median(latencies[1:])),
            "p95": float(np.percentile(latencies[1:], 95)),
        },
    }


def main() -> None:
    anomalib_metrics, unseen_good = train()
    inferencer = load_patchcore()
    calibration = calibrate(inferencer, unseen_good)
    report = {
        "model": "PatchCore (anomalib 2.7.0, defaults: wide_resnet50_2, layer2+layer3)",
        "dataset": f"MVTec AD / {CATEGORY}",
        "seed": SEED,
        "device": str(inferencer.device),
        "anomalib_test_metrics": {
            "note": "F1 scores use Anomalib's own threshold (synthetic validation), not the calibrated one",
            **anomalib_metrics,
        },
        "calibration": calibration,
        **evaluate(inferencer, calibration["threshold"]),
    }
    REPORT_PATH.parent.mkdir(exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
