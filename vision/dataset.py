"""MVTec AD `leather` dataset: project labels and a reproducible split.

PatchCore trains only on `leather/train/good`. The defect images in
`leather/test/<defect>` are split per defect type:
- "train": used to fit the defect-type classifier.
- "test": held out for evaluation and for the SIL simulator.
"""
from pathlib import Path

import numpy as np

DATA_ROOT = Path(__file__).resolve().parent.parent / "data" / "MVTecAD"
CATEGORY = "leather"

# MVTec folder name -> project label (docs/plan_desarrollo.md defect catalog).
DEFECT_LABELS = {
    "color": "mancha",
    "glue": "pegado",
    "cut": "corte",
    "fold": "deformacion",
    "poke": "perforacion",
}

Sample = tuple[Path, str]


def category_dir(root: Path = DATA_ROOT) -> Path:
    return root / CATEGORY


# MVTec's own links (and the one inside Anomalib 2.7.0) returned 404 on
# 2026-10-23, so the category is fetched from a Hugging Face mirror that keeps
# the original layout and license (CC BY-NC-SA 4.0).
MIRROR_REPO = "foersben/mvtec-ad"
EXPECTED_COUNTS = {
    "train/good": 245,
    "test/good": 32,
    "test/color": 19,
    "test/cut": 19,
    "test/fold": 17,
    "test/glue": 19,
    "test/poke": 18,
}


def download(root: Path = DATA_ROOT) -> Path:
    """Fetches MVTec AD `leather` if missing and checks the official counts."""
    category = category_dir(root)
    if not category.is_dir():
        from huggingface_hub import snapshot_download

        snapshot_download(
            MIRROR_REPO,
            repo_type="dataset",
            allow_patterns=[f"{CATEGORY}/**", "license.txt", "readme.txt"],
            local_dir=root,
        )
    for folder, expected in EXPECTED_COUNTS.items():
        found = len(_images(category / folder))
        if found != expected:
            raise RuntimeError(
                f"{category / folder}: {found} images, expected {expected} "
                "(MVTec AD official counts). Delete the folder and retry."
            )
    return category


def _images(folder: Path) -> list[Path]:
    return sorted(folder.glob("*.png"))


def load_rgb(path: Path) -> np.ndarray:
    """Reads an image as an RGB uint8 array."""
    import cv2

    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise FileNotFoundError(path)
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


def split_defects(
    category: Path, test_fraction: float = 0.4, seed: int = 42
) -> dict[str, list[Sample]]:
    """Stratified, deterministic split of the defect images by type."""
    test_root = category / "test"
    if not test_root.is_dir():
        raise FileNotFoundError(
            f"MVTec AD '{CATEGORY}' not found in {category}. "
            "Run: python -m vision.train_patchcore (it downloads the dataset)."
        )
    rng = np.random.default_rng(seed)
    split: dict[str, list[Sample]] = {"train": [], "test": []}
    for folder, label in sorted(DEFECT_LABELS.items()):
        images = _images(test_root / folder)
        order = rng.permutation(len(images))
        n_test = round(len(images) * test_fraction)
        split["test"] += [(images[i], label) for i in order[:n_test]]
        split["train"] += [(images[i], label) for i in order[n_test:]]
    return split


def held_out_images(category: Path, seed: int = 42) -> list[Sample]:
    """Images no model was fitted on: good test pieces plus held-out defects."""
    good = [(p, "ok") for p in _images(category / "test" / "good")]
    return good + split_defects(category, seed=seed)["test"]
