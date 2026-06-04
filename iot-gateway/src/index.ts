import axios from "axios";
import dotenv from "dotenv";
import mqtt from "mqtt";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

dotenv.config();

type DeviceType = "temperature" | "humidity" | "power" | "ups" | "cooling";
type ReadingQuality = "good" | "uncertain" | "bad";

type SimulatedDevice = {
  deviceId: string;
  name: string;
  rack: string;
  position: number;
  floor: number;
  type: DeviceType;
  unit: string;
  baseValue: number;
  min: number;
  max: number;
  criticalMin: number;
  criticalMax: number;
  status: "online" | "offline";
  nextPublishAt: number;
};

type Reading = {
  deviceId: string;
  value: number;
  unit: string;
  quality: ReadingQuality;
  timestamp: string;
};

const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
const publishIntervalMs = Number(process.env.PUBLISH_INTERVAL_MS || 5000);
const activeDevices = Number(process.env.ACTIVE_DEVICES || 20);
const anomalyProbability = Number(process.env.ANOMALY_PROBABILITY || 0.05);
const mqttMode = process.env.MQTT_MODE || "local";
const systemKey = process.env.SYSTEM_INGEST_KEY || "local-dev-ingest-key";
const topicPrefix = process.env.MQTT_TOPIC_PREFIX || "dt/devices";
const iotEndpoint = process.env.IOT_ENDPOINT || "mqtt://localhost:1883";
const certPath = process.env.CERT_PATH || "./certs/";
const adminEmail = process.env.ADMIN_EMAIL || "admin@salinas.local";
const adminPassword = process.env.ADMIN_PASSWORD || "Admin1234!";

let mqttClient: mqtt.MqttClient | null = null;

const typeConfigs: Record<
  DeviceType,
  Omit<SimulatedDevice, "deviceId" | "status" | "nextPublishAt" | "name" | "rack" | "position" | "floor">
> = {
  temperature: {
    type: "temperature",
    unit: "°C",
    baseValue: 26,
    min: 18,
    max: 30,
    criticalMin: 15,
    criticalMax: 35,
  },
  humidity: {
    type: "humidity",
    unit: "%",
    baseValue: 45,
    min: 20,
    max: 70,
    criticalMin: 15,
    criticalMax: 80,
  },
  power: {
    type: "power",
    unit: "kW",
    baseValue: 42,
    min: 0,
    max: 80,
    criticalMin: 0,
    criticalMax: 95,
  },
  ups: {
    type: "ups",
    unit: "%",
    baseValue: 65,
    min: 20,
    max: 90,
    criticalMin: 10,
    criticalMax: 100,
  },
  cooling: {
    type: "cooling",
    unit: "L/min",
    baseValue: 120,
    min: 80,
    max: 160,
    criticalMin: 50,
    criticalMax: 180,
  },
};

function pickType(index: number): DeviceType {
  const types: DeviceType[] = ["temperature", "humidity", "power", "ups", "cooling"];
  return types[index % types.length] as DeviceType;
}

function createDevice(index: number): SimulatedDevice {
  const config = typeConfigs[pickType(index)];

  return {
    deviceId: randomUUID(),
    name: `${config.type}-${String(index + 1).padStart(2, "0")}`,
    rack: `A${(index % 5) + 1}`,
    position: index + 1,
    floor: 1,
    type: config.type,
    unit: config.unit,
    baseValue: config.baseValue,
    min: config.min,
    max: config.max,
    criticalMin: config.criticalMin,
    criticalMax: config.criticalMax,
    status: "online",
    nextPublishAt: Date.now() + randomIntervalMs(),
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Registra los dispositivos simulados en el backend (control plane vía HTTP).
 * Usa el deviceId asignado por el backend para que las lecturas publicadas por
 * MQTT (data plane) coincidan y se evalúen contra sus umbrales.
 */
async function registerDevices(devices: SimulatedDevice[]): Promise<void> {
  let token = "";

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      const res = await axios.post(
        `${backendUrl}/api/v1/auth/login`,
        { email: adminEmail, password: adminPassword },
        { timeout: 10000 },
      );
      token = res.data.tokens.accessToken;
      break;
    } catch {
      logState(`Login al backend falló (intento ${attempt}/10), reintentando...`);
      await delay(3000);
    }
  }

  if (!token) {
    logState("No se pudo autenticar con el backend; se omite el registro de dispositivos");
    return;
  }

  for (const device of devices) {
    try {
      const res = await axios.post(
        `${backendUrl}/api/v1/devices`,
        {
          name: device.name,
          type: device.type,
          location: { rack: device.rack, position: device.position, floor: device.floor },
          status: "online",
          thresholds: {
            min: device.min,
            max: device.max,
            criticalMin: device.criticalMin,
            criticalMax: device.criticalMax,
          },
          metadata: { manufacturer: "ACME", model: `SIM-${device.type}`, firmwareVersion: "1.0.0" },
        },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 },
      );
      device.deviceId = res.data.deviceId;
    } catch (error) {
      logState(`Error registrando ${device.name}`, error instanceof Error ? error.message : String(error));
    }
  }

  logState(`Registrados ${devices.length} dispositivos en el backend`);
}

function randomIntervalMs(): number {
  return 5000 + Math.floor(Math.random() * 5000);
}

function randomDrift(range: number): number {
  return (Math.random() - 0.5) * range * 2;
}

function isAnomaly(): boolean {
  return Math.random() < anomalyProbability;
}

function makeReading(device: SimulatedDevice): Reading {
  const drift = randomDrift(device.max - device.min);
  const rawValue = device.baseValue + drift;
  const anomaly = isAnomaly();

  let value = rawValue;
  
  if (anomaly) value = device.criticalMax + 5 + Math.random() * 10;

  if (device.type === "temperature") {
    value = Number(value.toFixed(1));
  } else {
    value = Math.round(value * 10) / 10;
  }

  const quality: ReadingQuality = anomaly ? "bad" : Math.random() > 0.85 ? "uncertain" : "good";

  return {
    deviceId: device.deviceId,
    value,
    unit: device.unit,
    quality,
    timestamp: new Date().toISOString(),
  };
}

function maybeToggleStatus(device: SimulatedDevice): void {
  if (Math.random() < 0.03) {
    device.status = device.status === "online" ? "offline" : "online";
  }
}

async function publishLocalBatch(readings: Reading[]): Promise<void> {
  if (readings.length === 0) {
    return;
  }

  await axios.post(
    `${backendUrl}/api/v1/readings/batch`,
    { readings },
    {
      headers: {
        "Content-Type": "application/json",
        "x-system-key": systemKey,
      },
      timeout: 10000,
    },
  );
}

function buildMqttOptions(): mqtt.IClientOptions {
  const options: mqtt.IClientOptions = { reconnectPeriod: 3000 };

  if (iotEndpoint.startsWith("mqtts")) {
    try {
      options.key = fs.readFileSync(path.join(certPath, "private.key"));
      options.cert = fs.readFileSync(path.join(certPath, "certificate.pem"));
      options.ca = fs.readFileSync(path.join(certPath, "AmazonRootCA1.pem"));
    } catch (error) {
      logState("No se pudieron cargar los certificados X.509", error instanceof Error ? error.message : String(error));
    }
  }

  return options;
}

function connectMqtt(): void {
  mqttClient = mqtt.connect(iotEndpoint, buildMqttOptions());

  mqttClient.on("connect", () => {
    logState(`Conectado a broker MQTT: ${iotEndpoint}`);
  });

  mqttClient.on("reconnect", () => {
    logState("Reconectando a broker MQTT...");
  });

  mqttClient.on("error", (error) => {
    logState("Error MQTT", error instanceof Error ? error.message : String(error));
  });
}

function publishMqtt(reading: Reading): void {
  if (!mqttClient || !mqttClient.connected) {
    return;
  }

  const topic = `${topicPrefix}/${reading.deviceId}/telemetry`;
  mqttClient.publish(topic, JSON.stringify(reading), { qos: 0 });
}

function logState(message: string, meta?: unknown): void {
  if (meta) {
    console.log(`[gateway] ${message}`, meta);
    return;
  }

  console.log(`[gateway] ${message}`);
}

async function tick(devices: SimulatedDevice[]): Promise<void> {
  const now = Date.now();
  const dueReadings: Reading[] = [];

  for (const device of devices) {
    maybeToggleStatus(device);

    if (device.status === "offline") {
      if (Math.random() < 0.25) {
        device.nextPublishAt = now + randomIntervalMs();
      }
      continue;
    }

    if (now < device.nextPublishAt) {
      continue;
    }

    const reading = makeReading(device);
    dueReadings.push(reading);
    device.nextPublishAt = now + randomIntervalMs();

    if (mqttMode === "aws") {
      publishMqtt(reading);
    }
  }

  if (mqttMode === "aws" && dueReadings.length > 0) {
    logState(`Publicadas ${dueReadings.length} lecturas vía MQTT a ${topicPrefix}/{deviceId}/telemetry`);
  }

  if (mqttMode === "local") {
    try {
      await publishLocalBatch(dueReadings);
      if (dueReadings.length > 0) {
        logState(`Enviadas ${dueReadings.length} lecturas al backend`);
      }
    } catch (error) {
      logState("Error enviando batch al backend", error instanceof Error ? error.message : String(error));
    }
  }
}

async function main(): Promise<void> {
  const devices = Array.from({ length: activeDevices }, (_value, index) => createDevice(index));

  logState("Gateway iniciado", {
    mqttMode,
    backendUrl,
    iotEndpoint: mqttMode === "aws" ? iotEndpoint : undefined,
    activeDevices,
    publishIntervalMs,
    anomalyProbability,
  });

  if (mqttMode === "aws") {
    connectMqtt();
  }

  await registerDevices(devices);
  await tick(devices);
  setInterval(() => {
    void tick(devices);
  }, publishIntervalMs);
}

void main().catch((error) => {
  logState("Fatal error", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
