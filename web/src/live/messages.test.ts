import { describe, expect, it } from "vitest"

import { decisionMessage } from "../sim/simulation"
import { parseCapture, parseDecision } from "./messages"

const decision = {
  pieza_id: 3,
  timestamp: 1761170000.5,
  decision: "RECHAZO",
  label: "mancha",
  score: 0.87,
  latencia_ms: 42.3,
}

const capture = {
  pieza_id: 3,
  timestamp: 1761170000.1,
  imagen_png_b64: "iVBORw0KGgo=",
}

const text = (value: unknown) => new TextEncoder().encode(JSON.stringify(value))

describe("parseDecision", () => {
  it("accepts a message that follows decision.schema.json", () => {
    expect(parseDecision(text(decision))).toEqual(decision)
  })

  it("accepts what the interface itself would publish", () => {
    const msg = decisionMessage({
      id: 0,
      result: "no detectado",
      label: "costura",
      score: 0.5,
      latency: 10,
      timestamp: 1,
      elapsedMs: 0,
    })
    expect(parseDecision(text(msg))).toEqual(msg)
  })

  it.each([
    ["invalid JSON", new TextEncoder().encode("{nope")],
    ["a decision outside the enum", text({ ...decision, decision: "no detectado" })],
    ["a score above 1", text({ ...decision, score: 1.5 })],
    ["a negative latency", text({ ...decision, latencia_ms: -1 })],
    ["a non-integer piece id", text({ ...decision, pieza_id: 1.5 })],
    ["a missing field", text({ ...decision, label: undefined })],
    ["an extra field", text({ ...decision, extra: true })],
    ["a non-object payload", text([decision])],
  ])("rejects %s", (_, payload) => {
    expect(parseDecision(payload)).toBeNull()
  })
})

describe("parseCapture", () => {
  it("accepts a message that follows captura.schema.json", () => {
    expect(parseCapture(text(capture))).toEqual(capture)
  })

  it.each([
    ["an empty image", text({ ...capture, imagen_png_b64: "" })],
    ["a negative piece id", text({ ...capture, pieza_id: -1 })],
    ["an extra field", text({ ...capture, defecto: "mancha" })],
  ])("rejects %s", (_, payload) => {
    expect(parseCapture(payload)).toBeNull()
  })
})
