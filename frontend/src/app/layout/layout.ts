import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../core/auth.service';
import { ThemeService } from '../core/theme.service';
import { SocketService } from '../core/socket.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  template: `
    <mat-toolbar color="primary" class="topbar">
      <button mat-icon-button (click)="drawer.toggle()" aria-label="Menú">
        <mat-icon>menu</mat-icon>
      </button>
      <mat-icon class="brand-icon">sensors</mat-icon>
      <span class="brand">Salinas IoT</span>
      <span class="spacer"></span>

      <mat-icon
        class="conn"
        [class.online]="socket.connected()"
        [matTooltip]="socket.connected() ? 'Tiempo real conectado' : 'Sin conexión en tiempo real'"
      >
        {{ socket.connected() ? 'cloud_done' : 'cloud_off' }}
      </mat-icon>

      <button mat-icon-button (click)="theme.toggle()" [matTooltip]="theme.dark() ? 'Tema claro' : 'Tema oscuro'">
        <mat-icon>{{ theme.dark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
      </button>

      <span class="email">{{ auth.user()?.email }}</span>
      <span class="role-chip">{{ auth.role() }}</span>

      <button mat-icon-button (click)="auth.logout()" matTooltip="Cerrar sesión">
        <mat-icon>logout</mat-icon>
      </button>
    </mat-toolbar>

    <mat-sidenav-container class="container">
      <mat-sidenav #drawer mode="side" opened class="sidenav">
        <mat-nav-list>
          <a mat-list-item routerLink="/dashboard" routerLinkActive="active-link">
            <mat-icon matListItemIcon>dashboard</mat-icon>
            <span matListItemTitle>Dashboard</span>
          </a>
          <a mat-list-item routerLink="/devices" routerLinkActive="active-link">
            <mat-icon matListItemIcon>memory</mat-icon>
            <span matListItemTitle>Dispositivos</span>
          </a>
          <a mat-list-item routerLink="/alerts" routerLinkActive="active-link">
            <mat-icon matListItemIcon>notifications_active</mat-icon>
            <span matListItemTitle>Alertas</span>
          </a>
          <a mat-list-item routerLink="/analytics" routerLinkActive="active-link">
            <mat-icon matListItemIcon>insights</mat-icon>
            <span matListItemTitle>Analytics</span>
          </a>
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content class="content">
        <router-outlet />
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      .topbar {
        position: sticky;
        top: 0;
        z-index: 10;
        gap: 8px;
      }
      .brand-icon {
        margin-right: 4px;
      }
      .brand {
        font-weight: 500;
      }
      .spacer {
        flex: 1 1 auto;
      }
      .conn {
        opacity: 0.6;
      }
      .conn.online {
        opacity: 1;
        color: #7CFFB2;
      }
      .email {
        font-size: 0.85rem;
        opacity: 0.9;
      }
      .role-chip {
        font-size: 0.7rem;
        text-transform: uppercase;
        background: rgba(255, 255, 255, 0.2);
        padding: 2px 8px;
        border-radius: 10px;
        margin: 0 4px;
      }
      .container {
        position: absolute;
        top: 64px;
        bottom: 0;
        left: 0;
        right: 0;
      }
      .sidenav {
        width: 230px;
        border-right: 1px solid var(--mat-sys-outline-variant);
      }
      .active-link {
        background: var(--mat-sys-secondary-container);
      }
      @media (max-width: 700px) {
        .email {
          display: none;
        }
      }
    `,
  ],
})
export class Layout {
  protected auth = inject(AuthService);
  protected theme = inject(ThemeService);
  protected socket = inject(SocketService);

  constructor() {
    this.socket.connect();
  }
}
