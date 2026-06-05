import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ChartConfiguration } from 'chart.js';
import { ChartComponent } from '../../shared/chart.component';
import { DashboardService } from '../../core/dashboard.service';
import { DevicesService } from '../../core/devices.service';
import { AlertsService } from '../../core/alerts.service';
import { SocketService } from '../../core/socket.service';
import { Alert, DashboardOverview, Device, DeviceStats } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DatePipe, RouterLink, MatCardModule, MatIconModule, MatButtonModule, ChartComponent],
  template: `
    <div class="page">
      <h2 class="page-title">Dashboard</h2>

      <!-- KPIs -->
      <div class="cards-grid">
        <mat-card class="kpi">
          <mat-icon class="kpi-icon">memory</mat-icon>
          <div><div class="kpi-value">{{ stats()?.total ?? 0 }}</div><div class="kpi-label">Dispositivos</div></div>
        </mat-card>
        <mat-card class="kpi">
          <mat-icon class="kpi-icon ok">check_circle</mat-icon>
          <div><div class="kpi-value">{{ stats()?.online ?? 0 }}</div><div class="kpi-label">Online</div></div>
        </mat-card>
        <mat-card class="kpi">
          <mat-icon class="kpi-icon crit">warning</mat-icon>
          <div><div class="kpi-value">{{ overview()?.alerts?.active ?? 0 }}</div><div class="kpi-label">Alertas activas</div></div>
        </mat-card>
        <mat-card class="kpi">
          <mat-icon class="kpi-icon">show_chart</mat-icon>
          <div><div class="kpi-value">{{ overview()?.readings?.total ?? 0 }}</div><div class="kpi-label">Lecturas</div></div>
        </mat-card>
      </div>

      <!-- Gráficas -->
      <div class="charts">
        <mat-card class="chart-card wide">
          <mat-card-header><mat-card-title>Lecturas en tiempo real</mat-card-title></mat-card-header>
          <div class="chart-box"><app-chart type="line" [data]="liveChart()" /></div>
        </mat-card>

        <mat-card class="chart-card">
          <mat-card-header><mat-card-title>Dispositivos por estado</mat-card-title></mat-card-header>
          <div class="chart-box"><app-chart type="doughnut" [data]="statusChart()" /></div>
        </mat-card>

        <mat-card class="chart-card">
          <mat-card-header><mat-card-title>Dispositivos por tipo</mat-card-title></mat-card-header>
          <div class="chart-box"><app-chart type="bar" [data]="typeChart()" /></div>
        </mat-card>
      </div>

      <!-- Heatmap por rack + feed de alertas -->
      <div class="bottom">
        <mat-card class="rack-card">
          <mat-card-header><mat-card-title>Mapa de calor por rack</mat-card-title></mat-card-header>
          <div class="racks">
            @for (rack of racks(); track rack.rack) {
              <div class="rack" [class.crit]="rack.critical > 0" [routerLink]="['/devices']">
                <div class="rack-name">{{ rack.rack }}</div>
                <div class="rack-count">{{ rack.total }}</div>
                <div class="rack-sub">{{ rack.critical }} crít.</div>
              </div>
            } @empty {
              <p class="muted">Sin dispositivos todavía.</p>
            }
          </div>
        </mat-card>

        <mat-card class="feed-card">
          <mat-card-header><mat-card-title>Alertas recientes</mat-card-title></mat-card-header>
          <div class="feed">
            @for (a of feed(); track a.alertId) {
              <div class="feed-item" [class]="a.severity">
                <mat-icon>{{ a.severity === 'critical' ? 'error' : 'warning' }}</mat-icon>
                <div class="feed-text">
                  <div>{{ a.message }}</div>
                  <small>{{ a.createdAt | date: 'short' }}</small>
                </div>
              </div>
            } @empty {
              <p class="muted">Sin alertas. Todo en orden.</p>
            }
          </div>
        </mat-card>
      </div>
    </div>
  `,
  styles: [
    `
      .kpi {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
      }
      .kpi-icon {
        font-size: 36px;
        height: 36px;
        width: 36px;
        color: var(--mat-sys-primary);
      }
      .kpi-icon.ok { color: #2e7d32; }
      .kpi-icon.crit { color: #c62828; }
      .kpi-value { font-size: 1.8rem; font-weight: 600; line-height: 1; }
      .kpi-label { opacity: 0.7; font-size: 0.85rem; }
      .charts {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr;
        gap: 16px;
        margin-top: 16px;
      }
      .chart-card { padding: 8px; }
      .chart-box { height: 260px; padding: 8px; }
      @media (max-width: 1100px) {
        .charts { grid-template-columns: 1fr; }
      }
      .bottom {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-top: 16px;
      }
      @media (max-width: 900px) {
        .bottom { grid-template-columns: 1fr; }
      }
      .racks {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
        gap: 10px;
        padding: 12px;
      }
      .rack {
        border-radius: 10px;
        padding: 12px;
        text-align: center;
        cursor: pointer;
        background: var(--mat-sys-secondary-container);
        color: var(--mat-sys-on-secondary-container);
      }
      .rack.crit { background: #c62828; color: #fff; }
      .rack-name { font-weight: 600; }
      .rack-count { font-size: 1.5rem; font-weight: 700; }
      .rack-sub { font-size: 0.7rem; opacity: 0.85; }
      .feed { max-height: 320px; overflow-y: auto; padding: 8px 12px; }
      .feed-item {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        padding: 8px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .feed-item mat-icon { color: #f9a825; }
      .feed-item.critical mat-icon { color: #c62828; }
      .feed-text small { opacity: 0.6; }
      .muted { opacity: 0.6; padding: 12px; }
    `,
  ],
})
export class Dashboard implements OnDestroy {
  private dashboardApi = inject(DashboardService);
  private devicesApi = inject(DevicesService);
  private alertsApi = inject(AlertsService);
  protected socket = inject(SocketService);

  protected overview = signal<DashboardOverview | null>(null);
  protected stats = signal<DeviceStats | null>(null);
  protected devices = signal<Device[]>([]);
  private apiAlerts = signal<Alert[]>([]);

  private timer = setInterval(() => this.loadKpis(), 8000);

  constructor() {
    this.loadKpis();
    this.loadDevices();
    this.loadAlerts();
  }

  protected statusChart = computed<ChartConfiguration['data']>(() => {
    const s = this.stats();
    return {
      labels: ['Online', 'Offline', 'Mantenimiento', 'Crítico'],
      datasets: [
        {
          data: s ? [s.online, s.offline, s.maintenance, s.critical] : [0, 0, 0, 0],
          backgroundColor: ['#2e7d32', '#9e9e9e', '#f9a825', '#c62828'],
        },
      ],
    };
  });

  protected typeChart = computed<ChartConfiguration['data']>(() => {
    const counts: Record<string, number> = { temperature: 0, humidity: 0, power: 0, ups: 0, cooling: 0 };
    for (const d of this.devices()) {
      counts[d.type] = (counts[d.type] ?? 0) + 1;
    }
    return {
      labels: ['Temp', 'Humedad', 'Power', 'UPS', 'Cooling'],
      datasets: [
        {
          label: 'Dispositivos',
          data: [counts['temperature'], counts['humidity'], counts['power'], counts['ups'], counts['cooling']],
          backgroundColor: '#1565c0',
        },
      ],
    };
  });

  protected liveChart = computed<ChartConfiguration['data']>(() => {
    const readings = this.socket.recentReadings();
    return {
      labels: readings.map((r) => new Date(r.timestamp).toLocaleTimeString()),
      datasets: [
        {
          label: 'Valor',
          data: readings.map((r) => r.value),
          borderColor: '#1565c0',
          backgroundColor: 'rgba(21,101,192,0.15)',
          fill: true,
          tension: 0.35,
        },
      ],
    };
  });

  protected racks = computed(() => {
    const map = new Map<string, { rack: string; total: number; critical: number }>();
    for (const d of this.devices()) {
      const key = d.location?.rack ?? '—';
      const entry = map.get(key) ?? { rack: key, total: 0, critical: 0 };
      entry.total += 1;
      if (d.status === 'critical') {
        entry.critical += 1;
      }
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => a.rack.localeCompare(b.rack));
  });

  protected feed = computed<Alert[]>(() => {
    const merged = [...this.socket.recentAlerts(), ...this.apiAlerts()];
    const seen = new Set<string>();
    const unique: Alert[] = [];
    for (const a of merged) {
      if (!seen.has(a.alertId)) {
        seen.add(a.alertId);
        unique.push(a);
      }
    }
    return unique.slice(0, 12);
  });

  private loadKpis(): void {
    this.dashboardApi.overview().subscribe((o) => this.overview.set(o));
    this.devicesApi.stats().subscribe((s) => this.stats.set(s));
  }

  private loadDevices(): void {
    this.devicesApi.list(500).subscribe((page) => this.devices.set(page.items));
  }

  private loadAlerts(): void {
    this.alertsApi.list(20).subscribe((page) => this.apiAlerts.set(page.items));
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}
