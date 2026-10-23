"""Auditoría de una corrida SIL: compara la verdad del simulador con el gemelo.

Uso: python -m twin.audit [runs/verdad.csv] [twin.db]

Cada pieza de la verdad se empareja con la primera decisión del gemelo con el
mismo pieza_id y timestamp posterior a su publicación (twin.db acumula
corridas y los ids se repiten entre ellas).
"""
import csv
import json
import sys
from pathlib import Path

from twin.store import DB_PATH, TwinStore


def auditar(verdad: list[dict], decisiones: list[dict]) -> dict:
    por_id: dict[int, list[dict]] = {}
    for d in sorted(decisiones, key=lambda d: d["timestamp"]):
        por_id.setdefault(int(d["pieza_id"]), []).append(d)

    sin_decision = rechazos_falsos = tipo_correcto = 0
    no_detectados = []
    for fila in verdad:
        pid, ts, real = int(fila["pieza_id"]), float(fila["timestamp"]), fila["verdad"]
        decision = next((d for d in por_id.get(pid, []) if d["timestamp"] >= ts), None)
        if decision is None:
            sin_decision += 1
        elif real == "ok" and decision["decision"] == "RECHAZO":
            rechazos_falsos += 1
        elif real != "ok" and decision["decision"] == "OK":
            no_detectados.append({"pieza_id": pid, "verdad": real})
        elif real != "ok" and decision["label"] == real:
            tipo_correcto += 1

    defectuosas = sum(1 for f in verdad if f["verdad"] != "ok")
    return {
        "piezas": len(verdad),
        "piezas_defectuosas": defectuosas,
        "sin_decision": sin_decision,
        "rechazos_falsos": rechazos_falsos,
        "defectos_no_detectados": len(no_detectados),
        "tipo_correcto": tipo_correcto,
        "no_detectados": no_detectados,
    }


def main() -> None:
    verdad_csv = Path(sys.argv[1] if len(sys.argv) > 1 else "runs/verdad.csv")
    db = sys.argv[2] if len(sys.argv) > 2 else DB_PATH
    with verdad_csv.open() as f:
        verdad = list(csv.DictReader(f))
    print(json.dumps(auditar(verdad, TwinStore(db).all()), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
