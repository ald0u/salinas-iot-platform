import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="login-bg">
      <mat-card class="login-card">
        @if (loading()) {
          <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        }
        <mat-card-content>
          <div class="brand">
            <mat-icon>sensors</mat-icon>
            <h1>Salinas IoT</h1>
          </div>
          <p class="subtitle">Monitoreo de centro de datos en tiempo real</p>

          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline" class="full">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="username" />
              <mat-icon matSuffix>mail</mat-icon>
              @if (form.controls.email.touched && form.controls.email.invalid) {
                <mat-error>Ingresa un email válido</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="full">
              <mat-label>Contraseña</mat-label>
              <input
                matInput
                [type]="hide() ? 'password' : 'text'"
                formControlName="password"
                autocomplete="current-password"
              />
              <button
                mat-icon-button
                matSuffix
                type="button"
                (click)="hide.set(!hide())"
                [attr.aria-label]="'Mostrar contraseña'"
              >
                <mat-icon>{{ hide() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              @if (form.controls.password.touched && form.controls.password.invalid) {
                <mat-error>La contraseña es obligatoria</mat-error>
              }
            </mat-form-field>

            @if (error()) {
              <div class="error-box">
                <mat-icon>error_outline</mat-icon>
                <span>{{ error() }}</span>
              </div>
            }

            <button
              mat-flat-button
              color="primary"
              class="full submit"
              type="submit"
              [disabled]="loading() || form.invalid"
            >
              Iniciar sesión
            </button>
          </form>

          <p class="hint">Demo: admin&#64;salinas.local / Admin1234!</p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .login-bg {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: linear-gradient(135deg, var(--mat-sys-primary-container), var(--mat-sys-tertiary-container));
      }
      .login-card {
        width: 100%;
        max-width: 400px;
        overflow: hidden;
        padding-top: 8px;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
      }
      .brand mat-icon {
        color: var(--mat-sys-primary);
      }
      .brand h1 {
        margin: 0;
        font-size: 1.6rem;
        font-weight: 600;
      }
      .subtitle {
        margin: 4px 0 20px;
        opacity: 0.7;
        font-size: 0.9rem;
      }
      .full {
        width: 100%;
      }
      .submit {
        margin-top: 8px;
        height: 44px;
      }
      .error-box {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--mat-sys-error-container);
        color: var(--mat-sys-on-error-container);
        padding: 8px 12px;
        border-radius: 8px;
        margin-bottom: 12px;
        font-size: 0.85rem;
      }
      .hint {
        text-align: center;
        opacity: 0.55;
        font-size: 0.75rem;
        margin: 16px 0 0;
      }
    `,
  ],
})
export class Login {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  protected loading = signal(false);
  protected error = signal<string | null>(null);
  protected hide = signal(true);

  protected form = this.fb.nonNullable.group({
    email: ['admin@salinas.local', [Validators.required, Validators.email]],
    password: ['Admin1234!', [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error.set(err?.error?.error?.message ?? err?.error?.message ?? 'Credenciales inválidas');
        this.loading.set(false);
      },
    });
  }
}
