"""Train the defect-type classifier and write its metrics.

Usage: python -m vision.train_defect_type   (after vision.train_patchcore)

Crops come from the trained PatchCore anomaly map, at the SIL input resolution
(vision.defect_type.INPUT_SIZE), so training sees what the line will see.
Labels come from the MVTec folder names; no manual labeling.
"""
import json

import numpy as np
from anomalib.deploy import TorchInferencer
from lightning.pytorch import seed_everything
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

from vision.dataset import DEFECT_LABELS, Sample, download, load_rgb, split_defects
from vision.defect_type import DefectTypeClassifier, crop_at_peak, to_input
from vision.models import DEFECT_TYPE_PATH, REPORTS_DIR, load_patchcore
from vision.train_patchcore import SEED

REPORT_PATH = REPORTS_DIR / "vision_defect_type.json"


def crops_for(samples: list[Sample], inferencer: TorchInferencer):
    crops, labels = [], []
    for path, label in samples:
        image = to_input(load_rgb(path))
        heat = inferencer.predict(image).anomaly_map.squeeze().cpu().numpy()
        crops.append(crop_at_peak(image, heat))
        labels.append(label)
    return crops, labels


def main() -> None:
    seed_everything(SEED)
    split = split_defects(download(), seed=SEED)
    inferencer = load_patchcore()
    train_crops, train_labels = crops_for(split["train"], inferencer)
    test_crops, test_labels = crops_for(split["test"], inferencer)

    classifier = DefectTypeClassifier().fit(train_crops, train_labels, seed=SEED)
    classifier.save(DEFECT_TYPE_PATH)
    predicted = [label for label, _ in classifier.predict(test_crops)]

    labels = sorted(DEFECT_LABELS.values())
    report = {
        "model": "ResNet-18 (ImageNet) features of the anomaly-peak crop + logistic regression",
        "crop": "64x64 px around the PatchCore anomaly peak, on 256x256 input",
        "seed": SEED,
        "train_images": len(train_labels),
        "test_images": len(test_labels),
        "accuracy": accuracy_score(test_labels, predicted),
        "per_class": {
            k: v
            for k, v in classification_report(
                test_labels, predicted, labels=labels, output_dict=True, zero_division=0
            ).items()
            if k in labels
        },
        "confusion_matrix": {
            "labels": labels,
            "rows_true_cols_predicted": confusion_matrix(
                test_labels, predicted, labels=labels
            ).tolist(),
        },
        "train_counts": {k: int(v) for k, v in zip(*np.unique(train_labels, return_counts=True))},
    }
    REPORT_PATH.parent.mkdir(exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
