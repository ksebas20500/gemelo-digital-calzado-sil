import json
from pathlib import Path

import numpy as np
from jsonschema import validate

from controller.inspection import InspectionController
from simulator.main import generar_imagen
from vision.detector import HeuristicDetector, encode_png_b64

CONTRACTS = Path(__file__).parent.parent / "contracts"


def _captura(defectuosa: bool, pieza_id: int = 1) -> dict:
    img = generar_imagen(np.random.default_rng(0), defectuosa)
    return {"pieza_id": pieza_id, "timestamp": 0.0, "imagen_png_b64": encode_png_b64(img)}


def test_pieza_buena_es_ok():
    d = InspectionController(detector=HeuristicDetector()).process(_captura(False))
    assert d["decision"] == "OK"


def test_pieza_defectuosa_se_rechaza():
    d = InspectionController(detector=HeuristicDetector()).process(_captura(True))
    assert d["decision"] == "RECHAZO"


def test_controlador_vuelve_a_espera():
    c = InspectionController(detector=HeuristicDetector())
    c.process(_captura(False))
    assert c.state == "espera"


def test_mensajes_cumplen_contrato():
    captura = _captura(True)
    validate(captura, json.loads((CONTRACTS / "captura.schema.json").read_text()))
    decision = InspectionController(detector=HeuristicDetector()).process(captura)
    validate(decision, json.loads((CONTRACTS / "decision.schema.json").read_text()))
