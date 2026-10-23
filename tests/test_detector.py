import numpy as np
import pytest

from vision.dataset import DEFECT_LABELS, category_dir, held_out_images, load_rgb
from vision.detector import (
    HeuristicDetector,
    decode_png_b64,
    encode_png_b64,
    load_detector,
)
from vision.models import DEFECT_TYPE_PATH, PATCHCORE_PATH, THRESHOLD_PATH

models_ready = pytest.mark.skipif(
    not all(p.exists() for p in (PATCHCORE_PATH, DEFECT_TYPE_PATH, THRESHOLD_PATH, category_dir())),
    reason="trained models or MVTec leather not available (run vision.train_*)",
)


def test_color_images_survive_the_png_round_trip():
    rgb = np.zeros((8, 8, 3), dtype=np.uint8)
    rgb[..., 0] = 200  # red channel only
    decoded = decode_png_b64(encode_png_b64(rgb))
    assert decoded.shape == (8, 8, 3)
    assert np.array_equal(decoded, rgb)


def test_grayscale_images_decode_as_three_channels():
    gray = np.full((8, 8), 90, dtype=np.uint8)
    decoded = decode_png_b64(encode_png_b64(gray))
    assert decoded.shape == (8, 8, 3)
    assert (decoded == 90).all()


def test_heuristic_detector_accepts_color_images():
    image = np.full((32, 32, 3), 180, dtype=np.uint8)
    assert HeuristicDetector().predict(image)["label"] == "ok"
    image[:10, :10] = 20
    assert HeuristicDetector().predict(image)["label"] == "mancha"


def test_detector_is_chosen_by_name():
    assert isinstance(load_detector("heuristico"), HeuristicDetector)
    with pytest.raises(ValueError, match="modelo.*heuristico"):
        load_detector("yolo")


@models_ready
def test_model_approves_a_held_out_good_piece():
    path = next(p for p, label in held_out_images(category_dir()) if label == "ok")
    result = load_detector("modelo").predict(load_rgb(path))
    assert result["label"] == "ok"
    assert 0.0 <= result["score"] < 0.5


@models_ready
def test_model_rejects_a_held_out_defect_with_a_project_label():
    path = next(p for p, label in held_out_images(category_dir()) if label != "ok")
    result = load_detector("modelo").predict(load_rgb(path))
    assert result["label"] in DEFECT_LABELS.values()
    assert 0.5 <= result["score"] <= 1.0
