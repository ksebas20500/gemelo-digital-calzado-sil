# Guía del sistema: cómo funciona todo

Esta guía es para que cualquiera del equipo entienda el prototipo sin leer todo el código.

## 1. La idea en una frase

Una banda transportadora virtual trae zapatos. Una cámara virtual les toma una foto, un módulo de visión decide si tienen defecto, y un controlador ordena aprobar o rechazar la pieza. Todo corre como software (SIL, Software-in-the-Loop), sin PLC ni cámara reales. El **gemelo digital** es la copia viva de ese estado: contadores, decisiones e historial.

## 2. Arquitectura

```
 simulator/            MQTT                controller/ + vision/          twin/            dashboard/
 Banda (SimPy)   --planta/camara/captura-->  Máquina de estados    --->  SQLite (twin.db) --> Streamlit
 Cámara virtual                              + Detector (stub)
                  <--planta/control/decision-- publica OK / RECHAZO
                              │
                              └── MQTT por WebSocket (puerto 9001) --> web/ (interfaz del gemelo, modo "MQTT en vivo")
```

Los componentes **no se llaman entre sí**: se comunican por mensajes MQTT (broker Mosquitto). Así se puede cambiar uno sin tocar los otros.

## 3. Qué hay en cada carpeta

| Ruta | Qué hace |
|---|---|
| `simulator/main.py` | Planta virtual con SimPy. Cada `INTERVALO_S` segundos publica una pieza: por defecto una imagen real de cuero de MVTec AD que ningún modelo vio al entrenar (256×256 RGB), defectuosa con probabilidad `P_DEFECTO`. Guarda la verdad de cada pieza en `VERDAD_CSV` para auditar. Con `IMAGENES=sintetica` vuelve a la imagen sintética inicial. |
| `vision/detector.py` | Detectores con `predict(image) -> {label, score}`: `ModelDetector` (PatchCore + clasificador de tipo, por defecto) y `HeuristicDetector` (la heurística inicial). Se elige con `DETECTOR=modelo|heuristico`. También codifica y decodifica PNG en base64 (RGB). |
| `vision/train_*.py`, `vision/evaluate.py` | Descargan el dataset, entrenan PatchCore y el clasificador de tipo y evalúan la cadena completa. Escriben las métricas en `reports/`. Ver sección 7. |
| `controller/inspection.py` | `InspectionController`: máquina de estados `espera → captura → inferencia → decisión → espera`. `process(captura)` devuelve el mensaje de decisión. No depende de MQTT, por eso es fácil de probar. |
| `controller/main.py` | Conecta el controlador a MQTT: escucha capturas, procesa, guarda en el gemelo y publica la decisión. |
| `twin/store.py` | `TwinStore`: guarda cada decisión en SQLite (`twin.db`). Es la memoria del gemelo. |
| `twin/audit.py` | Compara la verdad del simulador (`VERDAD_CSV`) con las decisiones de `twin.db`: defectos no detectados, rechazos falsos y tipo correcto. |
| `dashboard/app.py` | Pantalla Streamlit: conteo OK/RECHAZO, latencia media e historial leyendo `twin.db`. |
| `contracts/` | Formato de los mensajes (`topics.md` y esquemas JSON). Es el acuerdo entre componentes. |
| `web/` | Interfaz web del gemelo (React + Vite + Tailwind): banda en 2D, KPIs, última captura, controles y registro. Tiene dos modos: simulación local en el navegador o "MQTT en vivo", que muestra lo que publican `simulator/` y `controller/`. |
| `agents/` | Registro de prompts y salidas de IA generativa (objetivos 4 y 5 del proyecto). |
| `tests/` | Pruebas con pytest: decisiones correctas, estados y cumplimiento de contratos. |
| `docker-compose.yml`, `mosquitto/` | Broker MQTT local. |
| `docs/` | Contexto, plan de desarrollo y esta guía. |

## 4. Recorrido de una pieza

1. `simulator` crea la pieza `n` y publica en `planta/camara/captura`:
   `{"pieza_id": n, "timestamp": ..., "imagen_png_b64": "..."}`
2. `controller` recibe el mensaje y pasa por los estados:
   - **espera**: no hay pieza en proceso.
   - **captura**: recibe y decodifica la imagen.
   - **inferencia**: llama a `predict()` del detector elegido con `DETECTOR`.
   - **decisión**: `label == "ok"` → `OK`; cualquier otro → `RECHAZO`. Mide la latencia.
3. Guarda la decisión en `twin.db` y publica en `planta/control/decision`:
   `{"pieza_id", "timestamp", "decision", "label", "score", "latencia_ms"}`
4. `dashboard` lee `twin.db` y refresca los números.

## 5. Cómo ejecutarlo

Requisitos: Python 3.12 o 3.13 (con 3.14 Streamlit/Pillow puede no compilar) y Docker (o Mosquitto instalado).

```bash
uv venv --python 3.12 .venv && source .venv/bin/activate
uv pip install -r requirements.txt -r requirements-vision.txt   # sin GPU también funciona, más lento
python -m vision.train_patchcore && python -m vision.train_defect_type   # una vez (sección 7)

docker compose up -d mosquitto
# Sin Docker (macOS): brew install mosquitto && mosquitto -c mosquitto/mosquitto.conf

python -m controller.main         # terminal 1 (arrancar primero)
python -m simulator.main          # terminal 2
streamlit run dashboard/app.py    # terminal 3
cd web && pnpm dev                # terminal 4 (opcional): interfaz web, botón "MQTT en vivo"

python -m twin.audit              # al terminar: verdad del simulador vs. decisiones del gemelo
pytest                            # pruebas
```

Variables de entorno: `MQTT_HOST`, `INTERVALO_S` (def. 1.0), `P_DEFECTO` (def. 0.2), `N_PIEZAS` (def. 50), `IMAGENES` (`mvtec` o `sintetica`, def. `mvtec`), `SEMILLA` (def. 42), `VERDAD_CSV` (def. `runs/verdad.csv`), `DETECTOR` (`modelo` o `heuristico`, def. `modelo`), `TWIN_DB`.
Ejemplo rápido: `INTERVALO_S=0.2 N_PIEZAS=100 python -m simulator.main`. Sin modelos entrenados: `DETECTOR=heuristico` en el controlador e `IMAGENES=sintetica` en el simulador.

## 6. Interfaz web (simulador 2D)

Requisitos: Node.js 22 y pnpm.

```bash
cd web
pnpm install
pnpm dev          # abre la interfaz en http://localhost:5173
pnpm test         # pruebas de la lógica de simulación (vitest)
pnpm build        # chequeo de tipos + build de producción en web/dist
```

Muestra la banda en vista superior, la cámara, el actuador de rechazo y las cajas OK/RECHAZO, con los estados del controlador (espera → captura → inferencia → decisión) iluminándose en orden. Diseño generado con Figma Make y adaptado al proyecto.

- **Controles:** pausar, reiniciar, velocidad, probabilidad de defecto, **sensibilidad del detector** (si baja del 100 %, algunos defectos pasan sin detectarse) e inyección de un defecto concreto (mancha, costura o pegado).
- **Escenarios:** operación normal, ráfaga de defectos, cámara degradada (baja la sensibilidad y sube la latencia) y pérdida de mensajes (el 15 % de las decisiones no llega al gemelo).
- **Planta vs. gemelo:** las cajas OK/RECHAZO cuentan lo que pasó físicamente; los KPIs cuentan solo los mensajes de decisión que recibió el gemelo. En el escenario de pérdida de mensajes ambos números divergen a propósito.
- **Defectos no detectados:** el controlador los aprueba, así que cuentan como OK y caen en la caja OK. El KPI "Defectos no detectados" usa la verdad de la simulación para medirlos.
- **Mensaje de decisión:** el JSON de "Última captura" sigue `contracts/decision.schema.json` (`decision` es siempre `OK` o `RECHAZO`).

**Modo "MQTT en vivo"** (selector arriba a la derecha): la interfaz se conecta al broker por WebSocket (`ws://localhost:9001`, configurable con la variable `VITE_MQTT_URL`) y se suscribe a `planta/camara/captura` y `planta/control/decision`.

- Cada captura coloca la pieza en la cámara y muestra la **imagen real** que generó `simulator/`; cada decisión la clasifica y actualiza KPIs, cajas y registro.
- Los mensajes que no cumplen `contracts/` se descartan y se cuentan como "inválidos".
- Una captura sin decisión durante 5 s se descarta y se cuenta como "sin decisión" (controlador caído o mensaje perdido).
- Los controles de la simulación se desactivan: la línea la mueve `simulator/` con sus variables de entorno.
- "Defectos no detectados" muestra "—": sin la verdad de la simulación no se puede medir en vivo.

Para probarlo: `docker compose up -d mosquitto`, luego `python -m controller.main`, abrir la interfaz con `pnpm dev`, elegir "MQTT en vivo" y ejecutar `python -m simulator.main`.

Código: la lógica está en `web/src/sim/` (sin React, con pruebas), la conexión MQTT y la validación de mensajes en `web/src/live/`, y la interfaz en `web/src/components/`. Los tiempos de la simulación local son ilustrativos.

## 7. Modelo de visión

**Enfoque:** anomalías + tipo.
1. **PatchCore** (biblioteca Anomalib) aprende solo con piezas buenas y decide si la pieza es OK o defectuosa. Además devuelve un mapa de calor que ubica el defecto.
2. Si hay defecto, se recorta la imagen alrededor del punto más anómalo, y un **clasificador** (características de ResNet-18 + regresión logística) le pone el tipo.

No requiere etiquetado manual: los tipos salen de las carpetas del dataset.

**Dataset:** MVTec AD, categoría `leather` (licencia CC BY-NC-SA 4.0, solo uso no comercial). Los enlaces oficiales de MVTec devuelven 404, así que `vision/dataset.py` lo baja de un espejo de Hugging Face y verifica que la cantidad de imágenes coincida con la oficial.

| Carpeta de MVTec | Etiqueta del proyecto |
|---|---|
| `color` | `mancha` |
| `glue` | `pegado` |
| `cut` | `corte` |
| `fold` | `deformacion` |
| `poke` | `perforacion` |

`costura` no existe en datasets públicos de cuero y queda fuera por ahora.

**Qué datos usa cada parte (separación):**
- PatchCore se entrena con el 80 % de `train/good` (196 piezas).
- Las imágenes con defecto se reparten por tipo, con semilla fija: 60 % para entrenar el clasificador y 40 % reservadas.
- El **umbral de decisión** se calibra con imágenes reales que no son de prueba: el 20 % de `train/good` que PatchCore no memorizó (49 piezas) y los defectos del clasificador. Se elige el que mejor separa ambos grupos; ante un empate, el que atrapa más defectos. Se guarda en `models/patchcore_threshold.json`.
- La puntuación se reescala para que el umbral quede en 0,5: `score ≥ 0,5` significa rechazo, como indica el contrato.
- La evaluación y el simulador solo usan imágenes reservadas: las buenas de `test` y ese 40 % de defectos.

Por qué importa: si el umbral se elige con las mismas imágenes con que se evalúa, el resultado sale optimista. Así pasó en la primera versión, y está documentado en `agents/`.

```bash
python -m vision.train_patchcore     # descarga, entrena y exporta a models/ (~5 min con GPU)
python -m vision.train_defect_type   # clasificador de tipo
python -m vision.evaluate            # KPIs de la cadena completa a 256x256
```

**Resultados** (70 imágenes reservadas, a 256×256, RTX 4050; `reports/vision_pipeline.json`):

| KPI | Resultado |
|---|---|
| Piezas buenas rechazadas por error | 0 de 32 |
| Defectos detectados | 38 de 38 |
| Tipo de defecto correcto (entre los detectados) | 78,9 % |
| Latencia por pieza (p95) | 49,8 ms (meta < 200 ms) |
| Capacidad del detector (throughput) | ~1350 piezas/min (el ritmo real de la línea lo fija `INTERVALO_S`) |
| AUROC por imagen / por píxel (Anomalib) | 1,000 / 0,992 |

Con tan pocas imágenes, estos números tienen mucha incertidumbre: sirven para comparar versiones, no como garantía.

Los pesos (`models/`) y el dataset (`data/`) no se versionan, porque se regeneran con los scripts. Las métricas sí: `reports/vision_patchcore.json`, `reports/vision_defect_type.json` y `reports/vision_pipeline.json`.

**Seguridad:** el modelo exportado es un archivo *pickle*, que puede ejecutar código al cargarse. `vision/models.py` solo carga archivos que estén dentro de `models/`, generados localmente.

## 8. Cómo extenderlo

- **Otro detector:** crear una clase con `predict(image_rgb) -> {"label": str, "score": float}` donde `label == "ok"` signifique pieza buena y `score` sea la puntuación de defecto en [0, 1], registrarla en `DETECTORS` de `vision/detector.py` o pasarla a `InspectionController(detector=...)`.
- **Otras imágenes:** cambiar la lista de muestras en `simulator/main.py` (por ejemplo, imágenes de Blender o propias).
- **Nuevo mensaje o campo:** actualizar primero `contracts/*.schema.json`; las pruebas validan el cumplimiento.
- **IA generativa:** guardar en `agents/` un archivo `AAAA-MM-DD_tema.md` por interacción (prompt, modelo, salida, resultado de la auditoría).

## 9. Limitaciones actuales

- **Dataset de cuero plano, no de calzado armado:** las imágenes de MVTec son superficies de cuero, no zapatos (brecha entre simulación y realidad).
- **Muestra pequeña:** las métricas salen de pocas imágenes (32 buenas y 38 defectuosas reservadas), así que tienen mucha incertidumbre.
- **Clasificador de tipo débil en algunos casos:** confunde perforación con corte (3 de 7) y deformación con perforación (2 de 7) (ver `reports/vision_defect_type.json`).
- **Margen estrecho del umbral:** la pieza buena con puntuación más alta (0,573) queda a solo 0,045 del umbral (0,6185); con más datos podrían aparecer falsos rechazos.
- **Costura sin detectar:** no hay datos de ese defecto.
- **Una sola estación:** solo hay una estación de inspección; el resto de la línea no se modela.

## 10. Próximos pasos

Ver el cronograma en [plan_desarrollo.md](plan_desarrollo.md): dataset de defectos, entrenamiento del modelo de visión, integración con el gemelo, escenarios de simulación y auditoría de lo generado por IA.
