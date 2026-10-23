"""Decision threshold for PatchCore, calibrated on real images outside the test set.

Calibration set (vision.train_patchcore): the 20 % of train/good that PatchCore
never memorized plus the defect images reserved for the type classifier.
"""
import numpy as np


def choose_threshold(good: list[float], defect: list[float]) -> float:
    """Threshold maximizing TPR - FPR (Youden's J); ties favor catching defects.

    Candidates are the midpoints between consecutive distinct scores, so a
    perfectly separable set gets the middle of the gap.
    """
    if not good or not defect:
        raise ValueError("calibration needs good and defective scores")
    good_a, defect_a = np.asarray(good), np.asarray(defect)
    values = np.unique(np.concatenate([good_a, defect_a]))
    candidates = (values[:-1] + values[1:]) / 2 if len(values) > 1 else values

    def key(t: float) -> tuple[float, float]:
        tpr = float(np.mean(defect_a >= t))
        fpr = float(np.mean(good_a >= t))
        return (tpr - fpr, tpr)

    return float(max(candidates, key=key))


def rescale(score: float, threshold: float) -> float:
    """Monotonic map of [0, 1] onto [0, 1] that sends `threshold` to 0.5."""
    s = min(1.0, max(0.0, score))
    if s < threshold:
        return 0.5 * s / threshold
    return 0.5 + 0.5 * (s - threshold) / (1.0 - threshold)
