import { GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { ddbDocClient } from "../db/dynamodb.js";
import { AppError } from "../utils/errors.js";
import type { Alert, AlertSeverity, AlertType } from "../types/domain.js";
import { emitEvent } from "./socket.service.js";
import { decodeCursor, encodeCursor } from "../utils/pagination.js";

export async function createAlert(input: {
  deviceId: string;
  severity: AlertSeverity;
  type: AlertType;
  message: string;
}): Promise<Alert> {
  const alertId = randomUUID();

  const item: Alert = {
    PK: `ALERT#${alertId}`,
    SK: "METADATA",
    entity: "ALERT",
    alertId,
    deviceId: input.deviceId,
    GSI1PK: `DEVICE#${input.deviceId}`,
    severity: input.severity,
    type: input.type,
    message: input.message,
    acknowledged: false,
    resolvedAt: null,
    createdAt: new Date().toISOString(),
  };

  await ddbDocClient.send(
    new PutCommand({
      TableName: env.dynamodbTable,
      Item: item,
    }),
  );

  emitEvent("alert:new", item);
  return item;
}

export async function listAlerts(limit = 100, cursor?: string): Promise<{ items: Alert[]; nextCursor?: string }> {
  let startKey = decodeCursor(cursor) as Record<string, unknown> | undefined;
  const items: Alert[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const result = await ddbDocClient.send(
      new ScanCommand({
        TableName: env.dynamodbTable,
        FilterExpression: "entity = :entity",
        ExpressionAttributeValues: { ":entity": "ALERT" },
        ExclusiveStartKey: startKey,
      }),
    );

    items.push(...((result.Items || []) as Alert[]));
    lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    startKey = lastEvaluatedKey;
  } while (lastEvaluatedKey && items.length < limit);

  const nextCursor = lastEvaluatedKey
    ? encodeCursor({ PK: String(lastEvaluatedKey.PK), SK: String(lastEvaluatedKey.SK) })
    : undefined;

  return { items, nextCursor };
}

export async function acknowledgeAlert(alertId: string): Promise<Alert> {
  const result = await ddbDocClient.send(
    new UpdateCommand({
      TableName: env.dynamodbTable,
      Key: { PK: `ALERT#${alertId}`, SK: "METADATA" },
      UpdateExpression: "SET acknowledged = :ack",
      ExpressionAttributeValues: { ":ack": true },
      ReturnValues: "ALL_NEW",
    }),
  );

  if (!result.Attributes) {
    throw new AppError("Alerta no encontrada", 404, "NOT_FOUND");
  }

  emitEvent("alert:acknowledged", result.Attributes);
  return result.Attributes as Alert;
}

export async function resolveAlert(alertId: string): Promise<Alert> {
  const result = await ddbDocClient.send(
    new UpdateCommand({
      TableName: env.dynamodbTable,
      Key: { PK: `ALERT#${alertId}`, SK: "METADATA" },
      UpdateExpression: "SET resolvedAt = :resolvedAt",
      ExpressionAttributeValues: { ":resolvedAt": new Date().toISOString() },
      ReturnValues: "ALL_NEW",
    }),
  );

  if (!result.Attributes) {
    throw new AppError("Alerta no encontrada", 404, "NOT_FOUND");
  }

  emitEvent("alert:resolved", result.Attributes);
  return result.Attributes as Alert;
}

export async function getAlert(alertId: string): Promise<Alert> {
  const result = await ddbDocClient.send(
    new GetCommand({
      TableName: env.dynamodbTable,
      Key: { PK: `ALERT#${alertId}`, SK: "METADATA" },
    }),
  );

  if (!result.Item) {
    throw new AppError("Alerta no encontrada", 404, "NOT_FOUND");
  }

  return result.Item as Alert;
}
