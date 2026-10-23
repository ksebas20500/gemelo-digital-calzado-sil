"""Evaluate the full SIL detector on held-out images and write the KPIs.

Usage: python -m vision.evaluate   (after vision.train_patchcore and
vision.train_defect_type)

Uses only images no model was fitted on (vision.dataset.held_out_images),
at the resolution the simulator publishes, through the same ModelDetector
the controller loads. KPIs follow docs/plan_desarrollo.md.
"""
import json
import time

import numpy as np
import torch
from sklearn.metrics import confusion_matrix

from vision.dataset import DEFECT_LABELS, download, held_out_images, load_rgb
from vision.defect_type import INPUT_SIZE, to_input
from vision.detector import ModelDetector
from vision.models import REPORTS_DIR
from vision.train_patchcore import SEED

REPORT_PATH = REPORTS_DIR / "vision_pipeline.json"
LATENCY_TARGET_MS = 200


def main() -> None:
    samples = held_out_images(download(), seed=SEED)
    detector = ModelDetector()
    truth, predicted, latencies = [], [], []
    for path, label in samples:
        image = to_input(load_rgb(path))
        t0 = time.perf_counter()
        result = detector.predict(image)
        latencies.append((time.perf_counter() - t0) * 1000)
        truth.append(label)
        predicted.append(result["label"])

    truth_defect = np.array([t != "ok" for t in truth])
    pred_defect = np.array([p != "ok" for p in predicted])
    tp = int((truth_defect & pred_defect).sum())
    fp = int((~truth_defect & pred_defect).sum())
    fn = int((truth_defect & ~pred_defect).sum())
    steady = latencies[1:]  # the first call includes warm-up
    labels = ["ok", *sorted(DEFECT_LABELS.values())]

    report = {
        "images": len(samples),
        "input": f"{INPUT_SIZE}x{INPUT_SIZE} RGB (same as the simulator)",
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "ok_vs_defect": {
            "precision": tp / (tp + fp) if tp + fp else 0.0,
            "recall": tp / (tp + fn) if tp + fn else 0.0,
            "false_rejections": fp,
            "missed_defects": fn,
            "good_pieces": int((~truth_defect).sum()),
            "defective_pieces": int(truth_defect.sum()),
        },
        "recall_per_defect": {
            label: float(np.mean([p != "ok" for t, p in zip(truth, predicted) if t == label]))
            for label in sorted(DEFECT_LABELS.values())
        },
        "type_accuracy_on_detected_defects": float(
            np.mean([t == p for t, p in zip(truth, predicted) if t != "ok" and p != "ok"])
        ),
        "confusion_matrix": {
            "labels": labels,
            "rows_true_cols_predicted": confusion_matrix(truth, predicted, labels=labels).tolist(),
        },
        "latency_ms": {
            "first_call": latencies[0],
            "median": float(np.median(steady)),
            "p95": float(np.percentile(steady, 95)),
            "max": float(np.max(steady)),
            "target": LATENCY_TARGET_MS,
            "meets_target_p95": bool(np.percentile(steady, 95) < LATENCY_TARGET_MS),
        },
        # Detector capacity; the line's real rate is set by the simulator (INTERVALO_S).
        "throughput_piezas_por_min": 60000 / float(np.median(steady)),
    }
    REPORT_PATH.parent.mkdir(exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
