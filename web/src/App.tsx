import { useEffect, useReducer, useState } from "react"

import { CapturePanel } from "./components/CapturePanel"
import { ControlPanel } from "./components/ControlPanel"
import { ConveyorScene } from "./components/ConveyorScene"
import { EventLog } from "./components/EventLog"
import { Icon } from "./components/Icon"
import { KpiGrid } from "./components/KpiGrid"
import { Panel } from "./components/Panel"
import { StateStepper } from "./components/StateStepper"
import { MQTT_URL, useMqtt } from "./live/useMqtt"
import {
  activeShoeId,
  initialState,
  phaseFromState,
  reducer,
} from "./sim/simulation"
import type { Settings } from "./sim/types"

const TICK_MS = 100

function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [settings, setSettings] = useState<Settings>({
    speed: 1,
    defectProbability: 28,
    sensitivity: 88,
    scenario: "normal",
    defectType: "mancha",
  })
  const [light, setLight] = useState(false)
  const [clock, setClock] = useState(new Date())

  useEffect(() => {
    const timer = window.setInterval(
      () => dispatch({ type: "tick", dt: TICK_MS, settings }),
      TICK_MS,
    )
    return () => window.clearInterval(timer)
  }, [settings])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const live = state.mode === "mqtt"
  const mqttStatus = useMqtt(live, dispatch)
  const loss = !live && settings.scenario === "loss"
  const commsWarning =
    loss ||
    (live &&
      (mqttStatus !== "conectado" ||
        state.lostMessages > 0 ||
        state.invalidMessages > 0))

  return (
    <div className={light ? "app light" : "app"}>
      <header className="topbar">
        <div className="brand-mark">
          <Icon name="activity" className="size-5" />
        </div>
        <div className="title-block">
          <h1>
            Gemelo Digital <span>· Línea de calzado</span>
          </h1>
          <p>
            Vista superior de la banda con inspección por visión artificial
            (SIL)
          </p>
        </div>
        <div className="topbar-meta">
          <div className="mode-switch" role="group" aria-label="Fuente de datos">
            <button
              aria-pressed={!live}
              onClick={() => dispatch({ type: "setMode", mode: "local" })}
            >
              Simulación local
            </button>
            <button
              aria-pressed={live}
              onClick={() => dispatch({ type: "setMode", mode: "mqtt" })}
            >
              MQTT en vivo
            </button>
          </div>
          {live && (
            <span
              className={`connection ${
                mqttStatus === "conectado"
                  ? "live"
                  : mqttStatus === "conectando"
                    ? "connecting"
                    : ""
              }`}
              role="status"
            >
              <i /> MQTT {mqttStatus}
            </span>
          )}
          <time className="clock">
            {clock.toLocaleTimeString("es-ES", { hour12: false })}
          </time>
          <button
            className="icon-btn"
            aria-label={light ? "Activar tema oscuro" : "Activar tema claro"}
            onClick={() => setLight((v) => !v)}
          >
            <Icon name={light ? "moon" : "sun"} />
          </button>
        </div>
      </header>

      <main>
        <div className="operation-status">
          <span>
            <i className={`dot ${state.paused ? "dot-muted" : "dot-cyan"}`} />{" "}
            {state.paused ? "Simulador pausado" : "Simulador en ejecución"}
          </span>
          <span>
            Controlador: <strong>{phaseFromState(state).phase}</strong>
          </span>
          <span className={commsWarning ? "communication-warning" : ""}>
            Comunicaciones:{" "}
            {live
              ? `MQTT ${mqttStatus} · ${MQTT_URL} · ${state.lostMessages} sin decisión · ${state.invalidMessages} inválidos`
              : loss
                ? `pérdida de mensajes simulada · ${state.lostMessages} perdidos`
                : "bus local · sin conexión MQTT"}
          </span>
        </div>
        <div className="dashboard-grid">
          <div className="primary-column">
            <Panel title="Escena de la banda" eyebrow="PLANTA · LÍNEA 01">
              <ConveyorScene state={state} />
              <StateStepper state={state} />
            </Panel>
            <KpiGrid state={state} />
          </div>
          <aside className="side-column">
            <CapturePanel
              event={state.lastCapture}
              activeId={activeShoeId(state)}
              live={live}
              image={state.lastImage}
            />
            <ControlPanel
              state={state}
              settings={settings}
              setSettings={setSettings}
              dispatch={dispatch}
            />
            <EventLog events={state.events} />
          </aside>
        </div>
      </main>
      <footer>
        <span>GDT-SIL / PROTOTIPO DE INVESTIGACIÓN · INDUSTRIA 4.0</span>
        <p>
          Flujo: espera → captura → inferencia → decisión · Mensajes según{" "}
          <code>contracts/decision.schema.json</code>
        </p>
      </footer>
    </div>
  )
}

export default App
