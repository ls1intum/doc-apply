import { NgComponentOutlet } from '@angular/common';
import { Component, ElementRef, InjectionToken, Injector, Type, afterNextRender, computed, inject, viewChild } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

import type { DialogOptions } from './dialog.service';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** What the dialog frame renders and how it closes. */
export interface DialogShellConfig {
  component: Type<unknown>;
  contentInjector: Injector;
  options: DialogOptions;
  titleId: string;
  close: () => void;
}

export const DIALOG_SHELL_CONFIG = new InjectionToken<DialogShellConfig>('DIALOG_SHELL_CONFIG');

const PANEL_SURFACE_CLASSES = 'overflow-hidden rounded-xl border border-border-default bg-background-default shadow-xl';

/**
 * The frame of a dialog opened through the dialog service: panel, title, close button and the requested component.
 * It matches the look of the kit dialog but takes the panel and content classes the service's options allow.
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
  protected readonly panelClass = this.buildPanelClass();
  protected readonly contentClass = this.buildContentClass();
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

  /**
   * Builds the panel classes: the card surface unless the dialog is bare, the maximum width and the caller's classes.
   *
   * @returns the classes of the dialog panel
   */
  private buildPanelClass(): string {
    const options = this.config.options;
    const surface = options.bare === true ? 'overflow-auto' : PANEL_SURFACE_CLASSES;
    return `${options.maxWidthClass ?? 'max-w-[90dvw]'} ${surface} ${options.styleClass ?? ''}`;
  }

  /**
   * Builds the content padding; a bare dialog leaves the padding to its content.
   *
   * @returns the classes of the content area
   */
  private buildContentClass(): string {
    if (this.config.options.bare === true) {
      return '';
    }
    return this.showHeader ? 'px-6 pb-6' : 'p-6';
  }
}
