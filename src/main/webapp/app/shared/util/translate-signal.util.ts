import { hasText } from 'app/shared/util/text.util';
import { Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { LangChangeEvent, TranslateService } from '@ngx-translate/core';

export interface ReactiveTranslator {
  /**
   * Returns the resolved translation for `value`. When `shouldTranslate` is
   * `false`, the input is returned unchanged. `undefined` and empty strings
   * are passed through so optional inputs need no extra null guards.
   *
   * Reads the `langChange` signal so any consuming `computed()` re-evaluates
   * when the active language changes.
   */
  translate(value: string | undefined, shouldTranslate?: boolean, params?: Record<string, unknown>): string | undefined;

  /** Bare lang-change signal — useful when a `computed()` needs the dependency without resolving a key. */
  readonly langChange: Signal<LangChangeEvent | undefined>;

  /** The underlying TranslateService, for the few places that still need direct access. */
  readonly translateService: TranslateService;
}

/**
 * Returns a reactive translator bound to the current `TranslateService`.
 *
 * Must be called in an Angular injection context (e.g. a class field).
 */
export function injectTranslator(): ReactiveTranslator {
  const translateService = inject(TranslateService);
  const langChange = toSignal(translateService.onLangChange, { initialValue: undefined });

  return {
    translate(value: string | undefined, shouldTranslate = true, params: Record<string, unknown> = {}): string | undefined {
      langChange();
      if (!hasText(value)) {
        return value;
      }
      return shouldTranslate ? translateService.instant(value, params) : value;
    },
    langChange,
    translateService,
  };
}
