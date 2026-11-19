import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { TumAetUiMessageComponent } from '@tumaet/ui-angular';

type MessageSeverity = 'success' | 'info' | 'warn' | 'error' | 'secondary' | 'contrast';

const SIMPLE_TEXT_COLOR: Record<MessageSeverity, string> = {
  success: 'text-positive-default',
  info: 'text-info-default',
  warn: 'text-warning-default',
  error: 'text-negative-default',
  secondary: 'text-text-secondary',
  contrast: 'text-text-primary',
};

@Component({
  selector: 'jhi-message',
  imports: [NgTemplateOutlet, TumAetUiMessageComponent],
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
  severity = input<MessageSeverity>('info');

  variant = input<'simple' | undefined>(undefined);

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

  size = input<'small' | undefined>(undefined);

  displayMessage = computed(() => {
    this.langChange();
    const value = this.message();
    return this.shouldTranslate() ? this.translateService.instant(value, this.translationParams()) : value;
  });

  readonly kitClass = computed(() => `${this.classStyling()} ${this.size() === 'small' ? 'text-sm!' : ''}`);

  readonly simpleClass = computed(() => `text-xs font-medium leading-tight ${SIMPLE_TEXT_COLOR[this.severity()]} ${this.classStyling()}`);

  private translateService = inject(TranslateService);
  private langChange = toSignal(this.translateService.onLangChange, { initialValue: undefined });
}
