import { Injectable, effect, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly dark = signal<boolean>(localStorage.getItem('salinas_theme') === 'dark');

  constructor() {
    effect(() => {
      const isDark = this.dark();
      document.documentElement.classList.toggle('dark', isDark);
      localStorage.setItem('salinas_theme', isDark ? 'dark' : 'light');
    });
  }

  toggle(): void {
    this.dark.update((v) => !v);
  }
}
