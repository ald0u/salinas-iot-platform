import dotenv from "dotenv";

dotenv.config();

function toNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toFloat(value: string | undefined, fallback: number): number {
  const n = Number.parseFloat(value || "");
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: toNumber(process.env.PORT, 3000),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  dynamodbTable: process.env.DYNAMODB_TABLE || "IoTData",
  accessSecret: process.env.JWT_ACCESS_SECRET || "dev-access-secret-change-me",
  refreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-me",
  accessExpiry: process.env.JWT_ACCESS_EXPIRY || "15m",
  refreshExpiry: process.env.JWT_REFRESH_EXPIRY || "7d",
  systemIngestKey: process.env.SYSTEM_INGEST_KEY || "local-dev-ingest-key",
  kpiCacheTtl: toNumber(process.env.KPI_CACHE_TTL_SECONDS, 10),
  activeDevices: toNumber(process.env.ACTIVE_DEVICES, 20),
  anomalyProbability: toFloat(process.env.ANOMALY_PROBABILITY, 0.05),
  mqttEnabled: (process.env.MQTT_ENABLED || "false") === "true",
  mqttBrokerUrl: process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
  mqttTopicPrefix: process.env.MQTT_TOPIC_PREFIX || "dt/devices",
  readingsRetentionHours: toNumber(process.env.READINGS_RETENTION_HOURS, 24),
};
