import mqtt from "mqtt";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { ingestReading } from "./reading.service.js";

let client: mqtt.MqttClient | null = null;

/**
 * Suscriptor MQTT del backend. Cumple el rol de la "IoT Rule" de AWS:
 * recibe la telemetría publicada por el gateway en el topic
 * `${prefix}/{deviceId}/telemetry`, la persiste, evalúa umbrales,
 * genera alertas y emite por WebSocket (todo dentro de ingestReading).
 *
 * En local el broker es Mosquitto (equivalente a AWS IoT Core).
 */
export function initMqttSubscriber(): void {
  if (!env.mqttEnabled) {
    logger.info("Suscriptor MQTT deshabilitado (MQTT_ENABLED=false)");
    return;
  }

  const topic = `${env.mqttTopicPrefix}/+/telemetry`;
  client = mqtt.connect(env.mqttBrokerUrl, { reconnectPeriod: 3000 });

  client.on("connect", () => {
    logger.info("MQTT conectado", { broker: env.mqttBrokerUrl });
    client?.subscribe(topic, (err) => {
      if (err) {
        logger.error("Error suscribiendo a topic MQTT", { topic, message: err.message });
      } else {
        logger.info("Suscrito a topic MQTT", { topic });
      }
    });
  });

  client.on("message", (msgTopic, payload) => {
    void handleMessage(msgTopic, payload);
  });

  client.on("reconnect", () => {
    logger.warn("Reconectando a MQTT...");
  });

  client.on("error", (err) => {
    logger.error("Error en conexión MQTT", { message: err.message });
  });
}

async function handleMessage(topic: string, payload: Buffer): Promise<void> {
  try {
    const data = JSON.parse(payload.toString()) as {
      deviceId?: string;
      value?: number;
      unit?: string;
      quality?: "good" | "uncertain" | "bad";
      timestamp?: string;
    };

    if (!data.deviceId || typeof data.value !== "number") {
      logger.warn("Mensaje MQTT inválido descartado", { topic });
      return;
    }

    await ingestReading({
      deviceId: data.deviceId,
      value: data.value,
      unit: data.unit ?? "",
      quality: data.quality ?? "good",
      timestamp: data.timestamp ?? new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error procesando mensaje MQTT", {
      topic,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
