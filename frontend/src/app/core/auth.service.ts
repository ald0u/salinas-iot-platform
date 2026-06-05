import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthUser, LoginResponse, UserRole } from './models';

const ACCESS_KEY = 'salinas_access';
const REFRESH_KEY = 'salinas_refresh';
const USER_KEY = 'salinas_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly accessToken = signal<string | null>(localStorage.getItem(ACCESS_KEY));
  readonly user = signal<AuthUser | null>(this.readUser());
  readonly isAuthenticated = computed(() => !!this.accessToken());
  readonly role = computed<UserRole | null>(() => this.user()?.role ?? null);

  login(email: string, password: string) {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap((res) => this.setSession(res)));
  }

  logout(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this.accessToken.set(null);
    this.user.set(null);
    this.router.navigate(['/login']);
  }

  hasRole(...roles: UserRole[]): boolean {
    const current = this.role();
    return !!current && roles.includes(current);
  }

  private setSession(res: LoginResponse): void {
    localStorage.setItem(ACCESS_KEY, res.tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, res.tokens.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this.accessToken.set(res.tokens.accessToken);
    this.user.set(res.user);
  }

  private readUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  }
}
