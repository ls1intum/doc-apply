import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { Message } from 'primeng/message';

@Component({
  selector: 'jhi-message',
  imports: [Message],
  templateUrl: './message.component.html',
})
export class MessageComponent {
  /**
   * The message text to display.
   * Can be a translation key if shouldTranslate is true.
   */
  message = input<string>('');

  /**
   * The severity/type of the message.
   */
  severity = input<'success' | 'info' | 'warn' | 'error' | 'secondary' | 'contrast'>('info');

  /**
   * The visual variant of the message.
   * - undefined: Default with background color (filled)
   * - 'outlined': Border only, no background
   * - 'simple': Text only, no border or background (ideal for inline validation)
   * - 'text': Text variant
   */
  variant = input<'outlined' | 'simple' | 'text' | undefined>(undefined);

  /**
   * Whether to translate the message using the translation key.
   */
  shouldTranslate = input<boolean>(true);

  /**
   * Parameters for i18n interpolation.
   */
  translationParams = input<Record<string, unknown>>({});

  /**
   * Additional CSS classes to apply.
   */
  classStyling = input<string>('');

  /**
   * Size of the message.
   */
  size = input<'small' | 'large' | undefined>(undefined);

  /**
   * Whether the message can be closed.
   */
  closable = input<boolean>(false);

  displayMessage = computed(() => {
    this.langChange();
    const value = this.message();
    return this.shouldTranslate() ? this.translateService.instant(value, this.translationParams()) : value;
  });

  mergedClass = computed(() => `rounded-sm ${this.classStyling()}`);

  private translateService = inject(TranslateService);
  private langChange = toSignal(this.translateService.onLangChange, { initialValue: undefined });
}
