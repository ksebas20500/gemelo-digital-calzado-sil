# 2026-10-23 · Modelo de visión (PatchCore + tipo de defecto)

## Datos de la interacción

| Campo | Valor |
|---|---|
| Objetivo | Reemplazar el detector heurístico por un modelo entrenado y correr el lazo SIL con imágenes reales |
| Herramienta | Claude Code (agente de programación en terminal) |
| Modelo | Claude Opus 5.5 (`claude-opus-5-5`) |
| Supervisión humana | El equipo eligió el enfoque; el agente propuso y ejecutó el resto |
| Seguimiento | `odd/tasks/vision-model.md` (especificaciones S1–S9, tareas T1–T8, bitácora L1–L8) |
| Rama | `feat/web-mqtt` |

## Pedido del equipo (literal)

- "si" (a "¿Seguimos con el modelo de visión en esta rama?").
- Enfoque elegido entre tres opciones: **"Anomalías + tipo (Recommended)"**: "PatchCore (Anomalib) entrenado solo con piezas buenas decide OK/defecto y da un mapa de calor para ubicar el defecto; un clasificador pequeño pone el tipo (mancha, pegado, corte). Sin etiquetado manual. Costura queda fuera o sintética."

## Salida

- **`vision/`:**
  - `dataset.py`: descarga y división reproducible.
  - `train_patchcore.py`: entrenamiento y calibración del umbral.
  - `calibration.py`: elección del umbral.
  - `defect_type.py`: recorte en el pico de anomalía y clasificador.
  - `train_defect_type.py`: entrenamiento del clasificador.
  - `detector.py`: `ModelDetector` y `HeuristicDetector`, elegidos con `DETECTOR`.
  - `evaluate.py`: KPIs de la cadena completa.
  - `models.py`: carga segura de los modelos.
- **`simulator/main.py`:** publica imágenes reales reservadas y guarda la verdad de cada pieza.
- **`twin/audit.py`:** compara esa verdad con las decisiones del gemelo.
- **`web/`:** el gráfico por tipo muestra las etiquetas del modelo, y en modo MQTT el `score` se rotula "Puntuación de defecto".
- **`contracts/decision.schema.json`:** descripción de `label` y `score` (cambio aditivo).
- **`reports/*.json`:** métricas versionadas. Los pesos y el dataset no se versionan.

## Resultados finales

Medidos sobre 70 imágenes reservadas (32 buenas y 38 defectuosas) que ningún modelo vio, a 256×256:

| KPI | Resultado |
|---|---|
| Piezas buenas rechazadas por error | 0 de 32 |
| Defectos detectados | 38 de 38 |
| Tipo correcto entre los detectados | 78,9 % |
| Latencia p95 | 49,8 ms (meta < 200 ms) |
| Capacidad del detector | ~1350 piezas/min |

Corrida de punta a punta (Mosquitto, controlador, simulador y web en modo MQTT, 30 piezas), con la versión anterior a la calibración final:
- defectos detectados: 13 de 13;
- rechazos falsos: 0;
- tipo correcto: 9 de 13;
- piezas sin decisión: 0.

## Auditoría

### Hallazgos sobre el código y los resultados

| # | Hallazgo | Quién lo detectó | Evidencia | Estado |
|---|---|---|---|---|
| 1 | **Fuga de datos en el umbral.** Por defecto, Anomalib elige el umbral con las mismas imágenes de prueba con que luego evalúa. El primer reporte (0 falsos rechazos) era optimista. | El agente, al revisar la configuración tras ver un resultado "perfecto" | `val_split_mode=same_as_test` en `MVTecAD` | Corregido (T7) |
| 2 | **La primera corrección empeoró las cosas.** El umbral calibrado con defectos sintéticos de Anomalib dio **19 de 32** falsos rechazos, aunque el AUROC seguía en 1,0. | Reentrenamiento y evaluación | `reports/` intermedios, bitácora L7 | Reemplazado por calibración con imágenes reales que no son de prueba |
| 3 | **Descargas oficiales rotas.** Las URL de MVTec AD (la de Anomalib 2.7.0 y las de la página de MVTec) devuelven 404. | Ejecución | HTTP 404 | Se usó un espejo de Hugging Face y se verifican los conteos oficiales: 245 de entrenamiento y 124 de prueba |
| 4 | **Riesgo de seguridad.** El modelo exportado es un *pickle*, y Anomalib exige `TRUST_REMOTE_CODE=1` para cargarlo. Activarlo para todo el proceso permitiría ejecutar código de cualquier archivo. | Ejecución (error de Anomalib) | `ValueError` de `TorchInferencer` | La variable se activa solo durante la carga y solo para archivos dentro de `models/`; tiene prueba |
| 5 | **Margen estrecho.** La pieza buena con puntuación más alta (0,573) queda a 0,045 del umbral (0,6185). | Análisis de distribuciones | `reports/vision_patchcore.json` | Documentado como limitación |
| 6 | **Clasificador de tipo débil.** Confunde perforación con corte (3 de 7) y deformación con perforación (2 de 7). | Matriz de confusión | `reports/vision_defect_type.json` | Documentado; posible mejora futura |
| 7 | **La web solo conocía 3 tipos de defecto.** En vivo, "Defectos por tipo" ignoraba corte, deformación y perforación: 13 rechazos, pero las barras sumaban 6. | Captura de pantalla de la corrida | `live.png` de la corrida | Corregido (T8) |

### Errores del propio agente

- **Afirmación sin verificar:** escribió en la guía que el clasificador "confunde a menudo deformación con perforación" antes de tener los datos finales. La matriz mostró otra cosa, y se corrigió antes del commit.
- **Sin fase RED en una prueba:** las pruebas de `vision/models.py` se escribieron junto con el código, no antes. Está registrado en la bitácora (L4).
- **Repitió un error de procesos:** volvió a terminar procesos con un patrón que coincidía con la línea de su propio comando. Interrumpió una limpieza y dejó un proceso abierto, que luego cerró por PID. Es la tercera vez en el proyecto que pasa.
- **Script auxiliar mal invocado:** el primer intento de su script de diagnóstico falló por no incluir la raíz del repo en el `PYTHONPATH`.

## Conclusión

Lo más valioso de esta auditoría es el hallazgo 1. Un resultado "perfecto" escondía una fuga de datos que la herramienta trae por defecto. La primera corrección, aunque metodológicamente limpia, rendía mucho peor en la práctica (hallazgo 2). Solo calibrando con datos reales separados del test se obtuvo un resultado bueno y honesto a la vez.

Para el informe conviene reportar los dos números (el optimista y el calibrado) como ejemplo de por qué hay que auditar lo que produce una herramienta, sea un agente de IA o una biblioteca.
