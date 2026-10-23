import { decisionMessage, isDefect, makeShoe } from "../sim/simulation"
import type { EventItem, ShoeData, SimState } from "../sim/types"
import { Panel } from "./Panel"
import { Shoe } from "./Shoe"

/** Real frame published by simulator/ over MQTT. */
function LiveFrame({ image }: { image: SimState["lastImage"] }) {
  return (
    <div className="camera-frame">
      {image ? (
        <img
          className="camera-image"
          src={`data:image/png;base64,${image.png}`}
          alt={`Captura real de la pieza ${image.id}`}
        />
      ) : (
        <div className="camera-noise" />
      )}
      <span className="frame-id">
        CAM_01 · MQTT{image ? ` · #${image.id}` : ""}
      </span>
    </div>
  )
}

function CameraFrame({ event }: { event: EventItem | null }) {
  const pseudoShoe: ShoeData = {
    ...makeShoe(
      event?.id ?? 0,
      event ? (isDefect(event.label) ? event.label : null) : "mancha",
    ),
    result: event?.result ?? null,
    score: event?.score ?? 0,
    latency: event?.latency ?? 0,
  }
  return (
    <div className="camera-frame">
      <div className="camera-noise" />
      <div className="camera-shoe">
        <Shoe shoe={pseudoShoe} camera />
      </div>
      {event && event.result === "RECHAZO" && (
        <div className="bounding-box">
          <span>{event.label}</span>
        </div>
      )}
      <span className="frame-id">CAM_01 · 640×480</span>
    </div>
  )
}

function formatMessage(event: EventItem | null): string {
  if (!event) return '{"estado": "esperando_pieza"}'
  const msg = decisionMessage(event)
  return JSON.stringify(
    {
      ...msg,
      timestamp: Number(msg.timestamp.toFixed(1)),
      score: Number(msg.score.toFixed(2)),
      latencia_ms: Number(msg.latencia_ms.toFixed(1)),
    },
    null,
    1,
  )
}

export function CapturePanel({
  event,
  activeId,
  live,
  image,
}: {
  event: EventItem | null
  activeId?: number
  live: boolean
  image: SimState["lastImage"]
}) {
  const score = event?.score ?? 0
  const decision = event?.result ?? "ESPERA"
  const predicted = event ? decisionMessage(event).label : null
  return (
    <Panel title="Última captura" eyebrow="VISIÓN ARTIFICIAL">
      <p className="capture-context">
        {activeId !== undefined
          ? `En cámara: pieza #${activeId} · procesando`
          : "Cámara en espera"}
        <br />
        {event
          ? `Última decisión: pieza #${event.id}`
          : "Sin decisiones todavía"}
      </p>
      <div className="capture-grid">
        {live ? <LiveFrame image={image} /> : <CameraFrame event={event} />}
        <div className="capture-data">
          <div>
            <span className="data-label">Etiqueta predicha</span>
            <strong className="capitalize">
              {predicted === null
                ? "—"
                : predicted === "ok"
                  ? "sin defecto"
                  : predicted}
            </strong>
          </div>
          <div>
            <div className="mb-1 flex justify-between">
              <span className="data-label">
                {live ? "Puntuación de defecto" : "Confianza"}
              </span>
              <span className="mono text-xs">{score.toFixed(2)}</span>
            </div>
            <div className="confidence-track">
              <span style={{ width: `${score * 100}%` }} />
            </div>
          </div>
          <span className={`decision decision-${decision.replace(" ", "-")}`}>
            {decision}
          </span>
        </div>
      </div>
      <pre className="json-block">{formatMessage(event)}</pre>
    </Panel>
  )
}
