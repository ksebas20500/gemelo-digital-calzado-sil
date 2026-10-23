# Feature: vision model (anomaly detection + defect type)

Objective: replace the heuristic `vision/detector.py` stub with a trained model (PatchCore via Anomalib for OK/defect plus a small defect-type classifier) and run the SIL loop on real leather images.
Branch: `feat/web-mqtt` (user: "mejor creemos una ramita y al final hacemos el pr"). Delivery strategy: `single-pr` (one PR at the end, by user choice). Test runner: `pytest` (Python), `vitest` (web/).

## Specs

- **S1 — Approach (user choice, verbatim):** "Anomalías + tipo (Recommended)": "PatchCore (Anomalib) entrenado solo con piezas buenas decide OK/defecto y da un mapa de calor para ubicar el defecto; un clasificador pequeño pone el tipo (mancha, pegado, corte). Sin etiquetado manual. Costura queda fuera o sintética."
- **S2 — Dataset:** MVTec AD, category `leather` (CC BY-NC-SA 4.0, academic use). Defect mapping to project labels: `color` → `mancha`, `glue` → `pegado`, `cut` → `corte`, `fold` → `deformacion`, `poke` → `perforacion`. *Assumption:* `costura` stays out of scope for now (no public leather dataset has it); synthetic stitching is a possible follow-up.
- **S3 — OK/defect:** PatchCore trained only on `leather/train/good`. Report image AUROC, F1 at the chosen threshold, and per-defect recall on the test set.
- **S4 — Defect type:** small classifier (pretrained backbone features + linear model) trained on a fixed-seed stratified split of the defect images; report a confusion matrix on the held-out part. No manual labeling (labels come from MVTec folder names).
- **S5 — Localization:** keep the PatchCore anomaly map so the defect can be located (heatmap / bounding box).
- **S6 — Integration:** the new detector keeps the interface `predict(image) -> {"label": str, "score": float}` (`label == "ok"` means good piece) so `controller/` needs no change; `contracts/decision.schema.json` stays valid. *Assumption:* `score` is defined as a defect score in [0, 1] (Anomalib normalized `pred_score`) and documented in the contract.
- **S7 — SIL on real images:** *Assumption:* `simulator/` publishes held-out MVTec leather images (never seen in training) instead of synthetic squares, and records the ground truth locally (not in the message, the contract forbids extra fields) so the audit can measure missed defects.
- **S8 — KPIs (from docs/plan_desarrollo.md):** precision, recall per defect, false rejections, latency per piece "< 200 ms", throughput.
- **S9 — Reproducibility:** fixed seeds, scripted download/split/train/eval; data and weights are not committed (`data/`, `models/` gitignored); metrics are written to a committed report.

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S2, S9 | inline | done | `vision/dataset.py`, `requirements-vision.txt`; tests/test_dataset.py RED→GREEN; counts match MVTec (245 train, 124 test) |
| T2 | S3, S5, S8, S9 | inline | done | `reports/vision_patchcore.json`: image AUROC 1.0, F1 0.9945, pixel AUROC 0.992, 0 false rejections, 90/92 defects flagged |
| T3 | S4, S8, S9 | inline | done | `reports/vision_defect_type.json`: accuracy 0.737 on 38 held-out (54 train); crop test RED→GREEN |
| T4 | S6, S8 | inline | done | `vision/detector.py` (`DETECTOR=modelo|heuristico`), `reports/vision_pipeline.json`: 70/70 OK-vs-defect, type 0.737, latency p95 55 ms; 20 pytest pass |
| T7 | S3, S8 | inline | done | `vision/calibration.py` (Youden J, ties favor recall; rescale so threshold→0.5), threshold 0.6185 from 49 unseen train/good + 54 classifier defects; held-out: 0/32 false rejections, 38/38 caught, type 0.789, p95 49.5 ms; tests RED→GREEN (33 pytest pass) |
| T5 | S7 | inline | done | `simulator/main.py` (`IMAGENES=mvtec|sintetica`, `VERDAD_CSV`), `twin/audit.py`; tests RED→GREEN (28 pytest pass); E2E 30 pieces: 13/13 defects caught, 0 false rejections, type 9/13, 0 without decision |
| T8 | S6 | inline | done | web: live per-type chart counts any model label (starts empty), score shown as 'Puntuación de defecto' in MQTT mode; vitest RED→GREEN (31 pass), tsc clean |
| T6 | S1–S9 | inline | done | contract descriptions, guide section 7 + limitations, README, `agents/2026-10-23_modelo-vision.md` |

Route evidence: tasks are sequential (each depends on the previous one), so no Writer trigger applies; the parent works inline.

## Log

- **L1 (2026-10-23, user, verbatim):** "si" — answer to "¿Seguimos con el modelo de visión en esta rama?". Approach chosen: "Anomalías + tipo (Recommended)".
- **L2 (2026-10-23):** hardware: NVIDIA RTX 4050 Laptop (6 GB), 23 GB RAM, 153 GB free disk. Anomalib 2.x API confirmed via its docs: `MVTecAD`, `Patchcore`, `Engine.fit/test/export`, `TorchInferencer`; `pred_score` is normalized to [0, 1].
- **L3 (2026-10-23):** MVTec's own download links and the one inside Anomalib 2.7.0 return HTTP 404. Dataset fetched from the Hugging Face mirror `foersben/mvtec-ad` (original layout, CC BY-NC-SA 4.0); image counts verified against the official ones in `vision.dataset.download`.
- **L4 (2026-10-23):** Anomalib refuses pickled checkpoints unless `TRUST_REMOTE_CODE=1`. `vision/models.py::load_patchcore` enables it only while loading a file inside `models/` and restores it (tests/test_models.py, written together with the code, no RED phase).
- **L5 (2026-10-23):** caveat: with `val_split_mode=same_as_test` (default) Anomalib picks the decision threshold on the test images, so the perfect OK-vs-defect numbers are optimistic; held-out set is small (32 good, 38 defective). Tracked as T7.
- **L6 (2026-10-23):** E2E SIL run (Mosquitto, controller with DETECTOR=modelo, simulator IMAGENES=mvtec N_PIEZAS=30 P_DEFECTO=0.5, web in MQTT mode): web 30 inspected, 17 OK, 13 RECHAZO, latency mean 62 ms, 0 page errors; `twin.audit`: 0 missed, 0 false rejections, type 9/13. Web chart only knows mancha/costura/pegado → T8.
- **L7 (2026-10-23):** first T7 attempt (Anomalib `val_split_mode=synthetic`) kept AUROC 1.0 but gave 19/32 false rejections: synthetic anomalies calibrate the threshold badly. Replaced by calibration on real non-test images; train/good split by Anomalib is deterministic with seed 42 (196 fitted, 49 unseen).
- **L8 (2026-10-23):** margin is narrow: max good score 0.573 vs threshold 0.6185 vs min defect 0.713. Type confusions: perforacion→corte 3/7, deformacion→perforacion 2/7.
- **L9 (2026-10-23):** independent verifier (baseline ffe69a3): S1–S7 and S9 PASS, S8 PARTIAL (throughput missing → added `throughput_piezas_por_min`, ~1350/min detector capacity). KPIs recomputed match the report exactly; no file shared between calibration/training and held-out; load_patchcore refuses `..` and symlinks outside models/; HeuristicDetector identical to baseline on 300 synthetic images. Its security and audit probes were committed as tests (39 pytest pass). Advisory fixed: stale `build_datamodule` docstring. Open advisories: Anomalib F1 in vision_patchcore.json uses its own threshold (noted in the report); audit could match a later run's decision if a run lacks one; simulator default is now IMAGENES=mvtec.
- **Status:** feature complete; next step is the user's: PR (needs a fork or write access).
