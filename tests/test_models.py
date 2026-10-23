import os

import pytest

import vision.models as vm
from vision.models import ROOT, load_patchcore


def test_refuses_to_unpickle_a_model_outside_models_dir(tmp_path):
    rogue = tmp_path / "model.pt"
    rogue.write_bytes(b"not a model")
    with pytest.raises(ValueError, match="outside"):
        load_patchcore(rogue)
    assert "TRUST_REMOTE_CODE" not in os.environ


def test_missing_model_explains_how_to_train_it():
    with pytest.raises(FileNotFoundError, match="vision.train_patchcore"):
        load_patchcore(ROOT / "models" / "does-not-exist" / "model.pt")
    assert "TRUST_REMOTE_CODE" not in os.environ


# Probes from the independent verification of the vision feature (2026-10-23).


def test_refuses_dotdot_path(tmp_path):
    outside = tmp_path / "evil.pt"; outside.write_bytes(b"x")
    rel = vm.MODELS_DIR / ".." / ".." / ".." / ".." / ".." / ".." / ".." / ".." / str(outside).lstrip("/")
    with pytest.raises(ValueError):
        vm.load_patchcore(rel)


def test_refuses_symlink_inside_models_pointing_outside(tmp_path, monkeypatch):
    fake_models = tmp_path / "models"; fake_models.mkdir()
    outside = tmp_path / "evil.pt"; outside.write_bytes(b"x")
    link = fake_models / "model.pt"; link.symlink_to(outside)
    monkeypatch.setattr(vm, "MODELS_DIR", fake_models)
    with pytest.raises(ValueError):
        vm.load_patchcore(link)


@pytest.mark.parametrize("previous", [None, "0"])
def test_flag_restored_when_loading_raises(tmp_path, monkeypatch, previous):
    fake_models = tmp_path / "models"; fake_models.mkdir()
    bad = fake_models / "bad.pt"; bad.write_bytes(b"not a pickle")
    monkeypatch.setattr(vm, "MODELS_DIR", fake_models)
    if previous is None:
        monkeypatch.delenv("TRUST_REMOTE_CODE", raising=False)
    else:
        monkeypatch.setenv("TRUST_REMOTE_CODE", previous)
    seen = {}
    import anomalib.deploy as ad
    class Boom:
        def __init__(self, path):
            seen["flag"] = os.environ.get("TRUST_REMOTE_CODE")
            raise RuntimeError("boom")
    monkeypatch.setattr(ad, "TorchInferencer", Boom)
    with pytest.raises(RuntimeError):
        vm.load_patchcore(bad)
    assert seen["flag"] == "1"
    assert os.environ.get("TRUST_REMOTE_CODE") == previous


@pytest.mark.skipif(not vm.PATCHCORE_PATH.is_file(), reason="trained model not available")
def test_real_model_loads_and_flag_restored(monkeypatch):
    monkeypatch.delenv("TRUST_REMOTE_CODE", raising=False)
    vm.load_patchcore()
    assert "TRUST_REMOTE_CODE" not in os.environ
