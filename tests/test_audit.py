import csv

from twin.audit import auditar
from twin.store import TwinStore


def _d(pid, ts, decision, label):
    return {"pieza_id": pid, "timestamp": ts, "decision": decision, "label": label,
            "score": 0.9 if decision == "RECHAZO" else 0.1, "latencia_ms": 5.0}


def test_cuenta_aciertos_rechazos_falsos_y_defectos_no_detectados():
    verdad = [
        {"pieza_id": 0, "verdad": "ok", "timestamp": 100.0},
        {"pieza_id": 1, "verdad": "mancha", "timestamp": 101.0},
        {"pieza_id": 2, "verdad": "corte", "timestamp": 102.0},
        {"pieza_id": 3, "verdad": "ok", "timestamp": 103.0},
    ]
    decisiones = [
        _d(0, 100.1, "OK", "ok"),
        _d(1, 101.1, "RECHAZO", "mancha"),
        _d(2, 102.1, "OK", "ok"),  # defect missed
        _d(3, 103.1, "RECHAZO", "pegado"),  # false rejection
    ]
    r = auditar(verdad, decisiones)
    assert r["piezas"] == 4 and r["sin_decision"] == 0
    assert r["defectos_no_detectados"] == 1
    assert r["rechazos_falsos"] == 1
    assert r["tipo_correcto"] == 1  # mancha
    assert r["no_detectados"] == [{"pieza_id": 2, "verdad": "corte"}]


def test_empareja_con_la_decision_de_la_misma_corrida():
    verdad = [{"pieza_id": 0, "verdad": "mancha", "timestamp": 500.0}]
    decisiones = [
        _d(0, 100.1, "OK", "ok"),  # previous run, same id
        _d(0, 500.2, "RECHAZO", "mancha"),
    ]
    r = auditar(verdad, decisiones)
    assert r["defectos_no_detectados"] == 0
    assert r["tipo_correcto"] == 1


def test_una_pieza_sin_decision_se_reporta_aparte():
    verdad = [{"pieza_id": 7, "verdad": "ok", "timestamp": 10.0}]
    r = auditar(verdad, [])
    assert r["sin_decision"] == 1 and r["piezas"] == 1
    assert r["rechazos_falsos"] == 0


# Probe from the independent verification (2026-10-23).


def test_two_runs_same_ids(tmp_path):
    store = TwinStore(str(tmp_path / "twin.db"))
    # run 1 (t=100..): everything OK
    for pid in range(3):
        store.save(_d(pid, 100 + pid + 0.05, "OK", "ok"))
    # run 2 (t=200..): piece 1 rejected as corte, piece 2 rejected (false)
    run2 = [_d(0, 200.05, "OK", "ok"), _d(1, 201.05, "RECHAZO", "corte"), _d(2, 202.05, "RECHAZO", "mancha")]
    for d in run2:
        store.save(d)
    p = tmp_path / "verdad.csv"
    with p.open("w", newline="") as f:
        w = csv.writer(f); w.writerow(["pieza_id", "archivo", "verdad", "timestamp"])
        w.writerows([[0, "a", "ok", 200.0], [1, "b", "corte", 201.0], [2, "c", "ok", 202.0], [3, "d", "pegado", 203.0]])
    verdad = list(csv.DictReader(p.open()))
    r = auditar(verdad, store.all())
    assert r["piezas"] == 4 and r["piezas_defectuosas"] == 2
    assert r["sin_decision"] == 1
    assert r["rechazos_falsos"] == 1
    assert r["defectos_no_detectados"] == 0
    assert r["tipo_correcto"] == 1
