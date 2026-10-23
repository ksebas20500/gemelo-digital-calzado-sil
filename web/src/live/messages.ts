/**
 * Runtime checks for the MQTT messages in contracts/. Anything that breaks the
 * contract is rejected (null) instead of reaching the twin.
 */
import type { CaptureMessage, DecisionMessage } from "../sim/types"

export const TOPICS = {
  capture: "planta/camara/captura",
  decision: "planta/control/decision",
} as const

const decoder = new TextDecoder()

type Fields = Record<string, unknown>

function parseObject(payload: Uint8Array, keys: string[]): Fields | null {
  let value: unknown
  try {
    value = JSON.parse(decoder.decode(payload))
  } catch {
    return null
  }
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null
  const fields = value as Fields
  const present = Object.keys(fields)
  // Contracts use additionalProperties: false and every field is required.
  if (present.length !== keys.length || !keys.every((k) => k in fields))
    return null
  return fields
}

const isNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v)
const isPieceId = (v: unknown): v is number =>
  isNumber(v) && Number.isInteger(v) && v >= 0

export function parseCapture(payload: Uint8Array): CaptureMessage | null {
  const f = parseObject(payload, ["pieza_id", "timestamp", "imagen_png_b64"])
  if (
    !f ||
    !isPieceId(f.pieza_id) ||
    !isNumber(f.timestamp) ||
    typeof f.imagen_png_b64 !== "string" ||
    f.imagen_png_b64.length === 0
  )
    return null
  return f as CaptureMessage
}

export function parseDecision(payload: Uint8Array): DecisionMessage | null {
  const f = parseObject(payload, [
    "pieza_id",
    "timestamp",
    "decision",
    "label",
    "score",
    "latencia_ms",
  ])
  if (
    !f ||
    !isPieceId(f.pieza_id) ||
    !isNumber(f.timestamp) ||
    (f.decision !== "OK" && f.decision !== "RECHAZO") ||
    typeof f.label !== "string" ||
    !isNumber(f.score) ||
    f.score < 0 ||
    f.score > 1 ||
    !isNumber(f.latencia_ms) ||
    f.latencia_ms < 0
  )
    return null
  return f as DecisionMessage
}
