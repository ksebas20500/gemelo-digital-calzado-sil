import type { MqttClient } from "mqtt"
import { useEffect, useState } from "react"

import type { Action } from "../sim/types"
import { TOPICS, parseCapture, parseDecision } from "./messages"

export type MqttStatus = "desconectado" | "conectando" | "conectado"

export const MQTT_URL = import.meta.env.VITE_MQTT_URL ?? "ws://localhost:9001"

/**
 * While enabled, subscribes to the plant topics and forwards every valid
 * message to the reducer. Invalid messages are counted, never applied.
 */
export function useMqtt(
  enabled: boolean,
  dispatch: React.Dispatch<Action>,
): MqttStatus {
  const [status, setStatus] = useState<MqttStatus>("desconectado")

  useEffect(() => {
    if (!enabled) {
      setStatus("desconectado")
      return
    }
    setStatus("conectando")
    let client: MqttClient | null = null
    let cancelled = false
    // Loaded on demand so local mode does not ship the MQTT client.
    import("mqtt").then(({ default: mqtt }) => {
      if (cancelled) return
      client = mqtt.connect(MQTT_URL, {
        reconnectPeriod: 2000,
        connectTimeout: 5000,
      })
      listen(client)
    })

    function listen(client: MqttClient) {
      client.on("connect", () => {
        setStatus("conectado")
        client.subscribe([TOPICS.capture, TOPICS.decision])
      })
      client.on("reconnect", () => setStatus("conectando"))
      client.on("close", () => setStatus("desconectado"))
      client.on("error", () => setStatus("desconectado"))
      client.on("message", (topic, payload) => {
        if (topic === TOPICS.capture) {
          const msg = parseCapture(payload)
          dispatch(msg ? { type: "capture", msg } : { type: "invalidMessage" })
        } else if (topic === TOPICS.decision) {
          const msg = parseDecision(payload)
          dispatch(msg ? { type: "decision", msg } : { type: "invalidMessage" })
        }
      })
    }

    return () => {
      cancelled = true
      client?.end(true)
    }
  }, [enabled, dispatch])

  return status
}
