import type { SimState } from "../sim/types"
import { Panel } from "./Panel"

function MiniLineChart({ values }: { values: number[] }) {
  const data = values.length > 1 ? values : [0, ...values, 0]
  const max = 100
  const coords = data.map(
    (v, i) => [(i / (data.length - 1)) * 100, 46 - (v / max) * 38] as const,
  )
  const [lastX, lastY] = coords[coords.length - 1]
  return (
    <svg
      viewBox="0 0 100 50"
      preserveAspectRatio="none"
      className="h-24 w-full"
      aria-label="Latencia de las últimas 50 piezas"
    >
      <path d="M0 12H100M0 29H100M0 46H100" className="chart-grid" />
      <path d="M0 27H100" className="chart-reference" />
      <polyline
        points={coords.map(([x, y]) => `${x},${y}`).join(" ")}
        className="chart-line"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="1.7" className="chart-dot" />
    </svg>
  )
}

function DefectBars({ defects }: { defects: Record<string, number> }) {
  const types = Object.keys(defects)
  const max = Math.max(1, ...Object.values(defects))
  if (types.length === 0)
    return <p className="telemetry-note">Sin rechazos todavía.</p>
  return (
    <div className="bar-chart">
      {types.map((type) => (
        <div className="bar-row" key={type}>
          <span>{type}</span>
          <div>
            <i style={{ width: `${(defects[type] / max) * 100}%` }} />
          </div>
          <strong>{defects[type]}</strong>
        </div>
      ))}
    </div>
  )
}

export function KpiGrid({ state }: { state: SimState }) {
  const recent = state.events.filter(
    (event) => event.elapsedMs > state.elapsedMs - 60000,
  )
  const throughput =
    (recent.length * 60000) / Math.max(1000, Math.min(state.elapsedMs, 60000))
  const average = state.latencies.length
    ? state.latencies.reduce((a, b) => a + b, 0) / state.latencies.length
    : 0
  // In MQTT mode there is no ground truth: only rejections are known defects.
  const live = state.mode === "mqtt"
  const rate = state.inspected
    ? ((state.rejected + state.missed) / state.inspected) * 100
    : 0
  const kpis: [string, number | string][] = [
    ["Inspeccionadas", state.inspected],
    ["OK", state.ok],
    ["Rechazo", state.rejected],
    [live ? "Tasa de rechazo" : "Tasa de defectos", `${rate.toFixed(1)}%`],
    ["Defectos no detectados", live ? "—" : state.missed],
    ["Latencia media", `${average.toFixed(1)} ms`],
    ["Throughput", `${throughput.toFixed(1)} p/min`],
  ]
  return (
    <Panel title="Gemelo digital" eyebrow="TELEMETRÍA EN VIVO">
      <div className="kpi-grid">
        {kpis.map(([label, value], i) => (
          <div className={`kpi-card kpi-${i}`} key={label}>
            <span>{label}</span>
            <strong>
              {typeof value === "number"
                ? String(value).padStart(2, "0")
                : value}
            </strong>
          </div>
        ))}
      </div>
      {live ? (
        <p className="telemetry-note">
          Datos recibidos por MQTT. Sin la verdad de la simulación, los
          defectos no detectados no se pueden medir en vivo. Throughput: ventana
          móvil de 60 s. Capturas sin decisión: {state.lostMessages} · Mensajes
          inválidos (fuera de contrato): {state.invalidMessages}.
        </p>
      ) : (
        <p className="telemetry-note">
          Defectos reales: {state.rejected + state.missed} · Detectados:{" "}
          {state.rejected} · No detectados: {state.missed} (aprobados como OK).
          Throughput: ventana móvil de 60 s de ejecución.
          {state.lostMessages > 0 &&
            ` Mensajes de decisión perdidos: ${state.lostMessages} (el gemelo no los registró; las cajas físicas sí).`}
        </p>
      )}
      <div className="chart-grid-wrap">
        <div className="chart-card">
          <div className="chart-heading">
            <span>Latencia · últimas 50 piezas</span>
            <small>ms</small>
          </div>
          <MiniLineChart values={state.latencies} />
          <div className="chart-scale">
            <span>0 ms</span>
            <span>Referencia: 50 ms</span>
            <span>100 ms</span>
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-heading">
            <span>Defectos por tipo</span>
            <small>total</small>
          </div>
          <DefectBars defects={state.defects} />
        </div>
      </div>
    </Panel>
  )
}
