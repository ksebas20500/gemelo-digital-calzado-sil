from pathlib import Path

import cv2
import numpy as np
import pytest

from simulator.main import elegir_muestra, guardar_verdad, imagen_de

MUESTRAS = [
    (Path("good/000.png"), "ok"),
    (Path("good/001.png"), "ok"),
    (Path("color/000.png"), "mancha"),
    (Path("cut/000.png"), "corte"),
]


@pytest.mark.parametrize("p_defecto, esperado_ok", [(0.0, True), (1.0, False)])
def test_p_defecto_decide_si_sale_una_pieza_defectuosa(p_defecto, esperado_ok):
    rng = np.random.default_rng(0)
    for _ in range(20):
        _, verdad = elegir_muestra(rng, MUESTRAS, p_defecto)
        assert (verdad == "ok") is esperado_ok


def test_la_eleccion_es_reproducible_con_la_misma_semilla():
    a = [elegir_muestra(np.random.default_rng(5), MUESTRAS, 0.5) for _ in range(10)]
    b = [elegir_muestra(np.random.default_rng(5), MUESTRAS, 0.5) for _ in range(10)]
    assert a == b


def test_la_imagen_publicada_es_rgb_de_256(tmp_path):
    path = tmp_path / "x.png"
    cv2.imwrite(str(path), np.zeros((1024, 1024, 3), dtype=np.uint8))
    assert imagen_de(path).shape == (256, 256, 3)


def test_la_verdad_se_guarda_por_pieza(tmp_path):
    csv = tmp_path / "verdad.csv"
    guardar_verdad(
        csv, [(0, Path("good/000.png"), "ok", 10.5), (1, Path("cut/000.png"), "corte", 11.5)]
    )
    lineas = csv.read_text().splitlines()
    assert lineas == [
        "pieza_id,archivo,verdad,timestamp",
        "0,good/000.png,ok,10.5",
        "1,cut/000.png,corte,11.5",
    ]
