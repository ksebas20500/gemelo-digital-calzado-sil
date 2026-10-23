# 2026-10-22 · Interfaz web del gemelo generada con Figma Make

## Datos de la interacción

| Campo | Valor |
|---|---|
| Objetivo | Rediseñar el simulador 2D como un panel HMI/SCADA del gemelo digital |
| Herramienta | Figma Make (genera un proyecto React + Vite + Tailwind) |
| Modelo | No informado por la herramienta |
| Autor del prompt | Claude Opus 5.5 (Claude Code), a pedido del equipo |
| Salida | `Digital Twin Shoe Inspection App.zip`: un único `src/App.tsx` de 1084 líneas, `src/index.css` y configuración de Figma |
| Destino en el repo | `web/` (tras la auditoría y las correcciones de abajo) |

## Prompt (literal)

```text
Design a single-page web app called "Gemelo Digital · Línea de calzado": a real-time
digital twin of a shoe manufacturing quality-inspection line, using Software-in-the-Loop
(SIL) simulation and computer vision. It is a university research prototype (Industry 4.0)
that will be shown in a demo, an academic poster and a short paper, so it must look like
a credible industrial HMI / SCADA control panel: clean, technical and calm, not a
marketing site.

All UI text must be in Spanish (use the exact labels below). Use React + Tailwind, no
backend: animate everything with mocked data and a local simulation loop.

LAYOUT (desktop first, 1440px, responsive down to 390px mobile):
1. Top bar: title, subtitle "Vista superior de la banda con inspección por visión
   artificial (SIL)", a connection status pill ("MQTT conectado" green / "Simulación
   local" grey), and a live clock.
2. Hero area: "Escena de la banda", a top-down 2D conveyor belt animation (the main
   visual, ~60% width):
   - Shoes (top-view SVG silhouettes with sole, upper and laces) enter from the left
     ("Entrada") and move right on an animated belt.
   - An inspection station in the middle with a "Cámara" and a scanning light beam that
     frames the shoe while it is captured.
   - Further right, an "Actuador" (pneumatic pusher arm) that pushes rejected shoes down
     into a "RECHAZO" bin; approved shoes continue to an "OK" bin at the end. Each bin
     shows its counter.
   - Defective shoes visibly show their defect: "mancha" (dark stain), "costura"
     (broken/irregular stitch line), "pegado" (bubbles / misaligned sole).
   - Each shoe has a small ID tag (#12) and after inspection a badge: OK (green) or
     RECHAZO (red); a missed defect gets an amber "no detectado" badge.
3. Under the scene: the SIL controller state machine as a horizontal stepper:
   Espera → Captura → Inferencia → Decisión → (back to Espera). The active state is
   highlighted and pulses; show the elapsed time of each step in ms.
4. Right column, "Última captura": a 128x128 grayscale camera frame of the current
   shoe with a bounding box over the detected defect, the predicted label, a confidence
   bar (score 0–1) and the decision message as formatted JSON:
   {"pieza_id": 12, "timestamp": 1761170000.5, "decision": "RECHAZO",
    "label": "mancha", "score": 0.87, "latencia_ms": 42.3}
5. Panel "Gemelo digital" with KPI cards: Inspeccionadas, OK, Rechazo, Tasa de defectos
   (%), Defectos no detectados, Latencia media (ms), Throughput (piezas/min). Add a small
   live line chart of latency over the last 50 pieces, and a bar chart of defects by type
   (mancha / costura / pegado).
6. Panel "Control": buttons Pausar/Reanudar (primary), Reiniciar, Inyectar defecto
   (with a dropdown to choose the defect type); sliders "Velocidad" (0.5×–3×),
   "Probabilidad de defecto" (0–100%), "Sensibilidad del detector" (50–100%); a scenario
   selector with "Operación normal", "Ráfaga de defectos", "Cámara degradada (ruido /
   baja luz)" and "Pérdida de mensajes".
7. Panel "Registro": a scrolling event log, newest first: "Pieza #12 · RECHAZO ·
   mancha · 0.87 · 42 ms", color-coded, with a filter by OK / RECHAZO / no detectado.
8. Footer: "Flujo: espera → captura → inferencia → decisión · Mensajes según
   contracts/decision.schema.json".

VISUAL STYLE:
- Dark industrial theme by default (deep slate background, not pure black) with a
  light theme toggle. Semantic colors only for status: green = OK, red = RECHAZO,
  amber = warning / missed defect, cyan/blue = camera and active state.
- Monospace font for numbers, IDs and JSON; a clean sans-serif (Inter) for everything
  else. Tabular numerals in KPIs.
- Cards with subtle borders, 8px grid, generous spacing, no gradients or glassmorphism.
- Smooth but restrained motion: belt movement, camera beam flash, actuator push,
  counters ticking up. Respect prefers-reduced-motion.
- Accessible: WCAG AA contrast, visible focus states, status never shown by color alone
  (always icon + text).

SIMULATION BEHAVIOUR (mocked, client side):
- A new shoe spawns every ~1.5 s (scaled by Velocidad); it is defective with the chosen
  probability, with a random defect type.
- At the camera the controller steps through Captura (~400 ms), Inferencia (~700 ms) and
  Decisión (~400 ms); the detector catches a real defect with probability =
  Sensibilidad, otherwise it is a missed defect.
- KPIs, charts, bins, the capture panel and the log update live from the same state.

Keep components small and well named (ConveyorScene, Shoe, InspectionStation,
RejectActuator, StateStepper, CapturePanel, KpiGrid, ControlPanel, EventLog) so the code
can later be wired to real MQTT messages.
```

## Auditoría de la salida

Método: instalación limpia, `tsc --noEmit`, `vite build`, lectura completa de `App.tsx` y comparación contra el prompt y contra `contracts/decision.schema.json`.

| # | Hallazgo | Tipo | Evidencia | Estado |
|---|---|---|---|---|
| 1 | El código no compila con TypeScript: tipos de objeto sin separadores entre campos (`{ type: "tick" dt: number settings: Settings }`). `vite build` pasaba porque no chequea tipos, lo que ocultaba el error. | Sintaxis inválida generada | 5 errores `TS1005` en `App.tsx` líneas 54, 56, 311, 529 y 543 | Corregido |
| 2 | El escenario "Pérdida de mensajes" aparece en el selector, pero la simulación no lo usa: solo cambia un texto. | Funcionalidad pedida e implementada solo en apariencia | `reducer` sin ninguna rama para `scenario === "loss"` | Corregido: el 15 % de las decisiones no llega al gemelo y las cajas físicas divergen de los KPIs |
| 3 | Un defecto no detectado cae en la caja OK pero no suma en el contador OK: la caja y el KPI no coinciden. | Inconsistencia lógica | `ok` solo sumaba con `result === "OK"` | Corregido: el controlador aprueba los no detectados, así que cuentan como OK |
| 4 | El JSON de decisión podía mostrar `"decision": "no detectado"`, valor que el contrato no admite (solo `OK` o `RECHAZO`). | Violación del contrato pedido en el prompt | `decision.schema.json` → `enum: ["OK", "RECHAZO"]` | Corregido con `decisionMessage()`; una prueba valida contra el esquema real |
| 5 | Se incluyeron archivos de la plataforma ajenos al proyecto: un `.gitattributes` que manda a Git LFS `*.png`, `*.db`, `*.pdf` y más; plugins de Vite propios de Figma; y `CLAUDE.md`/`AGENTS.md` con instrucciones del entorno de Figma. | Efecto colateral no pedido | Contenido del zip | Descartados al integrar |
| 6 | Todo el código en un solo archivo de 1084 líneas, aunque el prompt pedía componentes pequeños con nombres concretos. Los nombres sí se respetaron, como funciones internas. | Cumplimiento parcial | `src/App.tsx` | Corregido: separado en `web/src/sim/` y `web/src/components/` |
| 7 | El zapato aprobado pasa por encima del contador de la caja OK. | Detalle visual | Capturas de pantalla | Pendiente (menor) |

Lo que sí cumplió: diseño, textos en español, layout responsivo (verificado a 1440 px y 390 px), tema claro/oscuro, `prefers-reduced-motion` (`index.css`), los tres tipos de defecto, gráficos y filtros del registro.

## Verificación de las correcciones

- Las pruebas (`web/src/sim/simulation.test.ts`) se escribieron antes de cada corrección y se vieron fallar (RED) antes de pasar (GREEN).
- El azar de la simulación se inyecta como parámetro (`rng`), así cada prueba es reproducible con la misma entrada.
- `pnpm build` ahora ejecuta `tsc --noEmit` antes de `vite build`, para que un error como el hallazgo 1 no vuelva a pasar inadvertido.

## Conclusión

La salida sirvió como base visual, pero no era entregable tal cual: no compilaba con chequeo de tipos, simulaba una funcionalidad que no tenía y contradecía el contrato de mensajes que el propio prompt citaba. Lo que más tiempo ahorró fue el diseño, y los errores se detectaron con chequeo de tipos, lectura del código y pruebas contra el contrato.
