import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { Alert, Device, Reading } from './models';

/**
 * Cliente WebSocket (Socket.io). Expone los eventos del servidor como signals,
 * de modo que los componentes reaccionan en tiempo real sin recargar.
 */
@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket?: Socket;

  private readonly maxBuffer = 30;

  readonly connected = signal(false);
  readonly lastReading = signal<Reading | null>(null);
  readonly lastAlert = signal<Alert | null>(null);
  readonly lastStatus = signal<Device | null>(null);
  readonly dashboardTick = signal(0);
  readonly recentReadings = signal<Reading[]>([]);
  readonly recentAlerts = signal<Alert[]>([]);

  connect(): void {
    if (this.socket) {
      return;
    }
    this.socket = io(environment.wsUrl, { transports: ['websocket', 'polling'] });

    this.socket.on('connect', () => this.connected.set(true));
    this.socket.on('disconnect', () => this.connected.set(false));

    this.socket.on('device:reading', (r: Reading) => {
      this.lastReading.set(r);
      this.recentReadings.update((list) => [...list, r].slice(-this.maxBuffer));
    });

    this.socket.on('device:status', (d: Device) => this.lastStatus.set(d));

    this.socket.on('alert:new', (a: Alert) => {
      this.lastAlert.set(a);
      this.recentAlerts.update((list) => [a, ...list].slice(0, this.maxBuffer));
    });

    this.socket.on('alert:resolved', (a: Alert) => this.lastAlert.set(a));
    this.socket.on('dashboard:update', () => this.dashboardTick.update((v) => v + 1));
  }

  subscribeDevice(deviceId: string): void {
    this.socket?.emit('subscribe:device', deviceId);
  }

  unsubscribeDevice(deviceId: string): void {
    this.socket?.emit('unsubscribe:device', deviceId);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = undefined;
    this.connected.set(false);
  }
}
