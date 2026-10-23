from pathlib import Path

import pytest

from vision.dataset import DEFECT_LABELS, held_out_images, split_defects


def _fake_leather(root: Path, per_class: int = 10, good_test: int = 4) -> Path:
    category = root / "leather"
    for name in ["color", "cut", "fold", "glue", "poke"]:
        folder = category / "test" / name
        folder.mkdir(parents=True)
        for i in range(per_class):
            (folder / f"{i:03d}.png").write_bytes(b"")
    good = category / "test" / "good"
    good.mkdir(parents=True)
    for i in range(good_test):
        (good / f"{i:03d}.png").write_bytes(b"")
    return category


def test_maps_every_mvtec_defect_to_a_project_label():
    assert DEFECT_LABELS == {
        "color": "mancha",
        "glue": "pegado",
        "cut": "corte",
        "fold": "deformacion",
        "poke": "perforacion",
    }


def test_split_is_stratified_disjoint_and_complete(tmp_path):
    category = _fake_leather(tmp_path)
    split = split_defects(category, test_fraction=0.4, seed=42)

    train = {p for p, _ in split["train"]}
    test = {p for p, _ in split["test"]}
    assert not train & test
    assert len(train) + len(test) == 50
    for label in DEFECT_LABELS.values():
        assert sum(1 for _, lab in split["test"] if lab == label) == 4
        assert sum(1 for _, lab in split["train"] if lab == label) == 6


def test_split_is_reproducible_and_depends_on_the_seed(tmp_path):
    category = _fake_leather(tmp_path)
    assert split_defects(category, seed=7) == split_defects(category, seed=7)
    assert split_defects(category, seed=7) != split_defects(category, seed=8)


def test_held_out_images_never_include_classifier_training_images(tmp_path):
    category = _fake_leather(tmp_path)
    split = split_defects(category, seed=42)
    held_out = held_out_images(category, seed=42)

    train = {p for p, _ in split["train"]}
    assert not train & {p for p, _ in held_out}
    assert sum(1 for _, lab in held_out if lab == "ok") == 4
    assert len(held_out) == 4 + len(split["test"])


def test_missing_dataset_fails_with_a_clear_message(tmp_path):
    with pytest.raises(FileNotFoundError, match="MVTec"):
        split_defects(tmp_path / "leather")
