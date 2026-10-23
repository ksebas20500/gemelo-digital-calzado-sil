import type {
  Action,
  CaptureMessage,
  DecisionMessage,
  Defect,
  EventItem,
  Phase,
  Rng,
  Settings,
  ShoeData,
  SimState,
} from "./types"

export const initialState: SimState = {
  mode: "local",
  shoes: [],
  nextId: 1,
  spawnElapsed: 900,
  paused: false,
  elapsedMs: 0,
  binOk: 0,
  binReject: 0,
  lostMessages: 0,
  timedOutIds: [],
  invalidMessages: 0,
  lastImage: null,
  inspected: 0,
  ok: 0,
  rejected: 0,
  missed: 0,
  lastCapture: null,
  events: [],
  latencies: [],
  defects: { mancha: 0, costura: 0, pegado: 0 },
}

export const defectTypes: Defect[] = ["mancha", "costura", "pegado"]
export const phaseDurations = { Captura: 400, Inferencia: 700, Decisión: 400 }
/** Share of decision messages dropped in the "loss" scenario. */
export const LOSS_PROBABILITY = 0.15
/** MQTT mode: a capture with no decision after this long counts as lost. */
export const DECISION_TIMEOUT_MS = 5000
/** Horizontal position (%) of the camera on the belt. */
const CAMERA_X = 44

export const isDefect = (label: string): label is Defect =>
  (defectTypes as string[]).includes(label)

function chooseDefect(settings: Settings, rng: Rng): Defect | null {
  let probability = settings.defectProbability
  if (settings.scenario === "burst") probability = Math.max(probability, 72)
  if (rng() * 100 > probability) return null
  return defectTypes[Math.floor(rng() * defectTypes.length)]
}

export function makeShoe(id: number, defect: Defect | null): ShoeData {
  return {
    id,
    x: -8,
    y: 50,
    defect,
    result: null,
    score: 0,
    latency: 0,
    processingMs: 0,
    recorded: false,
  }
}

function resultFor(
  shoe: ShoeData,
  settings: Settings,
  rng: Rng,
): Pick<ShoeData, "result" | "score" | "latency"> {
  const degraded = settings.scenario === "camera" ? 0.18 : 0
  const effectiveSensitivity = Math.max(
    0.25,
    settings.sensitivity / 100 - degraded,
  )
  const caught = shoe.defect ? rng() < effectiveSensitivity : false
  const result = shoe.defect ? (caught ? "RECHAZO" : "no detectado") : "OK"
  const score = shoe.defect
    ? caught
      ? 0.78 + rng() * 0.2
      : 0.38 + rng() * 0.25
    : 0.82 + rng() * 0.16
  const latency = (settings.scenario === "camera" ? 61 : 34) + rng() * 24
  return { result, score, latency }
}

function onCapture(state: SimState, msg: CaptureMessage): SimState {
  // A restarted simulator reuses ids: the new capture replaces the old piece.
  const shoes = state.shoes.filter((shoe) => shoe.id !== msg.pieza_id)
  shoes.push({ ...makeShoe(msg.pieza_id, null), x: CAMERA_X })
  return {
    ...state,
    shoes,
    // A new piece with this id supersedes any earlier timed-out one.
    timedOutIds: state.timedOutIds.filter((id) => id !== msg.pieza_id),
    lastImage: { id: msg.pieza_id, png: msg.imagen_png_b64 },
  }
}

function onDecision(state: SimState, msg: DecisionMessage): SimState {
  const existing = state.shoes.find((shoe) => shoe.id === msg.pieza_id)
  if (existing?.result) return state // duplicate decision
  // A late decision did arrive: it is no longer a lost message.
  if (state.timedOutIds.includes(msg.pieza_id)) {
    state = {
      ...state,
      lostMessages: state.lostMessages - 1,
      timedOutIds: state.timedOutIds.filter((id) => id !== msg.pieza_id),
    }
  }
  const rejected = msg.decision === "RECHAZO"
  const defect = rejected && isDefect(msg.label) ? msg.label : null
  const decided: ShoeData = {
    ...(existing ?? { ...makeShoe(msg.pieza_id, null), x: CAMERA_X }),
    defect,
    result: msg.decision,
    score: msg.score,
    latency: msg.latencia_ms,
    recorded: true,
  }
  const event: EventItem = {
    id: msg.pieza_id,
    result: msg.decision,
    label: rejected ? msg.label : "sin defecto",
    score: msg.score,
    latency: msg.latencia_ms,
    timestamp: msg.timestamp,
    elapsedMs: state.elapsedMs,
  }
  return {
    ...state,
    shoes: existing
      ? state.shoes.map((shoe) => (shoe === existing ? decided : shoe))
      : [...state.shoes, decided],
    binOk: state.binOk + (rejected ? 0 : 1),
    binReject: state.binReject + (rejected ? 1 : 0),
    inspected: state.inspected + 1,
    ok: state.ok + (rejected ? 0 : 1),
    rejected: state.rejected + (rejected ? 1 : 0),
    defects: rejected
      ? { ...state.defects, [msg.label]: (state.defects[msg.label] ?? 0) + 1 }
      : state.defects,
    events: [event, ...state.events].slice(0, 80),
    lastCapture: event,
    latencies: [...state.latencies, msg.latencia_ms].slice(-50),
  }
}

export function reducer(state: SimState, action: Action): SimState {
  const live = state.mode === "mqtt"
  if (action.type === "setMode")
    return action.mode === "mqtt"
      ? { ...initialState, mode: "mqtt", defects: {} }
      : { ...initialState }
  if (action.type === "pause") return { ...state, paused: !state.paused }
  if (action.type === "reset") return reducer(state, { type: "setMode", mode: state.mode })
  if (action.type === "invalidMessage")
    return { ...state, invalidMessages: state.invalidMessages + 1 }
  if (action.type === "capture")
    return live ? onCapture(state, action.msg) : state
  if (action.type === "decision")
    return live ? onDecision(state, action.msg) : state
  if (action.type === "inject") {
    if (live) return state
    return {
      ...state,
      shoes: [...state.shoes, makeShoe(state.nextId, action.defect)],
      nextId: state.nextId + 1,
      spawnElapsed: 0,
    }
  }
  if (state.paused) return state

  const { dt, settings } = action
  const rng = action.rng ?? Math.random
  const scaledDt = dt * settings.speed
  let nextId = state.nextId
  let spawnElapsed = state.spawnElapsed + scaledDt
  let shoes = state.shoes.map((shoe) => ({ ...shoe }))
  const spawnEvery = 1500

  if (!live && spawnElapsed >= spawnEvery) {
    spawnElapsed -= spawnEvery
    shoes.push(makeShoe(nextId, chooseDefect(settings, rng)))
    nextId += 1
  }

  let lostMessages = state.lostMessages
  let timedOutIds = state.timedOutIds
  const active = shoes.find((shoe) => shoe.result === null && shoe.x >= 44)
  for (const shoe of [...shoes].sort((a, b) => b.x - a.x)) {
    if (live && shoe.result === null) {
      // Waits at the camera until the controller's decision arrives.
      shoe.processingMs += dt
      if (shoe.processingMs >= DECISION_TIMEOUT_MS) {
        lostMessages += 1
        timedOutIds = [...timedOutIds, shoe.id].slice(-100)
        shoe.x = Infinity // removed by the filter below
      }
      continue
    }
    if (shoe === active) {
      shoe.x = 44
      shoe.processingMs += dt
      if (shoe.processingMs >= 1500)
        Object.assign(shoe, resultFor(shoe, settings, rng))
    } else {
      const ahead = shoes
        .filter(
          (other) => other.id !== shoe.id && other.y === 50 && other.x > shoe.x,
        )
        .sort((a, b) => a.x - b.x)[0]
      const nextX = shoe.x + (scaledDt / 1000) * 10.5
      shoe.x = shoe.result
        ? nextX
        : Math.min(nextX, 44, ahead ? ahead.x - 12 : 44)
    }
    if (shoe.result === "RECHAZO" && shoe.x > 73) {
      shoe.x = 74
      shoe.y = Math.min(92, shoe.y + (scaledDt / 1000) * 32)
    }
  }

  let binOk = state.binOk
  let binReject = state.binReject
  let inspected = state.inspected
  let ok = state.ok
  let rejected = state.rejected
  let missed = state.missed
  let events = state.events
  let lastCapture = state.lastCapture
  let latencies = state.latencies
  let defects = state.defects

  for (const shoe of shoes) {
    if (shoe.result && !shoe.recorded) {
      shoe.recorded = true
      // The plant always sorts the piece; a missed defect is approved.
      if (shoe.result === "RECHAZO") binReject += 1
      else binOk += 1
      if (settings.scenario === "loss" && rng() < LOSS_PROBABILITY) {
        lostMessages += 1
        continue
      }
      inspected += 1
      if (shoe.result === "RECHAZO") rejected += 1
      else ok += 1
      if (shoe.result === "no detectado") missed += 1
      if (shoe.defect)
        defects = { ...defects, [shoe.defect]: defects[shoe.defect] + 1 }
      const event: EventItem = {
        id: shoe.id,
        result: shoe.result,
        label: shoe.defect ?? "sin defecto",
        score: shoe.score,
        latency: shoe.latency,
        timestamp: Date.now() / 1000,
        elapsedMs: state.elapsedMs + dt,
      }
      events = [event, ...events].slice(0, 80)
      lastCapture = event
      latencies = [...latencies, shoe.latency].slice(-50)
    }
  }

  shoes = shoes.filter(
    (shoe) => shoe.x < 105 && !(shoe.result === "RECHAZO" && shoe.y >= 91),
  )
  return {
    ...state,
    elapsedMs: state.elapsedMs + dt,
    shoes,
    nextId,
    spawnElapsed,
    binOk,
    binReject,
    lostMessages,
    timedOutIds,
    inspected,
    ok,
    rejected,
    missed,
    events,
    lastCapture,
    latencies,
    defects,
  }
}

export function phaseFromState(state: SimState): {
  phase: Phase
  elapsed: number
} {
  const active = state.shoes.find(
    (shoe) => shoe.result === null && shoe.x >= 42,
  )
  if (!active) return { phase: "Espera", elapsed: 0 }
  if (active.processingMs < 400)
    return { phase: "Captura", elapsed: active.processingMs }
  if (active.processingMs < 1100)
    return { phase: "Inferencia", elapsed: active.processingMs - 400 }
  return { phase: "Decisión", elapsed: active.processingMs - 1100 }
}

/**
 * Message the SIL controller would publish for this event. A missed defect is
 * what the detector saw as a good piece, so it is reported as "OK" / "ok".
 */
export function decisionMessage(event: EventItem): DecisionMessage {
  const rejected = event.result === "RECHAZO"
  return {
    pieza_id: event.id,
    timestamp: event.timestamp,
    decision: rejected ? "RECHAZO" : "OK",
    label: rejected ? event.label : "ok",
    score: event.score,
    latencia_ms: event.latency,
  }
}

export function activeShoeId(state: SimState): number | undefined {
  return state.shoes.find((shoe) => shoe.result === null && shoe.x >= 44)?.id
}
