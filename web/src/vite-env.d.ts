/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** MQTT broker WebSocket URL. Default: ws://localhost:9001 */
  readonly VITE_MQTT_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
