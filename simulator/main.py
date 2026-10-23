"""Planta virtual: banda con piezas (SimPy) y cámara virtual que publica por MQTT.

Fuente de imágenes (variable IMAGENES):
- "mvtec" (por defecto): imágenes reales de cuero de MVTec AD que ningún modelo
  vio al entrenar (vision.dataset.held_out_images), a 256x256 RGB.
- "sintetica": ruido gris con un cuadrado oscuro como defecto (versión inicial).

La verdad de cada pieza se guarda en VERDAD_CSV (no viaja en el mensaje: el
contrato no lo permite) para auditar después con `python -m twin.audit`.
"""
import csv
import json
import os
import time
from pathlib import Path

import numpy as np
import paho.mqtt.client as mqtt
import simpy

from vision.detector import encode_png_b64

HOST = os.getenv("MQTT_HOST", "localhost")
INTERVALO_S = float(os.getenv("INTERVALO_S", "1.0"))
P_DEFECTO = float(os.getenv("P_DEFECTO", "0.2"))
N_PIEZAS = int(os.getenv("N_PIEZAS", "50"))
IMAGENES = os.getenv("IMAGENES", "mvtec")
VERDAD_CSV = Path(os.getenv("VERDAD_CSV", "runs/verdad.csv"))
SEMILLA = int(os.getenv("SEMILLA", "42"))

Muestra = tuple[Path, str]


def generar_imagen(rng: np.random.Generator, defectuosa: bool) -> np.ndarray:
    img = rng.normal(180, 8, (128, 128)).clip(0, 255).astype(np.uint8)
    if defectuosa:
        x, y = rng.integers(20, 90, 2)
        img[y : y + 24, x : x + 24] = rng.integers(10, 40)
    return img


def elegir_muestra(
    rng: np.random.Generator, muestras: list[Muestra], p_defecto: float
) -> Muestra:
    """Pieza defectuosa con probabilidad p_defecto; si no, una pieza buena."""
    buenas = [m for m in muestras if m[1] == "ok"]
    malas = [m for m in muestras if m[1] != "ok"]
    grupo = malas if rng.random() < p_defecto else buenas
    return grupo[rng.integers(len(grupo))]


def imagen_de(path: Path) -> np.ndarray:
    from vision.dataset import load_rgb
    from vision.defect_type import to_input

    return to_input(load_rgb(path))


def guardar_verdad(destino: Path, filas: list[tuple[int, Path, str, float]]) -> None:
    """CSV pieza_id,archivo,verdad,timestamp (timestamp = instante de publicación)."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    with destino.open("w", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["pieza_id", "archivo", "verdad", "timestamp"])
        w.writerows((pid, str(archivo), verdad, ts) for pid, archivo, verdad, ts in filas)


def banda(env, client, rng):
    muestras = None
    if IMAGENES == "mvtec":
        from vision.dataset import download, held_out_images

        muestras = held_out_images(download(), seed=SEMILLA)
    elif IMAGENES != "sintetica":
        raise ValueError(f"IMAGENES desconocido: {IMAGENES!r}. Opciones: mvtec, sintetica")
    filas = []
    for pieza_id in range(N_PIEZAS):
        yield env.timeout(INTERVALO_S)
        if muestras:
            archivo, verdad = elegir_muestra(rng, muestras, P_DEFECTO)
            img = imagen_de(archivo)
        else:
            defectuosa = rng.random() < P_DEFECTO
            archivo, verdad = Path("sintetica"), "mancha" if defectuosa else "ok"
            img = generar_imagen(rng, defectuosa)
        ahora = time.time()
        msg = {"pieza_id": pieza_id, "timestamp": ahora, "imagen_png_b64": encode_png_b64(img)}
        client.publish("planta/camara/captura", json.dumps(msg))
        filas.append((pieza_id, archivo, verdad, ahora))
        guardar_verdad(VERDAD_CSV, filas)  # rewritten each piece: survives Ctrl+C


if __name__ == "__main__":
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.connect(HOST, 1883)
    client.loop_start()
    env = simpy.rt.RealtimeEnvironment(factor=1.0, strict=False)
    env.process(banda(env, client, np.random.default_rng(SEMILLA)))
    env.run()
    client.loop_stop()
