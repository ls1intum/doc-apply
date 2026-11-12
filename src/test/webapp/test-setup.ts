import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';

import { provideZonelessChangeDetection, NgModule } from '@angular/core';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { getTestBed } from '@angular/core/testing';

@NgModule({
  providers: [provideZonelessChangeDetection()],
})
export class ZonelessTestModule {}

getTestBed().initTestEnvironment([BrowserTestingModule, ZonelessTestModule], platformBrowserTesting());

// ─── CSS Error Suppression ───────────────────────────────────────────────────
/**
 * Suppresses JSDOM CSS parsing errors caused by CSS custom properties in shorthand properties.
 * This is a known limitation of jsdom/cssstyle that does not affect test functionality.
 */
window.addEventListener('error', event => {
  const errorMessage = event.error?.message || event.message || '';
  if (
    errorMessage.includes("Cannot create property 'border-width'") ||
    errorMessage.includes("Cannot create property 'border-style'") ||
    errorMessage.includes("Cannot create property 'border-color'") ||
    (errorMessage.includes('border') && errorMessage.includes('var(--'))
  ) {
    event.preventDefault();
    event.stopPropagation();
  }
});

// ─── IntersectionObserver Mock ───────────────────────────────────────────────
/**
 * No-op {@link IntersectionObserver} mock for the jsdom test environment.
 *
 * Some components (e.g. progress-stepper) rely on IntersectionObserver, which is
 * not available in jsdom. This mock prevents {@link ReferenceError} and is
 * sufficient for unit tests that do not require real intersection behavior.
 */
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null;
    readonly rootMargin: string;
    readonly scrollMargin: string;
    readonly thresholds: ReadonlyArray<number>;

    constructor(_callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.root = options?.root ?? null;
      this.rootMargin = options?.rootMargin ?? '0px';
      this.scrollMargin = options?.scrollMargin ?? '0px';
      this.thresholds = Array.isArray(options?.threshold) ? options.threshold : [options?.threshold ?? 0];
    }

    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  globalThis.IntersectionObserver = MockIntersectionObserver;
}

// ─── Console Silencer Utility ────────────────────────────────────────────────
declare global {
  function runSilently<T>(fn: () => T): T;
}

/**
 * Silences all console output ({@link console.error}, {@link console.warn},
 * {@link console.info}) for the duration of the given function.
 *
 * Works with both synchronous and asynchronous functions. Console methods are
 * restored after the function completes, even if it throws.
 *
 * @param fn - The function to execute silently.
 * @returns The return value of {@link fn}.
 */
globalThis.runSilently = <T>(fn: () => T): T => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

  const restore = (): void => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  };

  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.finally(restore) as T;
    }
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
};
