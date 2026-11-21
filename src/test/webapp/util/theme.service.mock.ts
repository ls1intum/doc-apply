import { Provider, signal, WritableSignal } from '@angular/core';
import { vi } from 'vitest';
import { ThemeOption, ThemeService } from 'app/service/theme.service';

export type ThemeServiceMock = Pick<ThemeService, 'theme' | 'syncWithSystem' | 'setTheme' | 'toggleTheme' | 'setSyncWithSystem'>;

export function createThemeServiceMock(initialTheme: ThemeOption = 'light', initialSyncWithSystem = false): ThemeServiceMock {
  const theme: WritableSignal<ThemeOption> = signal(initialTheme);
  const syncWithSystem: WritableSignal<boolean> = signal(initialSyncWithSystem);

  return {
    theme,
    syncWithSystem,
    setTheme: vi.fn((newTheme: ThemeOption, _saveToStorage?: boolean) => {
      theme.set(newTheme);
    }),
    toggleTheme: vi.fn(() => {
      const newTheme = theme() === 'dark' ? 'light' : 'dark';
      theme.set(newTheme);
      syncWithSystem.set(false);
    }),
    setSyncWithSystem: vi.fn((value: boolean) => {
      syncWithSystem.set(value);
    }),
  };
}

export function provideThemeServiceMock(mock: ThemeServiceMock = createThemeServiceMock()): Provider {
  return { provide: ThemeService, useValue: mock };
}

export type MatchMediaMockOptions = {
  prefersReducedMotion?: boolean;
};

/**
 * Replaces window.matchMedia for tests. No query matches, except the reduced-motion query when the reader is meant to
 * prefer reduced motion. Undo it with `vi.unstubAllGlobals()`.
 *
 * @param options `prefersReducedMotion` makes `(prefers-reduced-motion: reduce)` match
 */
export function setupWindowMatchMediaMock(options: MatchMediaMockOptions = {}): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: options.prefersReducedMotion === true && query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: undefined,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}
