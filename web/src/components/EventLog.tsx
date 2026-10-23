import { useState } from "react"

import type { EventItem, Result } from "../sim/types"
import { Panel } from "./Panel"

const filters = ["todos", "OK", "RECHAZO", "no detectado"] as const

export function EventLog({ events }: { events: EventItem[] }) {
  const [filter, setFilter] = useState<"todos" | Result>("todos")
  const shown =
    filter === "todos"
      ? events
      : events.filter((event) => event.result === filter)
  return (
    <Panel title="Registro" eyebrow="EVENTOS RECIENTES">
      <div className="filter-row" aria-label="Filtrar registro">
        {filters.map((item) => (
          <button
            key={item}
            className={filter === item ? "selected" : ""}
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="event-list">
        {shown.length === 0 && (
          <div className="empty-log">Esperando decisiones de inspección…</div>
        )}
        {shown.map((event) => (
          <div
            className={`event event-${event.result.replace(" ", "-")}`}
            key={`${event.id}-${event.timestamp}`}
          >
            <span className="event-mark">
              {event.result === "OK"
                ? "✓"
                : event.result === "RECHAZO"
                  ? "×"
                  : "!"}
            </span>
            <div>
              <strong>
                Pieza #{event.id} · {event.result}
              </strong>
              <span>
                {event.label} · {event.score.toFixed(2)} ·{" "}
                {Math.round(event.latency)} ms
              </span>
            </div>
            <time>
              {new Date(event.timestamp * 1000).toLocaleTimeString("es-ES", {
                hour12: false,
              })}
            </time>
          </div>
        ))}
      </div>
    </Panel>
  )
}
