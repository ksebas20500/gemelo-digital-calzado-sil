import numpy as np

from vision.defect_type import crop_at_peak


def _image(size: int = 256) -> np.ndarray:
    # Each pixel encodes its own coordinates so the crop position is checkable.
    ys, xs = np.mgrid[0:size, 0:size]
    return np.stack([ys, xs, np.zeros_like(xs)], axis=-1).astype(np.uint16)


def test_crop_is_centered_on_the_anomaly_peak():
    heat = np.zeros((256, 256), dtype=np.float32)
    heat[120, 80] = 1.0
    crop = crop_at_peak(_image(), heat, size=64)
    assert crop.shape == (64, 64, 3)
    assert crop[32, 32, 0] == 120 and crop[32, 32, 1] == 80


def test_crop_stays_inside_the_image_near_the_border():
    heat = np.zeros((256, 256), dtype=np.float32)
    heat[2, 250] = 1.0
    crop = crop_at_peak(_image(), heat, size=64)
    assert crop.shape == (64, 64, 3)
    assert crop[0, 0, 0] == 0 and crop[0, -1, 1] == 255


def test_heatmap_with_a_different_resolution_is_scaled_to_the_image():
    heat = np.zeros((64, 64), dtype=np.float32)
    heat[32, 16] = 1.0  # center of the image vertically, a quarter horizontally
    crop = crop_at_peak(_image(256), heat, size=32)
    assert abs(int(crop[16, 16, 0]) - 130) <= 4
    assert abs(int(crop[16, 16, 1]) - 66) <= 4
