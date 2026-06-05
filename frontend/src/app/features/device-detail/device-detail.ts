import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { ChartConfiguration } from 'chart.js';
import { ChartComponent } from '../../shared/chart.component';
import { DevicesService } from '../../core/devices.service';
import { DashboardService } from '../../core/dashboard.service';
import { SocketService } from '../../core/socket.service';
import { Device, Reading, ReadingsAnalytics } from '../../core/models';

@Component({
  selector: 'app-device-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    ChartComponent,
  ],
  template: `
    <div class="page">
      <a mat-button routerLink="/devices"><mat-icon>arrow_back</mat-icon> Dispositivos</a>

      @if (device(); as d) {
        <div class="head">
          <div>
            <h2 class="page-title">{{ d.name }}</h2>
            <div class="meta">
              <span class="chip" [class]="d.status">{{ d.status }}</span>
              <span>{{ d.type }}</span>
              <span>· Rack {{ d.location.rack }} · pos {{ d.location.position }} · piso {{ d.location.floor }}</span>
            </div>
          </div>
        </div>

        <div class="cards-grid">
          <mat-card class="kpi"><div class="kpi-value">{{ analytics()?.total ?? 0 }}</div><div class="kpi-label">Lecturas</div></mat-card>
          <mat-card class="kpi"><div class="kpi-value">{{ analytics()?.average ?? 0 | number: '1.0-1' }}</div><div class="kpi-label">Promedio</div></mat-card>
          <mat-card class="kpi"><div class="kpi-value">{{ analytics()?.min ?? 0 | number: '1.0-1' }}</div><div class="kpi-label">Mínimo</div></mat-card>
          <mat-card class="kpi"><div class="kpi-value">{{ analytics()?.max ?? 0 | number: '1.0-1' }}</div><div class="kpi-label">Máximo</div></mat-card>
        </div>

        <mat-card class="chart-card">
          <mat-card-header>
            <mat-card-title>Lecturas en vivo</mat-card-title>
            <mat-card-subtitle>
              Umbrales: {{ d.thresholds.min }}–{{ d.thresholds.max }} (crítico {{ d.thresholds.criticalMin }}/{{ d.thresholds.criticalMax }})
            </mat-card-subtitle>
          </mat-card-header>
          <div class="chart-box"><app-chart type="line" [data]="chart()" /></div>
        </mat-card>

        <mat-card class="hist">
          <mat-card-header><mat-card-title>Historial reciente</mat-card-title></mat-card-header>
          <table mat-table [dataSource]="recentTable()" class="full">
            <ng-container matColumnDef="timestamp">
              <th mat-header-cell *matHeaderCellDef>Fecha</th>
              <td mat-cell *matCellDef="let r">{{ r.timestamp | date: 'medium' }}</td>
            </ng-container>
            <ng-container matColumnDef="value">
              <th mat-header-cell *matHeaderCellDef>Valor</th>
              <td mat-cell *matCellDef="let r">{{ r.value | number: '1.0-2' }} {{ r.unit }}</td>
            </ng-container>
            <ng-container matColumnDef="quality">
              <th mat-header-cell *matHeaderCellDef>Calidad</th>
              <td mat-cell *matCellDef="let r">{{ r.quality }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="histColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: histColumns"></tr>
          </table>
        </mat-card>
      } @else {
        <p class="muted">Cargando dispositivo…</p>
      }
    </div>
  `,
  styles: [
    `
      .head { display: flex; align-items: center; margin: 8px 0 16px; }
      .meta { display: flex; gap: 8px; align-items: center; opacity: 0.8; flex-wrap: wrap; }
      .kpi { padding: 16px; text-align: center; }
      .kpi-value { font-size: 1.6rem; font-weight: 600; }
      .kpi-label { opacity: 0.7; font-size: 0.85rem; }
      .chart-card { margin-top: 16px; padding: 8px; }
      .chart-box { height: 300px; padding: 8px; }
      .hist { margin-top: 16px; }
      .full { width: 100%; }
      .chip { padding: 2px 10px; border-radius: 10px; font-size: 0.75rem; color: #fff; background: #9e9e9e; }
      .chip.online { background: #2e7d32; }
      .chip.critical { background: #c62828; }
      .chip.maintenance { background: #f9a825; color: #000; }
      .muted { opacity: 0.6; }
    `,
  ],
})
export class DeviceDetail implements OnInit, OnDestroy {
  readonly id = input.required<string>();

  private devicesApi = inject(DevicesService);
  private dashboardApi = inject(DashboardService);
  private socket = inject(SocketService);

  protected device = signal<Device | null>(null);
  protected analytics = signal<ReadingsAnalytics | null>(null);
  protected history = signal<Reading[]>([]);
  protected histColumns = ['timestamp', 'value', 'quality'];

  private series = computed<Reading[]>(() => {
    const live = this.socket.recentReadings().filter((r) => r.deviceId === this.id());
    return [...this.history(), ...live].slice(-40);
  });

  protected chart = computed<ChartConfiguration['data']>(() => {
    const s = this.series();
    return {
      labels: s.map((r) => new Date(r.timestamp).toLocaleTimeString()),
      datasets: [
        {
          label: 'Valor',
          data: s.map((r) => r.value),
          borderColor: '#1565c0',
          backgroundColor: 'rgba(21,101,192,0.15)',
          fill: true,
          tension: 0.35,
        },
      ],
    };
  });

  protected recentTable = computed(() => [...this.series()].reverse().slice(0, 15));

  ngOnInit(): void {
    const id = this.id();
    this.devicesApi.get(id).subscribe((d) => this.device.set(d));
    this.devicesApi.readings(id, 40).subscribe((page) => {
      this.history.set([...page.items].reverse());
    });
    this.dashboardApi.readingsAnalytics(id).subscribe((a) => this.analytics.set(a));
    this.socket.subscribeDevice(id);
  }

  ngOnDestroy(): void {
    this.socket.unsubscribeDevice(this.id());
  }
}
