import { useState } from "react"

import { BELT_SPEED, activeShoeId } from "../sim/simulation"
import type { SimState } from "../sim/types"
import { Shoe } from "./Shoe"

function InspectionStation({ active }: { active: boolean }) {
  return (
    <div className={`inspection-station ${active ? "is-active" : ""}`}>
      <div className="camera-head">
        <span>Cámara</span>
      </div>
      <div className="scan-zone">
      </div>
    </div>
  )
}

/** The rod tip follows the piece being pushed, so it never lags behind it. */
function RejectActuator({ state }: { state: SimState }) {
  const target = state.shoes
    .filter((shoe) => shoe.result === "RECHAZO" && shoe.x > 66)
    .sort((a, b) => b.y - a.y)[0]
  const tip = target ? Math.max(36, Math.min(88, target.y - 6)) : 28
  return (
    <>
      <div className={`actuator ${target ? "is-active" : ""}`}>
        <span className="actuator-label">Actuador</span>
        <div className="actuator-body" />
      </div>
      <div className="actuator-rod" style={{ height: `${tip - 28}%` }}>
        <i className="actuator-head" />
      </div>
    </>
  )
}

export function ConveyorScene({
  state,
  speed = 1,
}: {
  state: SimState
  speed?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const activeId = activeShoeId(state)
  const processing = state.shoes.some(
    (shoe) => shoe.result === null && shoe.x >= 42,
  )
  return (
    <div
      className={`simulator-container ${expanded ? "simulator-expanded" : ""}`}
    >
      <div className="viewport-toolbar">
        <span className="viewport-status">
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
          style={
            {
              "--belt-dur": `${(5 * 0.82) / (BELT_SPEED * speed)}s`,
            } as React.CSSProperties
          }
        >
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
          <RejectActuator state={state} />
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
        </div>
      </div>
      <p className="viewport-caption">
        Entrada → Inspección → Clasificación → Salidas{" "}
        <span>Arrastre horizontalmente en pantallas pequeñas</span>
      </p>
    </div>
  )
}
