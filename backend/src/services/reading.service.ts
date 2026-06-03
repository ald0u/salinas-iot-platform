import { PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { ddbDocClient } from "../db/dynamodb.js";
import type { Device, Reading, ReadingQuality } from "../types/domain.js";
import { getDevice } from "./device.service.js";
import { createAlert } from "./alert.service.js";
import { emitEvent } from "./socket.service.js";
import { decodeCursor, encodeCursor } from "../utils/pagination.js";

export interface ReadingInput {
  deviceId: string;
  value: number;
  unit: string;
  quality: ReadingQuality;
  timestamp: string;
}

function ttlIn30Days(): number {
  return Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
}

function evaluateSeverity(device: Device, value: number): "ok" | "warning" | "critical" {
  if (value < device.thresholds.criticalMin || value > device.thresholds.criticalMax) {
    return "critical";
  }
  if (value < device.thresholds.min || value > device.thresholds.max) {
    return "warning";
  }
  return "ok";
}

export async function ingestReading(input: ReadingInput): Promise<Reading> {
  const device = await getDevice(input.deviceId);

  const item: Reading = {
    PK: `DEVICE#${input.deviceId}`,
    SK: `READING#${input.timestamp}#${randomUUID()}`,
    entity: "READING",
    deviceId: input.deviceId,
    value: input.value,
    unit: input.unit,
    quality: input.quality,
    timestamp: input.timestamp,
    TTL: ttlIn30Days(),
  };

  await ddbDocClient.send(
    new PutCommand({
      TableName: env.dynamodbTable,
      Item: item,
    }),
  );

  const severity = evaluateSeverity(device, input.value);
  if (severity === "warning") {
    await createAlert({
      deviceId: input.deviceId,
      severity: "warning",
      type: "threshold_exceeded",
      message: `Valor fuera de umbral para ${device.name}: ${input.value}${input.unit}`,
    });
  }

  if (severity === "critical") {
    await createAlert({
      deviceId: input.deviceId,
      severity: "critical",
      type: "threshold_exceeded",
      message: `Valor crítico para ${device.name}: ${input.value}${input.unit}`,
    });
  }

  emitEvent("device:reading", item);
  emitEvent("dashboard:update", { deviceId: input.deviceId, timestamp: input.timestamp });

  return item;
}

export async function ingestBatchReadings(readings: ReadingInput[]): Promise<{ inserted: number }> {
  for (const reading of readings) {
    await ingestReading(reading);
  }

  return { inserted: readings.length };
}

export async function listReadings(limit = 100, cursor?: string): Promise<{ items: Reading[]; nextCursor?: string }> {
  const startKey = decodeCursor(cursor);

  const result = await ddbDocClient.send(
    new ScanCommand({
      TableName: env.dynamodbTable,
      FilterExpression: "entity = :entity",
      ExpressionAttributeValues: {
        ":entity": "READING",
      },
      Limit: limit,
      ExclusiveStartKey: startKey,
    }),
  );

  const items = (result.Items || []) as Reading[];
  const nextCursor = result.LastEvaluatedKey
    ? encodeCursor({ PK: String(result.LastEvaluatedKey.PK), SK: String(result.LastEvaluatedKey.SK) })
    : undefined;

  return { items, nextCursor };
}

export async function readingsAnalytics(deviceId?: string): Promise<{ total: number; average: number; min: number; max: number }> {
  let items: Reading[] = [];

  if (deviceId) {
    const result = await ddbDocClient.send(
      new QueryCommand({
        TableName: env.dynamodbTable,
        KeyConditionExpression: "PK = :pk and begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `DEVICE#${deviceId}`,
          ":sk": "READING#",
        },
      }),
    );
    items = (result.Items || []) as Reading[];
  } else {
    items = (await listReadings(1000)).items;
  }

  if (items.length === 0) {
    return { total: 0, average: 0, min: 0, max: 0 };
  }

  const values = items.map((i) => i.value);
  const total = values.length;
  const sum = values.reduce((acc, n) => acc + n, 0);

  return {
    total,
    average: sum / total,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}
