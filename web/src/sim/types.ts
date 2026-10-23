export type Defect = "mancha" | "costura" | "pegado"
export type Result = "OK" | "RECHAZO" | "no detectado"
export type Phase = "Espera" | "Captura" | "Inferencia" | "Decisión"
export type Scenario = "normal" | "burst" | "camera" | "loss"

export type ShoeData = {
  id: number
  x: number
  y: number
  defect: Defect | null
  result: Result | null
  score: number
  latency: number
  processingMs: number
  recorded: boolean
}

export type EventItem = {
  id: number
  result: Result
  /** Defect name, "sin defecto", or any label a real model publishes. */
  label: string
  score: number
  latency: number
  timestamp: number
  elapsedMs: number
}

export type Settings = {
  speed: number
  defectProbability: number
  sensitivity: number
  scenario: Scenario
  defectType: Defect
}

/** Where the line data comes from: the in-browser simulation or the MQTT broker. */
export type Mode = "local" | "mqtt"

/** Camera capture published by simulator/ (contracts/captura.schema.json). */
export type CaptureMessage = {
  pieza_id: number
  timestamp: number
  imagen_png_b64: string
}

/** Decision message published by the SIL controller (contracts/decision.schema.json). */
export type DecisionMessage = {
  pieza_id: number
  timestamp: number
  decision: "OK" | "RECHAZO"
  label: string
  score: number
  latencia_ms: number
}

export type SimState = {
  mode: Mode
  shoes: ShoeData[]
  nextId: number
  spawnElapsed: number
  paused: boolean
  elapsedMs: number
  /** Physical plant: pieces that actually reached each bin. */
  binOk: number
  binReject: number
  /**
   * Decisions that never reached the twin: dropped in the local "loss"
   * scenario, or captures left without a decision in MQTT mode.
   */
  lostMessages: number
  /** MQTT mode: ids dropped by the decision timeout, so a late decision is not counted twice. */
  timedOutIds: number[]
  /** MQTT messages rejected because they break the contracts. */
  invalidMessages: number
  /** Latest real camera image received over MQTT. */
  lastImage: { id: number; png: string } | null
  /** Digital twin: counters built only from the decision messages it received. */
  inspected: number
  ok: number
  rejected: number
  missed: number
  lastCapture: EventItem | null
  events: EventItem[]
  latencies: number[]
  /** Rejections per label: the 3 simulated types locally, any model label in MQTT mode. */
  defects: Record<string, number>
}

/** Random source in [0, 1). Injected so tests and audits can reproduce runs. */
export type Rng = () => number

export type Action =
  | { type: "tick"; dt: number; settings: Settings; rng?: Rng }
  | { type: "pause" }
  | { type: "reset" }
  | { type: "inject"; defect: Defect }
  | { type: "setMode"; mode: Mode }
  | { type: "capture"; msg: CaptureMessage }
  | { type: "decision"; msg: DecisionMessage }
  | { type: "invalidMessage" }
