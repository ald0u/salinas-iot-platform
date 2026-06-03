import NodeCache from "node-cache";
import { env } from "../config/env.js";
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
  const readings = await listReadings(1000);
  const from = Date.now() - hours * 60 * 60 * 1000;

  const filtered = readings.items.filter((r) => new Date(r.timestamp).getTime() >= from);

  const byDevice = filtered.reduce<Record<string, { count: number; avg: number; sum: number }>>((acc, item) => {
    if (!acc[item.deviceId]) {
      acc[item.deviceId] = { count: 0, avg: 0, sum: 0 };
    }
    acc[item.deviceId].count += 1;
    acc[item.deviceId].sum += item.value;
    acc[item.deviceId].avg = acc[item.deviceId].sum / acc[item.deviceId].count;
    return acc;
  }, {});

  return {
    hours,
    points: filtered.length,
    byDevice,
  };
}
