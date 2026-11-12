import { NgComponentOutlet } from '@angular/common';
import { Component, ElementRef, InjectionToken, Injector, Type, afterNextRender, computed, inject, viewChild } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

import type { DialogOptions } from './dialog.service';

/** Matches the controls a reader can tab to, in the order they appear. */
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** What the dialog frame renders and how it closes. */
export interface DialogShellConfig {
  component: Type<unknown>;
  /** Provides the dialog's ref and data to the rendered component. */
  contentInjector: Injector;
  options: DialogOptions;
  titleId: string;
  close: () => void;
}

export const DIALOG_SHELL_CONFIG = new InjectionToken<DialogShellConfig>('DIALOG_SHELL_CONFIG');

/**
 * The frame of a dialog opened through the dialog service: panel, title, close button and the requested component.
 * It matches the look of the kit dialog but takes the panel and content styles the service's options allow.
 */
@Component({
  selector: 'jhi-dialog-shell',
  templateUrl: './dialog-shell.component.html',
  imports: [NgComponentOutlet, FontAwesomeModule],
})
export class DialogShellComponent {
  protected readonly config = inject(DIALOG_SHELL_CONFIG);
  protected readonly showHeader = this.config.options.showHeader ?? true;
  protected readonly closable = this.config.options.closable ?? true;
  protected readonly panelClass = this.config.options.styleClass ?? '';
  protected readonly panelStyle = this.buildPanelStyle();
  protected readonly contentStyle = this.config.options.contentStyle ?? {};
  protected readonly faXmark = faXmark;

  protected readonly closeLabel = computed(() => this.translator.translate('button.close'));

  private readonly translator = injectTranslator();

  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');

  constructor() {
    afterNextRender(() => {
      if (this.config.options.focusOnShow ?? true) {
        this.content().nativeElement.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
      }
    });
  }

  /** Closes the dialog without a result. */
  close(): void {
    this.config.close();
  }

  private buildPanelStyle(): Record<string, string> {
    const style: Record<string, string> = {};
    const width = this.config.options.width;
    if (width !== undefined) {
      style.width = width;
    }
    return Object.assign(style, this.config.options.style);
  }
}
