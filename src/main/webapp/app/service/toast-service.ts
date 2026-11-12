import { ApplicationRef, ComponentRef, EnvironmentInjector, Injectable, createComponent, inject } from '@angular/core';
import { ToastComponent } from 'app/shared/components/atoms/toast/toast.component';
import { TranslateService } from '@ngx-translate/core';

type ToastSeverity = 'success' | 'info' | 'warn' | 'error';
export type ToastMessageInput = {
  summary?: string;
  detail?: string;
  life?: number;
};

const DEFAULT_LIFE_BY_SEVERITY: Record<ToastSeverity, number> = {
  success: 3000,
  info: 3000,
  warn: 5000,
  error: 6000,
};

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private appRef = inject(ApplicationRef);
  private injector = inject(EnvironmentInjector);
  private translate = inject(TranslateService);
  private toastComponent: ComponentRef<ToastComponent> | undefined = undefined;

  constructor() {
    this.createGlobalToast();
  }

  showSuccess(message: ToastMessageInput): void {
    this.show(message, 'success');
  }

  showError(message: ToastMessageInput): void {
    this.show(message, 'error');
  }

  showInfo(message: ToastMessageInput): void {
    this.show(message, 'info');
  }

  showWarn(message: ToastMessageInput): void {
    this.show(message, 'warn');
  }

  /** Key-based toast helpers for application messages (expects base key with .summary/.detail present) */
  showSuccessKey(baseKey: string, params?: Record<string, string>): void {
    this.showByBaseKey(baseKey, 'success', params);
  }
  showErrorKey(baseKey: string, params?: Record<string, string>): void {
    this.showByBaseKey(baseKey, 'error', params);
  }
  showInfoKey(baseKey: string, params?: Record<string, string>): void {
    this.showByBaseKey(baseKey, 'info', params);
  }
  showWarnKey(baseKey: string, params?: Record<string, string>): void {
    this.showByBaseKey(baseKey, 'warn', params);
  }

  private showByBaseKey(baseKey: string, severity: ToastSeverity, params?: Record<string, string>): void {
    const summary = this.translateKey(`${baseKey}.summary`, params);
    const detail = this.translateKey(`${baseKey}.detail`, params);
    this.show({ summary, detail }, severity);
  }

  private translateKey(key: string, params?: Record<string, string | number>): string {
    return this.translate.instant(key, params);
  }

  private show(message: ToastMessageInput, severity: ToastSeverity): void {
    this.toastComponent?.instance.show({
      severity,
      summary: message.summary,
      detail: message.detail,
      life: message.life ?? DEFAULT_LIFE_BY_SEVERITY[severity],
    });
  }

  private createGlobalToast(): void {
    if (!this.toastComponent) {
      this.toastComponent = createComponent(ToastComponent, {
        environmentInjector: this.injector,
      });

      document.body.appendChild(this.toastComponent.location.nativeElement);
      this.appRef.attachView(this.toastComponent.hostView);
    }
  }
}
