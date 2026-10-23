import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { decisionMessage, initialState, reducer } from "./simulation"
import type { Defect, Rng, Settings, SimState } from "./types"

const decisionSchema = JSON.parse(
  readFileSync(
    new URL("../../../contracts/decision.schema.json", import.meta.url),
    "utf8",
  ),
)

const baseSettings: Settings = {
  speed: 1,
  defectProbability: 28,
  sensitivity: 88,
  scenario: "normal",
  defectType: "mancha",
}

const fixed =
  (value: number): Rng =>
  () =>
    value

/** Runs the line until the twin or a bin registers the first piece. */
function runFirstPiece(
  settings: Settings,
  rng: Rng,
  inject?: Defect,
): SimState {
  let state = inject
    ? reducer(initialState, { type: "inject", defect: inject })
    : initialState
  for (let i = 0; i < 2000; i++) {
    state = reducer(state, { type: "tick", dt: 100, settings, rng })
    if (state.binOk + state.binReject > 0) return state
  }
  throw new Error("no piece was classified")
}

describe("simulation reducer", () => {
  it("approves a good piece", () => {
    const state = runFirstPiece(baseSettings, fixed(0.99))
    expect(state.inspected).toBe(1)
    expect(state.ok).toBe(1)
    expect(state.rejected).toBe(0)
    expect(state.binOk).toBe(1)
    expect(state.events[0].result).toBe("OK")
  })

  it("rejects a detected defect and never loses messages outside the loss scenario", () => {
    const state = runFirstPiece(baseSettings, fixed(0.1), "mancha")
    expect(state.rejected).toBe(1)
    expect(state.ok).toBe(0)
    expect(state.binReject).toBe(1)
    expect(state.lostMessages).toBe(0)
    expect(state.defects.mancha).toBe(1)
  })

  it("counts a missed defect as an OK decision that lands in the OK bin", () => {
    const state = runFirstPiece(baseSettings, fixed(0.99), "costura")
    expect(state.missed).toBe(1)
    expect(state.ok).toBe(1)
    expect(state.rejected).toBe(0)
    expect(state.binOk).toBe(1)
    expect(state.binReject).toBe(0)
  })

  it("loses the decision message in the loss scenario while the piece is still sorted", () => {
    const settings: Settings = { ...baseSettings, scenario: "loss" }
    const state = runFirstPiece(settings, fixed(0.1), "pegado")
    expect(state.binReject).toBe(1)
    expect(state.lostMessages).toBe(1)
    expect(state.inspected).toBe(0)
    expect(state.rejected).toBe(0)
    expect(state.events).toHaveLength(0)
    expect(state.lastCapture).toBeNull()
  })
})

describe("decisionMessage", () => {
  it("follows contracts/decision.schema.json for a missed defect", () => {
    const state = runFirstPiece(baseSettings, fixed(0.99), "mancha")
    const msg = decisionMessage(state.events[0])

    expect(Object.keys(msg).sort()).toEqual(
      Object.keys(decisionSchema.properties).sort(),
    )
    expect(decisionSchema.properties.decision.enum).toContain(msg.decision)
    expect(msg).toMatchObject({
      pieza_id: 1,
      decision: "OK",
      label: "ok",
    })
    expect(msg.score).toBeGreaterThanOrEqual(0)
    expect(msg.score).toBeLessThanOrEqual(1)
  })

  it("reports the predicted defect for a rejected piece", () => {
    const state = runFirstPiece(baseSettings, fixed(0.1), "costura")
    expect(decisionMessage(state.events[0])).toMatchObject({
      decision: "RECHAZO",
      label: "costura",
    })
  })
})

describe("MQTT mode", () => {
  const live = reducer(initialState, { type: "setMode", mode: "mqtt" })
  const capture = (pieza_id: number) =>
    ({
      type: "capture",
      msg: { pieza_id, timestamp: 100, imagen_png_b64: "iVBORw0KGgo=" },
    }) as const
  const decision = (
    pieza_id: number,
    verdict: "OK" | "RECHAZO",
    label: string,
  ) =>
    ({
      type: "decision",
      msg: {
        pieza_id,
        timestamp: 101,
        decision: verdict,
        label,
        score: 0.9,
        latencia_ms: 12.5,
      },
    }) as const
  const tick = (state: SimState, times: number) => {
    for (let i = 0; i < times; i++)
      state = reducer(state, {
        type: "tick",
        dt: 100,
        settings: baseSettings,
        rng: fixed(0.1),
      })
    return state
  }

  it("places a captured piece at the camera and records its decision once", () => {
    let state = reducer(live, capture(7))
    expect(state.shoes).toMatchObject([{ id: 7, x: 44, result: null }])
    expect(state.lastImage).toEqual({ id: 7, png: "iVBORw0KGgo=" })

    state = reducer(state, decision(7, "RECHAZO", "mancha"))
    state = tick(state, 30)
    expect(state.inspected).toBe(1)
    expect(state.rejected).toBe(1)
    expect(state.binReject).toBe(1)
    expect(state.defects.mancha).toBe(1)
    expect(state.latencies).toEqual([12.5])
    expect(state.events[0]).toMatchObject({
      id: 7,
      result: "RECHAZO",
      label: "mancha",
      timestamp: 101,
    })
  })

  it("records a decision whose capture was never seen", () => {
    const state = reducer(live, decision(3, "OK", "ok"))
    expect(state.ok).toBe(1)
    expect(state.binOk).toBe(1)
    expect(state.events[0]).toMatchObject({ id: 3, label: "sin defecto" })
  })

  it("counts by type every label the real model publishes", () => {
    expect(live.defects).toEqual({})
    let state = reducer(live, decision(4, "RECHAZO", "deformacion"))
    state = reducer(state, decision(5, "RECHAZO", "deformacion"))
    state = reducer(state, decision(6, "OK", "ok"))
    expect(state.events[0].label).toBe("sin defecto")
    expect(state.events[1].label).toBe("deformacion")
    expect(state.defects).toEqual({ deformacion: 2 })
  })

  it("keeps the three simulated defect types in local mode", () => {
    expect(initialState.defects).toEqual({ mancha: 0, costura: 0, pegado: 0 })
  })

  it("drops a capture left without a decision and counts it as lost", () => {
    const state = tick(reducer(live, capture(9)), 60)
    expect(state.shoes).toHaveLength(0)
    expect(state.lostMessages).toBe(1)
    expect(state.inspected).toBe(0)
  })

  it("moves a late decision from lost to inspected instead of counting it twice", () => {
    let state = tick(reducer(live, capture(0)), 60)
    state = reducer(state, decision(0, "OK", "ok"))
    expect(state.lostMessages).toBe(0)
    expect(state.inspected).toBe(1)
    expect(state.binOk).toBe(1)
  })

  it("does not credit a late decision to a piece whose id was reused", () => {
    let state = tick(reducer(live, capture(0)), 60) // old piece 0 timed out
    state = reducer(state, capture(0)) // restarted simulator reuses id 0
    state = reducer(state, decision(0, "OK", "ok"))
    expect(state.lostMessages).toBe(1)
    expect(state.inspected).toBe(1)
  })

  it("never spawns or decides pieces locally", () => {
    const state = tick(live, 100)
    expect(state.shoes).toHaveLength(0)
    expect(state.inspected).toBe(0)
  })

  it("counts invalid messages", () => {
    const state = reducer(live, { type: "invalidMessage" })
    expect(state.invalidMessages).toBe(1)
  })

  it("is ignored in local mode", () => {
    const state = reducer(initialState, decision(1, "OK", "ok"))
    expect(state.inspected).toBe(0)
    expect(reducer(initialState, capture(1)).shoes).toHaveLength(0)
  })

  it("starts from a clean twin when the mode changes", () => {
    const busy = reducer(live, decision(1, "OK", "ok"))
    const back = reducer(busy, { type: "setMode", mode: "local" })
    expect(back).toEqual(initialState)
  })
})
