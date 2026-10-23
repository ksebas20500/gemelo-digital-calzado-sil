import pytest

from vision.calibration import choose_threshold, rescale


def test_separable_scores_put_the_threshold_in_the_middle_of_the_gap():
    t = choose_threshold(good=[0.40, 0.45, 0.50], defect=[0.70, 0.90, 1.0])
    assert t == pytest.approx(0.60)


def test_overlapping_scores_maximize_correct_decisions_on_both_classes():
    good = [0.1, 0.2, 0.3, 0.6]
    defect = [0.5, 0.7, 0.8, 0.9]
    t = choose_threshold(good, defect)
    # Best split: 3/4 good below and 4/4 defects at or above -> between 0.3 and 0.5.
    assert 0.3 < t <= 0.5
    assert sum(g >= t for g in good) == 1
    assert all(d >= t for d in defect)


def test_rescale_maps_the_threshold_to_one_half_and_keeps_the_order():
    t = 0.62
    assert rescale(t, t) == pytest.approx(0.5)
    assert rescale(0.0, t) == 0.0 and rescale(1.0, t) == 1.0
    values = [0.0, 0.3, 0.61, 0.62, 0.63, 0.9, 1.0]
    scaled = [rescale(v, t) for v in values]
    assert scaled == sorted(scaled)
    assert rescale(0.61, t) < 0.5 <= rescale(0.62, t)


def test_needs_both_classes():
    with pytest.raises(ValueError):
        choose_threshold(good=[0.1], defect=[])
