export type UserRole = 'admin' | 'operator' | 'viewer';

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

export type DeviceType = 'temperature' | 'humidity' | 'power' | 'ups' | 'cooling';
export type DeviceStatus = 'online' | 'offline' | 'maintenance' | 'critical';

export interface DeviceLocation {
  rack: string;
  position: number;
  floor: number;
}

export interface DeviceThresholds {
  min: number;
  max: number;
  criticalMin: number;
  criticalMax: number;
}

export interface DeviceMetadata {
  manufacturer: string;
  model: string;
  firmwareVersion: string;
}

export interface Device {
  deviceId: string;
  name: string;
  type: DeviceType;
  location: DeviceLocation;
  status: DeviceStatus;
  thresholds: DeviceThresholds;
  metadata: DeviceMetadata;
  createdAt?: string;
  updatedAt?: string;
}

export type DeviceInput = Omit<Device, 'deviceId' | 'createdAt' | 'updatedAt'>;

export type ReadingQuality = 'good' | 'uncertain' | 'bad';

export interface Reading {
  deviceId: string;
  value: number;
  unit: string;
  quality: ReadingQuality;
  timestamp: string;
}

export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';
export type AlertType = 'threshold_exceeded' | 'device_offline' | 'anomaly_detected';

export interface Alert {
  alertId: string;
  deviceId: string;
  severity: AlertSeverity;
  type: AlertType;
  message: string;
  acknowledged: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor?: string;
}

export interface DashboardOverview {
  generatedAt: string;
  devices: { total: number; online: number; critical: number };
  alerts: { total: number; active: number; acknowledged: number };
  readings: { total: number };
}

export interface DeviceStats {
  total: number;
  online: number;
  offline: number;
  maintenance: number;
  critical: number;
}

export interface TrendsResponse {
  hours: number;
  points: number;
  byDevice: Record<string, { count: number; avg: number; sum: number }>;
}

export interface ReadingsAnalytics {
  total: number;
  average: number;
  min: number;
  max: number;
}

export const DEVICE_TYPES: DeviceType[] = ['temperature', 'humidity', 'power', 'ups', 'cooling'];
export const DEVICE_STATUSES: DeviceStatus[] = ['online', 'offline', 'maintenance', 'critical'];
