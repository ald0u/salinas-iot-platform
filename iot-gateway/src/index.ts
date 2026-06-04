import axios from "axios";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";

dotenv.config();

type DeviceType = "temperature" | "humidity" | "power" | "ups" | "cooling";
type ReadingQuality = "good" | "uncertain" | "bad";

type SimulatedDevice = {
  deviceId: string;
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

const typeConfigs: Record<DeviceType, Omit<SimulatedDevice, "deviceId" | "status" | "nextPublishAt">> = {
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
  if (anomaly) {
    value = device.criticalMax + 5 + Math.random() * 10;
  }

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
      logState(`MQTT publish pending for ${topicPrefix}/${device.deviceId}/telemetry`, reading);
    }
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
    activeDevices,
    publishIntervalMs,
    anomalyProbability,
  });

  await tick(devices);
  setInterval(() => {
    void tick(devices);
  }, publishIntervalMs);
}

void main().catch((error) => {
  logState("Fatal error", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
