import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  IconDefinition,
  faCircleCheck,
  faCircleInfo,
  faCircleXmark,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

/** A toast notification as the app shows it. */
export interface ToastMessage {
  severity: 'success' | 'info' | 'warn' | 'error';
  summary?: string;
  detail?: string;
  life: number;
}

interface SeverityAppearance {
  icon: IconDefinition;
  panelClass: string;
  accentClass: string;
}

interface VisibleToast {
  id: number;
  message: ToastMessage;
  appearance: SeverityAppearance;
  role: 'alert' | undefined;
}

const APPEARANCE_BY_SEVERITY: Record<ToastMessage['severity'], SeverityAppearance> = {
  success: { icon: faCircleCheck, panelClass: 'border-positive-default/30 bg-positive-default/10', accentClass: 'text-positive-default' },
  info: { icon: faCircleInfo, panelClass: 'border-info-default/30 bg-info-default/10', accentClass: 'text-info-default' },
  warn: { icon: faTriangleExclamation, panelClass: 'border-warning-default/30 bg-warning-default/10', accentClass: 'text-warning-default' },
  error: { icon: faCircleXmark, panelClass: 'border-negative-default/30 bg-negative-default/10', accentClass: 'text-negative-default' },
};

/**
 * A stack of toast notifications in the top-right corner, each dismissed after its life or by its close button. The stack
 * is a popover in the browser's top layer, so it stays above dialogs and overlays without a z-index.
 */
@Component({
  selector: 'jhi-toast',
  imports: [FontAwesomeModule],
  templateUrl: './toast.component.html',
})
export class ToastComponent {
  protected readonly toasts = signal<VisibleToast[]>([]);
  protected readonly faXmark = faXmark;

  protected readonly closeLabel = computed(() => this.translator.translate('button.close'));

  private readonly translator = injectTranslator();

  private readonly stack = viewChild.required<ElementRef<HTMLElement>>('stack');

  private nextId = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor() {
    afterNextRender(() => {
      this.stack().nativeElement.showPopover();
    });
    inject(DestroyRef).onDestroy(() => {
      this.timers.forEach(timer => {
        clearTimeout(timer);
      });
    });
  }

  /**
   * Shows a toast on top of the page.
   *
   * @param message what the toast says and how long it stays
   */
  show(message: ToastMessage): void {
    const id = this.nextId++;
    const toast: VisibleToast = {
      id,
      message,
      appearance: APPEARANCE_BY_SEVERITY[message.severity],
      role: message.severity === 'error' ? 'alert' : undefined,
    };
    this.toasts.update(toasts => toasts.concat(toast));
    this.timers.set(
      id,
      setTimeout(() => {
        this.dismiss(id);
      }, message.life),
    );
  }

  /**
   * Removes a toast before or when its life ends.
   *
   * @param id the toast to remove
   */
  dismiss(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.toasts.update(toasts => toasts.filter(toast => toast.id !== id));
  }
}
