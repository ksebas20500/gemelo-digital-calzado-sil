# Contratos de mensajes MQTT

| Tópico | Publica | Suscribe | Esquema |
|---|---|---|---|
| `planta/camara/captura` | simulator | controller, web | `captura.schema.json` |
| `planta/control/decision` | controller | web | `decision.schema.json` |

Todos los mensajes son JSON UTF-8. La imagen viaja como PNG codificado en base64.

Broker (Mosquitto): puerto `1883` por TCP para los componentes Python y puerto `9001` por WebSockets para la interfaz web (`web/`). La interfaz valida cada mensaje contra estos contratos y descarta, contándolos, los que no cumplen.
