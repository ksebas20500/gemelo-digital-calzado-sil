import { defectTypes } from "../sim/simulation"
import type { Action, Defect, Scenario, Settings, SimState } from "../sim/types"
import { Icon } from "./Icon"
import { Panel } from "./Panel"

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  suffix,
  disabled,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  disabled: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className="range-control">
      <span>
        <b>{label}</b>
        <output>
          {value}
          {suffix}
        </output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

export function ControlPanel({
  state,
  settings,
  setSettings,
  dispatch,
}: {
  state: SimState
  settings: Settings
  setSettings: React.Dispatch<React.SetStateAction<Settings>>
  dispatch: React.Dispatch<Action>
}) {
  const live = state.mode === "mqtt"
  return (
    <Panel title="Control" eyebrow={live ? "MQTT EN VIVO" : "SIMULACIÓN SIL"}>
      {live && (
        <p className="live-note">
          En modo MQTT la línea la mueve <code>simulator/</code> (variables{" "}
          <code>INTERVALO_S</code>, <code>P_DEFECTO</code>,{" "}
          <code>N_PIEZAS</code>). Aquí solo se observa: pausar congela la
          animación y reiniciar limpia el gemelo.
        </p>
      )}
      <p className="control-group-title">01 · Ejecución</p>
      <div className="control-actions">
        <button
          className="btn btn-primary"
          onClick={() => dispatch({ type: "pause" })}
        >
          <Icon name={state.paused ? "play" : "pause"} />{" "}
          {state.paused ? "Reanudar" : "Pausar"}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => dispatch({ type: "reset" })}
        >
          <Icon name="reset" /> Reiniciar
        </button>
      </div>
      <details className="test-controls">
        <summary>04 · Pruebas e inyección</summary>
        <div className="inject-row">
          <select
            aria-label="Tipo de defecto"
            disabled={live}
            value={settings.defectType}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                defectType: e.target.value as Defect,
              }))
            }
          >
            {defectTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
          <button
            className="btn btn-danger"
            disabled={live}
            onClick={() =>
              dispatch({ type: "inject", defect: settings.defectType })
            }
          >
            <Icon name="warning" /> Inyectar defecto
          </button>
        </div>
      </details>
      <div className="controls-stack">
        <p className="control-group-title">02 · Proceso</p>
        <RangeControl
          label="Velocidad"
          value={settings.speed}
          min={0.5}
          max={3}
          step={0.5}
          suffix="×"
          disabled={live}
          onChange={(value) => setSettings((s) => ({ ...s, speed: value }))}
        />
        <RangeControl
          label="Probabilidad de defecto"
          value={settings.defectProbability}
          min={0}
          max={100}
          step={5}
          suffix="%"
          disabled={live}
          onChange={(value) =>
            setSettings((s) => ({ ...s, defectProbability: value }))
          }
        />
        <p className="control-group-title">03 · Detector</p>
        <RangeControl
          label="Sensibilidad del detector"
          value={settings.sensitivity}
          min={50}
          max={100}
          step={1}
          suffix="%"
          disabled={live}
          onChange={(value) =>
            setSettings((s) => ({ ...s, sensitivity: value }))
          }
        />
      </div>
      <label className="scenario-control">
        <span>Escenario</span>
        <select
          disabled={live}
          value={settings.scenario}
          onChange={(e) =>
            setSettings((s) => ({ ...s, scenario: e.target.value as Scenario }))
          }
        >
          <option value="normal">Operación normal</option>
          <option value="burst">Ráfaga de defectos</option>
          <option value="camera">Cámara degradada (ruido / baja luz)</option>
          <option value="loss">Pérdida de mensajes</option>
        </select>
      </label>
    </Panel>
  )
}
