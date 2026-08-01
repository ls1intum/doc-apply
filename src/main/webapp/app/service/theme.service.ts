import { Injectable, WritableSignal, inject, signal } from '@angular/core';
import { PrimeNG } from 'primeng/config';

import { AquaBloomTheme } from '../../content/theming/aquabloom';
import { BlossomTheme } from '../../content/theming/custompreset';
import { DocApplyPreset } from '../../content/theming/docapplypreset';

export type ThemeOption = 'light' | 'dark' | 'blossom' | 'aquabloom';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  theme: WritableSignal<ThemeOption> = signal(this.getInitialTheme());
  syncWithSystem: WritableSignal<boolean> = signal(this.getInitialSyncWithSystem());

  private primeNG = inject(PrimeNG);
  private readonly rootElement = document.documentElement;

  constructor() {
    const shouldSave = !this.syncWithSystem();
    this.setTheme(this.theme(), shouldSave);
    this.setupSystemThemeListener();
  }

  getInitialTheme(): ThemeOption {
    const storedSync = localStorage.getItem('docApplySyncWithSystem');
    const syncWithSystem = storedSync === null ? true : storedSync === 'true';

    if (syncWithSystem) {
      return this.getSystemTheme();
    }

    const stored = localStorage.getItem('docApplyTheme') as ThemeOption | null;

    if (stored === 'dark' || stored === 'blossom' || stored === 'light' || stored === 'aquabloom') {
      return stored;
    }
    const classList = document.documentElement.classList;
    if (classList.contains('docapply-blossom')) {
      return 'blossom';
    }
    if (classList.contains('docapply-dark-mode')) {
      return 'dark';
    }
    if (classList.contains('docapply-aquabloom')) {
      return 'aquabloom';
    }
    return 'light';
  }

  getInitialSyncWithSystem(): boolean {
    const stored = localStorage.getItem('docApplySyncWithSystem');
    return stored === null ? true : stored === 'true';
  }

  getSystemTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return 'light';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  setupSystemThemeListener(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', e => {
      if (this.syncWithSystem()) {
        // Don't save to localStorage when syncing with system
        this.setTheme(e.matches ? 'dark' : 'light', false);
      }
    });
  }

  setTheme(theme: ThemeOption, saveToStorage = true): void {
    this.theme.set(theme);

    const root = this.rootElement;

    // Disable transitions/animations before changing theme
    root.classList.add('theme-switching');

    root.classList.remove('docapply-dark-mode', 'docapply-blossom', 'docapply-aquabloom');

    const themeOptions = {
      darkModeSelector: '.docapply-dark-mode',
      cssLayer: { name: 'primeng', order: 'theme, base, primeng' },
    };

    if (theme === 'blossom') {
      this.primeNG.theme.set({ preset: BlossomTheme, options: themeOptions });
      root.classList.add('docapply-blossom');
    } else if (theme === 'aquabloom') {
      this.primeNG.theme.set({ preset: AquaBloomTheme, options: themeOptions });
      root.classList.add('docapply-aquabloom');
    } else {
      this.primeNG.theme.set({ preset: DocApplyPreset, options: themeOptions });
      if (theme === 'dark') {
        root.classList.add('docapply-dark-mode');
      }
    }

    if (saveToStorage) {
      localStorage.setItem('docApplyTheme', theme);
    }

    // allow one frame for styles to apply, then restore transitions
    window.requestAnimationFrame(() => {
      root.classList.remove('theme-switching');
    });
  }

  toggleTheme(): void {
    if (this.syncWithSystem()) {
      // Currently on system, switch to light
      this.syncWithSystem.set(false);
      localStorage.setItem('docApplySyncWithSystem', 'false');
      this.setTheme('light');
    } else if (this.theme() === 'light') {
      // Currently on light, switch to dark
      this.setTheme('dark');
    } else {
      // Currently on dark, switch back to system
      this.setSyncWithSystem(true);
    }
  }

  setSyncWithSystem(value: boolean): void {
    this.syncWithSystem.set(value);
    localStorage.setItem('docApplySyncWithSystem', String(value));

    if (value) {
      // When enabling system sync, remove the stored theme and don't save to localStorage
      localStorage.removeItem('docApplyTheme');
      const systemTheme = this.getSystemTheme();
      this.setTheme(systemTheme, false);
    }
  }
}
