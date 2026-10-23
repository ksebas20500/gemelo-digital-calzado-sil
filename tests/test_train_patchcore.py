from anomalib.data.utils.split import ValSplitMode

from vision.train_patchcore import build_datamodule


def test_threshold_is_never_chosen_on_the_test_images():
    datamodule = build_datamodule()
    # SAME_AS_TEST (Anomalib's default) would tune the threshold on the very
    # images used to evaluate; synthetic anomalies from train/good avoid it.
    assert datamodule.val_split_mode == ValSplitMode.SYNTHETIC
    assert 0 < datamodule.val_split_ratio <= 0.25
