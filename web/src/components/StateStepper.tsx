import { phaseDurations, phaseFromState } from "../sim/simulation"
import type { Phase, SimState } from "../sim/types"
import { Icon } from "./Icon"

const phases: { name: Phase; duration: number }[] = [
  { name: "Espera", duration: 0 },
  { name: "Captura", duration: phaseDurations.Captura },
  { name: "Inferencia", duration: phaseDurations.Inferencia },
  { name: "Decisión", duration: phaseDurations.Decisión },
]

export function StateStepper({ state }: { state: SimState }) {
  const current = phaseFromState(state)
  return (
    <div className="stepper" aria-label={`Estado actual: ${current.phase}`}>
      {phases.map((item, index) => (
        <div key={item.name} className="contents">
          <div
            className={`step ${current.phase === item.name ? "active" : ""}`}
          >
            <span className="step-index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <strong>{item.name}</strong>
              <small>
                {current.phase === item.name && item.name !== "Espera"
                  ? `${Math.round(current.elapsed)} ms`
                  : item.duration
                    ? `~${item.duration} ms`
                    : "en espera"}
              </small>
            </div>
          </div>
          {index < phases.length - 1 && (
            <Icon name="chevron" className="step-arrow" />
          )}
        </div>
      ))}
    </div>
  )
}
