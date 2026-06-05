export type DeviceType = "temperature" | "humidity" | "power" | "ups" | "cooling";
export type DeviceStatus = "online" | "offline" | "maintenance" | "critical";
export type ReadingQuality = "good" | "uncertain" | "bad";
export type AlertSeverity = "info" | "warning" | "critical" | "emergency";
export type AlertType = "threshold_exceeded" | "device_offline" | "anomaly_detected";
export type UserRole = "admin" | "operator" | "viewer";

export interface Device {
  PK: string;
  SK: "METADATA";
  entity: "DEVICE";
  listType?: string;
  deviceId: string;
  name: string;
  type: DeviceType;
  location: { rack: string; position: number; floor: number };
  status: DeviceStatus;
  thresholds: { min: number; max: number; criticalMin: number; criticalMax: number };
  metadata: { manufacturer: string; model: string; firmwareVersion: string };
  createdAt: string;
  updatedAt: string;
}

export interface Reading {
  PK: string;
  SK: string;
  entity: "READING";
  deviceId: string;
  value: number;
  unit: string;
  quality: ReadingQuality;
  timestamp: string;
  TTL: number;
}

export interface Alert {
  PK: string;
  SK: "METADATA";
  entity: "ALERT";
  listType?: string;
  alertId: string;
  deviceId: string;
  GSI1PK: string;
  severity: AlertSeverity;
  type: AlertType;
  message: string;
  acknowledged: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

export interface User {
  PK: string;
  SK: "METADATA";
  entity: "USER";
  userId: string;
  GSI1PK: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface RefreshTokenItem {
  PK: string;
  SK: string;
  entity: "REFRESH_TOKEN";
  userId: string;
  tokenId: string;
  expiresAt: string;
  TTL: number;
}
