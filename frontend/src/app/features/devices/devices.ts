import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DevicesService } from '../../core/devices.service';
import { Device, DEVICE_STATUSES, DeviceStatus } from '../../core/models';
import { HasRoleDirective } from '../../core/has-role.directive';
import { DeviceForm } from './device-form';

@Component({
  selector: 'app-devices',
  standalone: true,
  imports: [
    RouterLink,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    HasRoleDirective,
  ],
  template: `
    <div class="page">
      <div class="header">
        <h2 class="page-title">Dispositivos</h2>
        <span class="spacer"></span>
        <button mat-flat-button color="primary" *hasRole="['admin', 'operator']" (click)="openForm()">
          <mat-icon>add</mat-icon> Nuevo
        </button>
      </div>

      <mat-form-field appearance="outline" class="search">
        <mat-label>Buscar por nombre, tipo o rack</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input matInput (input)="onSearch($any($event.target).value)" placeholder="ej. temperature-01" />
      </mat-form-field>

      <div class="table-wrap">
        <table mat-table [dataSource]="filtered()" class="full">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Nombre</th>
            <td mat-cell *matCellDef="let d">
              <a [routerLink]="['/devices', d.deviceId]" class="link">{{ d.name }}</a>
            </td>
          </ng-container>

          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef>Tipo</th>
            <td mat-cell *matCellDef="let d">{{ d.type }}</td>
          </ng-container>

          <ng-container matColumnDef="rack">
            <th mat-header-cell *matHeaderCellDef>Ubicación</th>
            <td mat-cell *matCellDef="let d">{{ d.location.rack }} · pos {{ d.location.position }}</td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Estado</th>
            <td mat-cell *matCellDef="let d">
              <span class="chip" [class]="d.status">{{ d.status }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let d" class="actions">
              <a mat-icon-button [routerLink]="['/devices', d.deviceId]" matTooltip="Ver detalle">
                <mat-icon>visibility</mat-icon>
              </a>
              <button
                mat-icon-button
                *hasRole="['admin', 'operator']"
                [matMenuTriggerFor]="statusMenu"
                [matMenuTriggerData]="{ device: d }"
                matTooltip="Cambiar estado"
              >
                <mat-icon>swap_horiz</mat-icon>
              </button>
              <button mat-icon-button *hasRole="['admin', 'operator']" (click)="openForm(d)" matTooltip="Editar">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button *hasRole="['admin']" (click)="remove(d)" matTooltip="Eliminar">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>

        @if (filtered().length === 0) {
          <p class="muted">No hay dispositivos que coincidan.</p>
        }
      </div>

      <div class="footer">
        <span class="muted">{{ filtered().length }} de {{ devices().length }} cargados</span>
        @if (nextCursor()) {
          <button mat-stroked-button (click)="loadMore()" [disabled]="loading()">Cargar más</button>
        }
      </div>
    </div>

    <mat-menu #statusMenu="matMenu">
      <ng-template matMenuContent let-device="device">
        @for (s of statuses; track s) {
          <button mat-menu-item (click)="changeStatus(device, s)">{{ s }}</button>
        }
      </ng-template>
    </mat-menu>
  `,
  styles: [
    `
      .header { display: flex; align-items: center; }
      .search { width: 100%; max-width: 480px; margin-bottom: 8px; }
      .table-wrap { background: var(--mat-sys-surface-container-low); border-radius: 12px; overflow: hidden; }
      .full { width: 100%; }
      .link { color: var(--mat-sys-primary); text-decoration: none; font-weight: 500; }
      .actions { white-space: nowrap; text-align: right; }
      .chip {
        padding: 2px 10px;
        border-radius: 10px;
        font-size: 0.75rem;
        text-transform: capitalize;
        color: #fff;
        background: #9e9e9e;
      }
      .chip.online { background: #2e7d32; }
      .chip.critical { background: #c62828; }
      .chip.maintenance { background: #f9a825; color: #000; }
      .chip.offline { background: #757575; }
      .footer { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
      .muted { opacity: 0.6; padding: 12px; }
    `,
  ],
})
export class Devices {
  private api = inject(DevicesService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);

  protected devices = signal<Device[]>([]);
  protected nextCursor = signal<string | undefined>(undefined);
  protected loading = signal(false);
  protected search = signal('');
  protected statuses = DEVICE_STATUSES;
  protected columns = ['name', 'type', 'rack', 'status', 'actions'];

  private searchSubject = new Subject<string>();

  protected filtered = computed(() => {
    const term = this.search().toLowerCase().trim();
    if (!term) {
      return this.devices();
    }
    return this.devices().filter(
      (d) =>
        d.name.toLowerCase().includes(term) ||
        d.type.toLowerCase().includes(term) ||
        d.location.rack.toLowerCase().includes(term),
    );
  });

  constructor() {
    this.load();
    this.searchSubject
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.search.set(value));
  }

  onSearch(value: string): void {
    this.searchSubject.next(value);
  }

  private load(): void {
    this.loading.set(true);
    this.api.list(50).subscribe({
      next: (page) => {
        this.devices.set(page.items);
        this.nextCursor.set(page.nextCursor);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadMore(): void {
    const cursor = this.nextCursor();
    if (!cursor) {
      return;
    }
    this.loading.set(true);
    this.api.list(50, cursor).subscribe({
      next: (page) => {
        this.devices.update((list) => [...list, ...page.items]);
        this.nextCursor.set(page.nextCursor);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openForm(device?: Device): void {
    const ref = this.dialog.open(DeviceForm, { data: device ?? null });
    ref.afterClosed().subscribe((input) => {
      if (!input) {
        return;
      }
      const request = device ? this.api.update(device.deviceId, input) : this.api.create(input);
      request.subscribe({
        next: () => {
          this.snack.open(device ? 'Dispositivo actualizado' : 'Dispositivo creado', 'OK', { duration: 2500 });
          this.load();
        },
        error: () => this.snack.open('Error al guardar', 'Cerrar', { duration: 3000 }),
      });
    });
  }

  changeStatus(device: Device, status: DeviceStatus): void {
    this.api.patchStatus(device.deviceId, status).subscribe({
      next: (updated) => {
        this.devices.update((list) => list.map((d) => (d.deviceId === device.deviceId ? updated : d)));
        this.snack.open(`Estado: ${status}`, 'OK', { duration: 2000 });
      },
      error: () => this.snack.open('Error al cambiar estado', 'Cerrar', { duration: 3000 }),
    });
  }

  remove(device: Device): void {
    if (!confirm(`¿Eliminar el dispositivo "${device.name}"?`)) {
      return;
    }
    this.api.remove(device.deviceId).subscribe({
      next: () => {
        this.devices.update((list) => list.filter((d) => d.deviceId !== device.deviceId));
        this.snack.open('Dispositivo eliminado', 'OK', { duration: 2500 });
      },
      error: () => this.snack.open('Error al eliminar', 'Cerrar', { duration: 3000 }),
    });
  }
}
