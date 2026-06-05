import NodeCache from "node-cache";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "../config/env.js";
import { ddbDocClient } from "../db/dynamodb.js";
import { listDevices } from "./device.service.js";
import { listAlerts } from "./alert.service.js";
import { listReadings } from "./reading.service.js";

const cache = new NodeCache({ stdTTL: env.kpiCacheTtl });

export async function getOverview(): Promise<Record<string, unknown>> {
  const cached = cache.get<Record<string, unknown>>("dashboard:overview");
  if (cached) {
    return cached;
  }

  const [devices, alertsPage, readingsPage] = await Promise.all([
    listDevices(500),
    listAlerts(500),
    listReadings(500),
  ]);

  const payload = {
    generatedAt: new Date().toISOString(),
    devices: {
      total: devices.items.length,
      online: devices.items.filter((d) => d.status === "online").length,
      critical: devices.items.filter((d) => d.status === "critical").length,
    },
    alerts: {
      total: alertsPage.items.length,
      active: alertsPage.items.filter((a) => !a.resolvedAt).length,
      acknowledged: alertsPage.items.filter((a) => a.acknowledged).length,
    },
    readings: {
      total: readingsPage.items.length,
    },
  };

  cache.set("dashboard:overview", payload);
  return payload;
}

export async function getRackOverview(rackId: string): Promise<Record<string, unknown>> {
  const devices = await listDevices(500);
  const rackDevices = devices.items.filter((d) => d.location.rack === rackId);

  return {
    rackId,
    totalDevices: rackDevices.length,
    byStatus: rackDevices.reduce<Record<string, number>>((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {}),
  };
}

export async function getTrends(hours = 24): Promise<Record<string, unknown>> {
  const fromIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const devices = (await listDevices(500)).items;

  const byDevice: Record<string, { count: number; avg: number; sum: number }> = {};
  let points = 0;

  // Por cada dispositivo, consulta SOLO sus lecturas dentro del rango de tiempo.
  // El SK es READING#<timestamp>#<uuid>, así que el filtro por tiempo es exacto.
  for (const device of devices) {
    let startKey: Record<string, unknown> | undefined;
    let count = 0;
    let sum = 0;

    do {
      const result = await ddbDocClient.send(
        new QueryCommand({
          TableName: env.dynamodbTable,
          KeyConditionExpression: "PK = :pk AND SK >= :from",
          ExpressionAttributeValues: {
            ":pk": `DEVICE#${device.deviceId}`,
            ":from": `READING#${fromIso}`,
          },
          ExclusiveStartKey: startKey,
        }),
      );

      for (const item of (result.Items || []) as Array<{ value: number }>) {
        count += 1;
        sum += item.value;
      }
      startKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (startKey);

    if (count > 0) {
      byDevice[device.deviceId] = { count, sum, avg: sum / count };
      points += count;
    }
  }

  return { hours, points, byDevice };
}
