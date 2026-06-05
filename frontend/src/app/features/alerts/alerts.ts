import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertsService } from '../../core/alerts.service';
import { SocketService } from '../../core/socket.service';
import { Alert, AlertSeverity } from '../../core/models';
import { HasRoleDirective } from '../../core/has-role.directive';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    HasRoleDirective,
  ],
  template: `
    <div class="page">
      <div class="header">
        <h2 class="page-title">Alertas</h2>
        <span class="spacer"></span>
        <mat-slide-toggle [checked]="sound()" (change)="sound.set($event.checked)">
          <mat-icon>{{ sound() ? 'volume_up' : 'volume_off' }}</mat-icon>
        </mat-slide-toggle>
      </div>

      <div class="filters">
        <mat-form-field appearance="outline">
          <mat-label>Severidad</mat-label>
          <mat-select [value]="severity()" (valueChange)="severity.set($event)">
            <mat-option value="all">Todas</mat-option>
            <mat-option value="critical">Crítica</mat-option>
            <mat-option value="warning">Advertencia</mat-option>
            <mat-option value="info">Info</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Estado</mat-label>
          <mat-select [value]="status()" (valueChange)="status.set($event)">
            <mat-option value="all">Todos</mat-option>
            <mat-option value="active">Activas</mat-option>
            <mat-option value="acknowledged">Reconocidas</mat-option>
            <mat-option value="resolved">Resueltas</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <div class="list">
        @for (a of filtered(); track a.alertId) {
          <mat-card class="alert" [class]="a.severity">
            <mat-icon class="sev-icon">{{ a.severity === 'critical' ? 'error' : 'warning' }}</mat-icon>
            <div class="body">
              <div class="msg">{{ a.message }}</div>
              <div class="sub">
                <span class="badge">{{ a.severity }}</span>
                <span class="badge type">{{ a.type }}</span>
                <span>{{ a.createdAt | date: 'medium' }}</span>
                @if (a.resolvedAt) { <span class="badge resolved">resuelta</span> }
                @else if (a.acknowledged) { <span class="badge ack">reconocida</span> }
              </div>
            </div>
            <div class="actions" *hasRole="['admin', 'operator']">
              @if (!a.acknowledged && !a.resolvedAt) {
                <button mat-stroked-button (click)="acknowledge(a)">Reconocer</button>
              }
              @if (!a.resolvedAt) {
                <button mat-flat-button color="primary" (click)="resolve(a)">Resolver</button>
              }
            </div>
          </mat-card>
        } @empty {
          <p class="muted">No hay alertas con esos filtros.</p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .header { display: flex; align-items: center; }
      .filters { display: flex; gap: 12px; flex-wrap: wrap; }
      .filters mat-form-field { width: 180px; }
      .list { display: flex; flex-direction: column; gap: 10px; }
      .alert {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 12px 16px;
        border-left: 5px solid #f9a825;
      }
      .alert.critical { border-left-color: #c62828; }
      .sev-icon { color: #f9a825; }
      .alert.critical .sev-icon { color: #c62828; }
      .body { flex: 1; }
      .msg { font-weight: 500; }
      .sub { display: flex; gap: 8px; align-items: center; opacity: 0.75; font-size: 0.8rem; margin-top: 4px; flex-wrap: wrap; }
      .badge { background: var(--mat-sys-secondary-container); color: var(--mat-sys-on-secondary-container); padding: 1px 8px; border-radius: 8px; text-transform: capitalize; }
      .badge.ack { background: #f9a825; color: #000; }
      .badge.resolved { background: #2e7d32; color: #fff; }
      .actions { display: flex; gap: 8px; }
      .muted { opacity: 0.6; padding: 12px; }
    `,
  ],
})
export class Alerts {
  private api = inject(AlertsService);
  private socket = inject(SocketService);
  private snack = inject(MatSnackBar);

  protected items = signal<Alert[]>([]);
  protected severity = signal<'all' | AlertSeverity>('all');
  protected status = signal<'all' | 'active' | 'acknowledged' | 'resolved'>('all');
  protected sound = signal(true);

  private lastBeepId: string | null = null;

  protected filtered = computed<Alert[]>(() => {
    const sev = this.severity();
    const st = this.status();
    return this.items().filter((a) => {
      if (sev !== 'all' && a.severity !== sev) {
        return false;
      }
      if (st === 'active' && (a.acknowledged || a.resolvedAt)) {
        return false;
      }
      if (st === 'acknowledged' && !a.acknowledged) {
        return false;
      }
      if (st === 'resolved' && !a.resolvedAt) {
        return false;
      }
      return true;
    });
  });

  constructor() {
    this.api.list(200).subscribe((page) => this.items.set(page.items));

    // Mezcla las alertas que llegan en vivo por WebSocket.
    effect(() => {
      const live = this.socket.lastAlert();
      if (!live) {
        return;
      }
      untracked(() => {
        this.items.update((list) =>
          list.some((x) => x.alertId === live.alertId)
            ? list.map((x) => (x.alertId === live.alertId ? live : x))
            : [live, ...list],
        );
        if (this.sound() && live.severity === 'critical' && this.lastBeepId !== live.alertId) {
          this.lastBeepId = live.alertId;
          this.beep();
        }
      });
    });
  }

  acknowledge(a: Alert): void {
    this.api.acknowledge(a.alertId).subscribe({
      next: (updated) => this.replace(updated),
      error: () => this.snack.open('Error al reconocer', 'Cerrar', { duration: 3000 }),
    });
  }

  resolve(a: Alert): void {
    this.api.resolve(a.alertId).subscribe({
      next: (updated) => this.replace(updated),
      error: () => this.snack.open('Error al resolver', 'Cerrar', { duration: 3000 }),
    });
  }

  private replace(updated: Alert): void {
    this.items.update((list) => list.map((x) => (x.alertId === updated.alertId ? updated : x)));
  }

  private beep(): void {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.1;
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch (error) {
      console.error('Error al reproducir sonido de alerta:', error);
    }
  }
}
