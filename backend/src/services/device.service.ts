import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { ddbDocClient } from "../db/dynamodb.js";
import { AppError } from "../utils/errors.js";
import { decodeCursor, encodeCursor } from "../utils/pagination.js";
import type { Device, DeviceStatus, DeviceType } from "../types/domain.js";

export interface DeviceInput {
  name: string;
  type: DeviceType;
  location: { rack: string; position: number; floor: number };
  status: DeviceStatus;
  thresholds: { min: number; max: number; criticalMin: number; criticalMax: number };
  metadata: { manufacturer: string; model: string; firmwareVersion: string };
}

export async function createDevice(input: DeviceInput): Promise<Device> {
  const now = new Date().toISOString();
  const deviceId = randomUUID();

  const item: Device = {
    PK: `DEVICE#${deviceId}`,
    SK: "METADATA",
    entity: "DEVICE",
    listType: "DEVICE",
    deviceId,
    ...input,
    createdAt: now,
    updatedAt: now,
  };

  await ddbDocClient.send(
    new PutCommand({
      TableName: env.dynamodbTable,
      Item: item,
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  );

  return item;
}

export async function getDevice(deviceId: string): Promise<Device> {
  const result = await ddbDocClient.send(
    new GetCommand({
      TableName: env.dynamodbTable,
      Key: { PK: `DEVICE#${deviceId}`, SK: "METADATA" },
    }),
  );

  if (!result.Item) {
    throw new AppError("Dispositivo no encontrado", 404, "NOT_FOUND");
  }

  return result.Item as Device;
}

export async function listDevices(limit = 20, cursor?: string): Promise<{ items: Device[]; nextCursor?: string }> {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName: env.dynamodbTable,
      IndexName: "ListIndex",
      KeyConditionExpression: "listType = :lt",
      ExpressionAttributeValues: { ":lt": "DEVICE" },
      Limit: limit,
      ExclusiveStartKey: decodeCursor(cursor),
    }),
  );

  const items = (result.Items || []) as Device[];
  const nextCursor = result.LastEvaluatedKey
    ? encodeCursor(result.LastEvaluatedKey as Record<string, unknown>)
    : undefined;

  return { items, nextCursor };
}

export async function updateDevice(deviceId: string, input: Partial<DeviceInput>): Promise<Device> {
  const current = await getDevice(deviceId);
  const merged: Device = {
    ...current,
    ...input,
    location: input.location || current.location,
    thresholds: input.thresholds || current.thresholds,
    metadata: input.metadata || current.metadata,
    updatedAt: new Date().toISOString(),
  };

  await ddbDocClient.send(
    new PutCommand({
      TableName: env.dynamodbTable,
      Item: merged,
    }),
  );

  return merged;
}

export async function patchDeviceStatus(deviceId: string, status: DeviceStatus): Promise<Device> {
  const result = await ddbDocClient.send(
    new UpdateCommand({
      TableName: env.dynamodbTable,
      Key: { PK: `DEVICE#${deviceId}`, SK: "METADATA" },
      UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": status,
        ":updatedAt": new Date().toISOString(),
      },
      ReturnValues: "ALL_NEW",
    }),
  );

  if (!result.Attributes) {
    throw new AppError("Dispositivo no encontrado", 404, "NOT_FOUND");
  }

  return result.Attributes as Device;
}

export async function deleteDevice(deviceId: string): Promise<void> {
  await ddbDocClient.send(
    new DeleteCommand({
      TableName: env.dynamodbTable,
      Key: { PK: `DEVICE#${deviceId}`, SK: "METADATA" },
    }),
  );
}

export async function getDeviceStatsSummary(): Promise<Record<string, number>> {
  const { items } = await listDevices(500);
  const total = items.length;
  const byStatus = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  return {
    total,
    online: byStatus.online || 0,
    offline: byStatus.offline || 0,
    maintenance: byStatus.maintenance || 0,
    critical: byStatus.critical || 0,
  };
}

export async function getDeviceReadings(
  deviceId: string,
  limit = 50,
  cursor?: string,
): Promise<{ items: unknown[]; nextCursor?: string }> {
  const startKey = decodeCursor(cursor);

  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName: env.dynamodbTable,
      KeyConditionExpression: "PK = :pk and begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `DEVICE#${deviceId}`,
        ":sk": "READING#",
      },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: startKey,
    }),
  );

  const items = result.Items || [];
  const nextCursor = result.LastEvaluatedKey
    ? encodeCursor({ PK: String(result.LastEvaluatedKey.PK), SK: String(result.LastEvaluatedKey.SK) })
    : undefined;

  return { items, nextCursor };
}

export async function getDeviceAlerts(deviceId: string, limit = 50): Promise<unknown[]> {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName: env.dynamodbTable,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": `DEVICE#${deviceId}`,
      },
      Limit: limit,
      ScanIndexForward: false,
    }),
  );

  return result.Items || [];
}
