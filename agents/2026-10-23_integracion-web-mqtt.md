# 2026-10-23 · Integración de la interfaz web y conexión MQTT

## Datos de la interacción

| Campo | Valor |
|---|---|
| Objetivo | Integrar al repo la interfaz de Figma Make y conectarla al flujo MQTT real |
| Herramienta | Claude Code (agente de programación en terminal) |
| Modelo | Claude Opus 5.5 (`claude-opus-5-5`) |
| Supervisión humana | El equipo eligió cada paso (integrar en `web/`, borrar `simulador2d/`, aplicar MQTT) |
| Rama | `feat/web-mqtt` |

## Pedidos del equipo (literales)

1. "Listo, ya descargué el zip, está en Descargas" → opción elegida: "Nueva carpeta web/ (Recommended)".
2. "si por favor aplique MQTT"

## Salida

- `web/`: interfaz React con dos modos.
  - **Simulación local:** la línea se simula en el navegador.
  - **MQTT en vivo:** se suscribe a `planta/camara/captura` y `planta/control/decision`.
  - Lógica en `web/src/sim/`, conexión y validación de mensajes en `web/src/live/`, interfaz en `web/src/components/`.
- `mosquitto/mosquitto.conf` y `docker-compose.yml`: listener WebSocket en el puerto 9001 para el navegador.
- Documentación: `docs/guia_del_sistema.md`, `contracts/topics.md` y `README.md`.
- Borrado de `simulador2d/`, reemplazado por `web/`.

## Auditoría

### 1. Pruebas escritas antes del código

Cada regla nueva tuvo su prueba, que se vio fallar antes de implementarla (RED → GREEN):

- **`web/src/sim/simulation.test.ts` (16 pruebas):**
  - conteo de OK, RECHAZO y no detectados;
  - escenario de pérdida de mensajes;
  - mensaje de decisión validado contra `contracts/decision.schema.json`;
  - modo MQTT: captura, decisión, timeout, ids reutilizados y decisión tardía.
- **`web/src/live/messages.test.ts` (14 pruebas):** cada mensaje que cumple los esquemas se acepta, y cada violación (JSON inválido, enum, rangos, campos faltantes o sobrantes) se rechaza.

### 2. Prueba de punta a punta con componentes reales

- **Montaje:** Mosquitto en Docker, `controller.main` y `simulator.main` en Python, y la web en un navegador sin cabeza controlado con Playwright.
- **Parámetros:** `N_PIEZAS=12`, `INTERVALO_S=0.6`, `P_DEFECTO=0.4`, más 1 mensaje fuera de contrato publicado a propósito.

| Medida | Log del controlador | Interfaz web |
|---|---|---|
| Piezas | 12 | 12 inspeccionadas, 12 en el registro |
| OK | 7 | 7 (KPI y caja) |
| RECHAZO | 5 | 5 (KPI y caja) |
| Mensajes inválidos | — | 1 descartado y contado |
| Errores de JavaScript | — | 0 |

Las 4 pruebas de Python (`tests/`) siguieron pasando.

### 3. Verificación independiente

Un segundo agente, sin acceso para editar, revisó el cambio y repitió las pruebas.

**Bloqueante encontrado (lo había introducido el propio agente):**
- **Problema:** si una decisión llegaba después del timeout de 5 s, la pieza se contaba dos veces, como "sin decisión" y como inspeccionada.
- **Reproducción:** captura 0 → 6 s sin decisión → decisión 0 da `{ lostMessages: 1, inspected: 1 }`.
- **Corrección:** se recuerdan los ids vencidos. Una decisión tardía se registra y se descuenta de "sin decisión", y una captura nueva con el mismo id anula el recuerdo.
- **Pruebas de regresión:** "moves a late decision from lost to inspected instead of counting it twice" y "does not credit a late decision to a piece whose id was reused".

**Observaciones abiertas (no bloqueantes):**
- Una decisión que llega antes que su captura deja una pieza esperando que termina contada como "sin decisión". Es improbable, porque el controlador solo decide después de recibir la captura.
- Una decisión duplicada que llega cuando la pieza ya salió de la banda se contaría dos veces. Con QoS 0 no ocurre, pero habría que revisarlo si se sube el QoS.
- Al alternar el modo MQTT muy rápido, el indicador puede mostrar "desconectado" por un instante. Se corrige solo y no deja conexiones abiertas.

### 4. Hallazgo de diseño para decidir

El contrato define `score` en el rango 0–1 pero no dice qué significa:
- en `vision/detector.py` es una **puntuación de defecto** (0 = sin defecto);
- en la simulación de la web se usaba como **confianza en la decisión**.

En vivo, la interfaz muestra "Confianza 0.00" en las piezas OK. Hay que fijar el significado en `contracts/decision.schema.json` cuando entre el modelo real.

### 5. Errores del agente durante la sesión

- **Afirmación sin verificar en este registro:** el agente afirmó que la interfaz de Figma Make no respetaba `prefers-reduced-motion`. Al revisar `index.css` encontró la regla y corrigió el registro (`2026-10-22_figma-make-interfaz-web.md`) antes del commit.
- **Comandos que se interrumpieron a sí mismos:** dos veces usó `pkill -f` con un patrón que también coincidía con su propia línea de comandos, y el comando se cortó. Sin daño; se repitieron por separado.

## Conclusión

El cambio quedó verificado con pruebas unitarias, una ejecución real de punta a punta y una revisión independiente. Esa revisión encontró un error que las pruebas iniciales no cubrían, lo que confirma el valor de que la verificación no la haga el mismo agente que escribió el código.
