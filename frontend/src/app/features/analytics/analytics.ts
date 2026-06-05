import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ChartConfiguration } from 'chart.js';
import { ChartComponent } from '../../shared/chart.component';
import { DashboardService } from '../../core/dashboard.service';
import { DevicesService } from '../../core/devices.service';
import { ReadingsAnalytics, TrendsResponse } from '../../core/models';

interface TrendRow {
  deviceId: string;
  name: string;
  count: number;
  avg: number;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    DecimalPipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    ChartComponent,
  ],
  template: `
    <div class="page">
      <div class="header">
        <h2 class="page-title">Analytics</h2>
        <span class="spacer"></span>
        <mat-form-field appearance="outline" class="hours">
          <mat-label>Periodo</mat-label>
          <mat-select [value]="hours()" (valueChange)="setHours($event)">
            <mat-option [value]="1">Última hora</mat-option>
            <mat-option [value]="6">Últimas 6 h</mat-option>
            <mat-option [value]="24">Últimas 24 h</mat-option>
            <mat-option [value]="72">Últimos 3 días</mat-option>
          </mat-select>
        </mat-form-field>
        <button mat-flat-button color="primary" (click)="exportCsv()" [disabled]="rows().length === 0">
          <mat-icon>download</mat-icon> Exportar CSV
        </button>
      </div>

      <div class="cards-grid">
        <mat-card class="kpi"><div class="kpi-value">{{ overall()?.total ?? 0 }}</div><div class="kpi-label">Lecturas totales</div></mat-card>
        <mat-card class="kpi"><div class="kpi-value">{{ overall()?.average ?? 0 | number: '1.0-1' }}</div><div class="kpi-label">Promedio</div></mat-card>
        <mat-card class="kpi"><div class="kpi-value">{{ overall()?.min ?? 0 | number: '1.0-1' }}</div><div class="kpi-label">Mínimo</div></mat-card>
        <mat-card class="kpi"><div class="kpi-value">{{ overall()?.max ?? 0 | number: '1.0-1' }}</div><div class="kpi-label">Máximo</div></mat-card>
      </div>

      <div class="charts">
        <mat-card class="chart-card">
          <mat-card-header><mat-card-title>Promedio por dispositivo</mat-card-title></mat-card-header>
          <div class="chart-box"><app-chart type="bar" [data]="avgChart()" /></div>
        </mat-card>
        <mat-card class="chart-card">
          <mat-card-header><mat-card-title>Volumen de lecturas por dispositivo</mat-card-title></mat-card-header>
          <div class="chart-box"><app-chart type="line" [data]="countChart()" /></div>
        </mat-card>
      </div>

      <mat-card class="table-card">
        <mat-card-header><mat-card-title>Tendencias ({{ points() }} lecturas en el periodo)</mat-card-title></mat-card-header>
        <table mat-table [dataSource]="rows()" class="full">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Dispositivo</th>
            <td mat-cell *matCellDef="let r">{{ r.name }}</td>
          </ng-container>
          <ng-container matColumnDef="count">
            <th mat-header-cell *matHeaderCellDef>Lecturas</th>
            <td mat-cell *matCellDef="let r">{{ r.count }}</td>
          </ng-container>
          <ng-container matColumnDef="avg">
            <th mat-header-cell *matHeaderCellDef>Promedio</th>
            <td mat-cell *matCellDef="let r">{{ r.avg | number: '1.0-2' }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols"></tr>
        </table>
        @if (rows().length === 0) {
          <p class="muted">Sin datos en el periodo seleccionado.</p>
        }
      </mat-card>
    </div>
  `,
  styles: [
    `
      .header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .hours { width: 170px; }
      .kpi { padding: 16px; text-align: center; }
      .kpi-value { font-size: 1.6rem; font-weight: 600; }
      .kpi-label { opacity: 0.7; font-size: 0.85rem; }
      .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
      @media (max-width: 900px) { .charts { grid-template-columns: 1fr; } }
      .chart-card { padding: 8px; }
      .chart-box { height: 280px; padding: 8px; }
      .table-card { margin-top: 16px; }
      .full { width: 100%; }
      .muted { opacity: 0.6; padding: 12px; }
    `,
  ],
})
export class Analytics {
  private dashboardApi = inject(DashboardService);
  private devicesApi = inject(DevicesService);

  protected hours = signal(24);
  protected trends = signal<TrendsResponse | null>(null);
  protected overall = signal<ReadingsAnalytics | null>(null);
  private names = signal<Record<string, string>>({});
  protected cols = ['name', 'count', 'avg'];

  protected points = computed(() => this.trends()?.points ?? 0);

  protected rows = computed<TrendRow[]>(() => {
    const byDevice = this.trends()?.byDevice ?? {};
    const names = this.names();
    return Object.entries(byDevice)
      .map(([deviceId, v]) => ({
        deviceId,
        name: names[deviceId] ?? deviceId.slice(0, 8),
        count: v.count,
        avg: v.avg,
      }))
      .sort((a, b) => b.count - a.count);
  });

  protected avgChart = computed<ChartConfiguration['data']>(() => {
    const top = this.rows().slice(0, 12);
    return {
      labels: top.map((r) => r.name),
      datasets: [{ label: 'Promedio', data: top.map((r) => r.avg), backgroundColor: '#00838f' }],
    };
  });

  protected countChart = computed<ChartConfiguration['data']>(() => {
    const top = this.rows().slice(0, 12);
    return {
      labels: top.map((r) => r.name),
      datasets: [
        {
          label: 'Lecturas',
          data: top.map((r) => r.count),
          borderColor: '#1565c0',
          backgroundColor: 'rgba(21,101,192,0.15)',
          fill: true,
          tension: 0.3,
        },
      ],
    };
  });

  constructor() {
    this.devicesApi.list(500).subscribe((page) => {
      const map: Record<string, string> = {};
      for (const d of page.items) {
        map[d.deviceId] = d.name;
      }
      this.names.set(map);
    });
    this.load();
  }

  setHours(h: number): void {
    this.hours.set(h);
    this.load();
  }

  private load(): void {
    this.dashboardApi.trends(this.hours()).subscribe((t) => this.trends.set(t));
    this.dashboardApi.readingsAnalytics().subscribe((a) => this.overall.set(a));
  }

  exportCsv(): void {
    const header = 'deviceId,nombre,lecturas,promedio\n';
    const body = this.rows()
      .map((r) => `${r.deviceId},${r.name},${r.count},${r.avg.toFixed(2)}`)
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-${this.hours()}h.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
