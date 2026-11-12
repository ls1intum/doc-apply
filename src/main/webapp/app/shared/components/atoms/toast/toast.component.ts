import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
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
  /** How long the toast stays visible, in milliseconds. */
  life: number;
}

interface SeverityAppearance {
  icon: IconDefinition;
  borderClass: string;
  iconClass: string;
}

interface VisibleToast {
  id: number;
  message: ToastMessage;
  appearance: SeverityAppearance;
  /** Errors interrupt screen readers; everything else is announced politely by the stack. */
  role: 'alert' | undefined;
}

const APPEARANCE_BY_SEVERITY: Record<ToastMessage['severity'], SeverityAppearance> = {
  success: { icon: faCircleCheck, borderClass: 'border-positive-default', iconClass: 'text-positive-default' },
  info: { icon: faCircleInfo, borderClass: 'border-info-default', iconClass: 'text-info-default' },
  warn: { icon: faTriangleExclamation, borderClass: 'border-warning-default', iconClass: 'text-warning-default' },
  error: { icon: faCircleXmark, borderClass: 'border-negative-default', iconClass: 'text-negative-default' },
};

/** A stack of toast notifications in the top-right corner, each dismissed after its life or by its close button. */
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

  private nextId = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timers.forEach(timer => clearTimeout(timer)));
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
      setTimeout(() => this.dismiss(id), message.life),
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
