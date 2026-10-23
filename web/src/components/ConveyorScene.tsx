import { useState } from "react"

import { activeShoeId } from "../sim/simulation"
import type { SimState } from "../sim/types"
import { Icon } from "./Icon"
import { Shoe } from "./Shoe"

function InspectionStation({ active }: { active: boolean }) {
  return (
    <div className={`inspection-station ${active ? "is-active" : ""}`}>
      <div className="camera-head">
        <Icon name="camera" className="size-4" />
        <span>Cámara</span>
      </div>
      <div className="scan-zone">
        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner bl" />
        <span className="corner br" />
        {active && <span className="scan-beam" />}
      </div>
    </div>
  )
}

function RejectActuator({ active }: { active: boolean }) {
  return (
    <div className={`actuator ${active ? "is-active" : ""}`}>
      <span>Actuador</span>
      <div className="actuator-body">
        <div className="actuator-arm" />
      </div>
    </div>
  )
}

export function ConveyorScene({ state }: { state: SimState }) {
  const [expanded, setExpanded] = useState(false)
  const activeId = activeShoeId(state)
  const processing = state.shoes.some(
    (shoe) => shoe.result === null && shoe.x >= 42,
  )
  const rejecting = state.shoes.some(
    (shoe) => shoe.result === "RECHAZO" && shoe.x > 70 && shoe.x < 83,
  )
  return (
    <div
      className={`simulator-container ${expanded ? "simulator-expanded" : ""}`}
    >
      <div className="viewport-toolbar">
        <span>
          {activeId !== undefined
            ? `Inspeccionando pieza #${activeId}`
            : "Esperando siguiente pieza"}
        </span>
        <button
          className="btn btn-secondary"
          aria-pressed={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Cerrar vista ampliada" : "Ampliar simulador"}
        </button>
      </div>
      <div
        className="scene-scroll"
        tabIndex={0}
        aria-label="Planta de simulación, desplazamiento horizontal disponible"
      >
        <div
          className={`scene-wrap ${state.paused ? "simulation-paused" : ""}`}
        >
          <div className="simulator-hud">
            <span className="simulator-mode">
              <i />
              {state.mode === "mqtt" ? "MQTT EN VIVO" : "SIMULACIÓN SIL"}
            </span>
            <span>{state.paused ? "PAUSADA" : "EN EJECUCIÓN"}</span>
            <span>VISTA SUPERIOR · 2D</span>
          </div>
          <div className="axis axis-x">X+</div>
          <div className="axis axis-y">Y+</div>
          <div className="scene-label entry">Entrada</div>
          <div className="scene-label exit">Salida</div>
          <div className="roller roller-entry" />
          <div className="roller roller-exit" />
          <div className="reject-chute" />
          <div className="camera-support" />
          <div className="safety-line safety-top" />
          <div className="safety-line safety-bottom" />
          <div className={`belt ${state.paused ? "paused" : ""}`}>
            <div className="belt-lines" />
            <div className="belt-centerline" />
          </div>
          <div className="photo-sensor sensor-entry">
            <i />
            S1
          </div>
          <div className="photo-sensor sensor-exit">
            <i />
            S3
          </div>
          <InspectionStation active={processing} />
          <RejectActuator active={rejecting} />
          {state.shoes.map((shoe) => (
            <Shoe key={shoe.id} shoe={shoe} />
          ))}
          <div className="bin bin-reject">
            <div className="bin-inner">
              <span>RECHAZO</span>
              <strong>{String(state.binReject).padStart(2, "0")}</strong>
            </div>
          </div>
          <div className="bin bin-ok">
            <div className="bin-inner">
              <span>OK</span>
              <strong>{String(state.binOk).padStart(2, "0")}</strong>
            </div>
          </div>
          <div className="scene-legend">
            <span>
              <i className="dot dot-cyan" /> Visión activa
            </span>
            <span>
              <i className="dot dot-muted" /> Flujo de pieza
            </span>
          </div>
        </div>
      </div>
      <p className="viewport-caption">
        Entrada → Inspección → Clasificación → Salidas{" "}
        <span>Arrastre horizontalmente en pantallas pequeñas</span>
      </p>
    </div>
  )
}
