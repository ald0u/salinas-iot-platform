import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { DEVICE_STATUSES, DEVICE_TYPES, Device, DeviceInput, DeviceStatus, DeviceType } from '../../core/models';

@Component({
  selector: 'app-device-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Editar dispositivo' : 'Nuevo dispositivo' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="grid">
        <mat-form-field appearance="outline" class="col-2">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Tipo</mat-label>
          <mat-select formControlName="type">
            @for (t of types; track t) { <mat-option [value]="t">{{ t }}</mat-option> }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Estado</mat-label>
          <mat-select formControlName="status">
            @for (s of statuses; track s) { <mat-option [value]="s">{{ s }}</mat-option> }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Rack</mat-label>
          <input matInput formControlName="rack" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Posición</mat-label>
          <input matInput type="number" min="1" formControlName="position" />
          @if (form.controls.position.touched && form.controls.position.invalid) {
            <mat-error>Debe ser 1 o mayor</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Piso</mat-label>
          <input matInput type="number" min="1" formControlName="floor" />
          @if (form.controls.floor.touched && form.controls.floor.invalid) {
            <mat-error>Debe ser 1 o mayor</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Mín</mat-label>
          <input matInput type="number" formControlName="min" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Máx</mat-label>
          <input matInput type="number" formControlName="max" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Crítico mín</mat-label>
          <input matInput type="number" formControlName="criticalMin" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Crítico máx</mat-label>
          <input matInput type="number" formControlName="criticalMax" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Fabricante</mat-label>
          <input matInput formControlName="manufacturer" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Modelo</mat-label>
          <input matInput formControlName="model" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Firmware</mat-label>
          <input matInput formControlName="firmwareVersion" />
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancelar</button>
      <button mat-flat-button color="primary" (click)="save()">Guardar</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 4px 12px;
        min-width: 420px;
        padding-top: 8px;
      }
      .col-2 {
        grid-column: span 2;
      }
      mat-form-field {
        width: 100%;
      }
      @media (max-width: 520px) {
        .grid {
          grid-template-columns: 1fr;
          min-width: auto;
        }
        .col-2 {
          grid-column: span 1;
        }
      }
    `,
  ],
})
export class DeviceForm {
  private fb = inject(FormBuilder);
  private ref = inject(MatDialogRef<DeviceForm>);
  protected data = inject<Device | null>(MAT_DIALOG_DATA);

  protected types = DEVICE_TYPES;
  protected statuses = DEVICE_STATUSES;

  protected form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    type: ['temperature', Validators.required],
    status: ['online', Validators.required],
    rack: ['A1', Validators.required],
    position: [1, [Validators.required, Validators.min(1)]],
    floor: [1, [Validators.required, Validators.min(1)]],
    min: [18, Validators.required],
    max: [30, Validators.required],
    criticalMin: [15, Validators.required],
    criticalMax: [35, Validators.required],
    manufacturer: ['ACME', Validators.required],
    model: ['SIM-100', Validators.required],
    firmwareVersion: ['1.0.0', Validators.required],
  });

  constructor() {
    if (this.data) {
      const d = this.data;
      this.form.patchValue({
        name: d.name,
        type: d.type,
        status: d.status,
        rack: d.location.rack,
        position: d.location.position,
        floor: d.location.floor,
        min: d.thresholds.min,
        max: d.thresholds.max,
        criticalMin: d.thresholds.criticalMin,
        criticalMax: d.thresholds.criticalMax,
        manufacturer: d.metadata.manufacturer,
        model: d.metadata.model,
        firmwareVersion: d.metadata.firmwareVersion,
      });
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const input: DeviceInput = {
      name: v.name,
      type: v.type as DeviceType,
      status: v.status as DeviceStatus,
      location: { rack: v.rack, position: Number(v.position), floor: Number(v.floor) },
      thresholds: {
        min: Number(v.min),
        max: Number(v.max),
        criticalMin: Number(v.criticalMin),
        criticalMax: Number(v.criticalMax),
      },
      metadata: { manufacturer: v.manufacturer, model: v.model, firmwareVersion: v.firmwareVersion },
    };
    this.ref.close(input);
  }

  cancel(): void {
    this.ref.close();
  }
}
