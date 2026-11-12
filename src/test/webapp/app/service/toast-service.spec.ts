import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastComponent } from 'app/shared/components/atoms/toast/toast.component';
import { createTranslateServiceMock, provideTranslateMock } from 'util/translate.mock';
import { ToastService } from 'app/service/toast-service';
import { TranslateService } from '@ngx-translate/core';

describe('ToastService', () => {
  let service: ToastService;
  let showSpy: ReturnType<typeof vi.spyOn>;
  let translateMock: ReturnType<typeof createTranslateServiceMock>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ToastService, provideTranslateMock()],
    });

    showSpy = vi.spyOn(ToastComponent.prototype, 'show');
    service = TestBed.inject(ToastService);
    translateMock = TestBed.inject(TranslateService) as ReturnType<typeof createTranslateServiceMock>;

    vi.spyOn(translateMock, 'instant');

    document.body.querySelectorAll('jhi-toast').forEach(el => el.remove());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['showSuccess', 'success'],
    ['showError', 'error'],
    ['showInfo', 'info'],
    ['showWarn', 'warn'],
  ] as const)('should show a toast with %s severity passing summary/detail/life', (method, severity) => {
    service[method]({ summary: 'S', detail: 'D', life: 5000 });
    expect(showSpy).toHaveBeenCalledWith({ severity, summary: 'S', detail: 'D', life: 5000 });
  });

  it.each([
    ['showSuccessKey', 'success', 3000],
    ['showErrorKey', 'error', 6000],
    ['showInfoKey', 'info', 3000],
    ['showWarnKey', 'warn', 5000],
  ] as const)('should translate base key and show %s toast', (method, severity, life) => {
    const params = { name: 'John' };
    service[method]('app.message.x', params);
    expect(showSpy).toHaveBeenCalledWith({
      severity,
      life,
      summary: 'app.message.x.summary',
      detail: 'app.message.x.detail',
    });
    expect(translateMock.instant).toHaveBeenCalledWith('app.message.x.summary', params);
    expect(translateMock.instant).toHaveBeenCalledWith('app.message.x.detail', params);
  });

  it('should give errors a longer default life so users can read them', () => {
    service.showError({ summary: 'Boom' });
    expect(showSpy).toHaveBeenCalledWith({ severity: 'error', life: 6000, summary: 'Boom' });
  });

  it('should respect an explicit life override on the message', () => {
    service.showError({ summary: 'Boom', life: 1000 });
    expect(showSpy).toHaveBeenCalledWith({ severity: 'error', life: 1000, summary: 'Boom' });
  });

  it('should handle multiple toast messages in sequence', () => {
    service.showSuccess({ summary: 'First' });
    service.showError({ summary: 'Second' });
    service.showInfo({ summary: 'Third' });

    expect(showSpy).toHaveBeenCalledTimes(3);
    expect(showSpy).toHaveBeenNthCalledWith(1, { severity: 'success', life: 3000, summary: 'First' });
    expect(showSpy).toHaveBeenNthCalledWith(2, { severity: 'error', life: 6000, summary: 'Second' });
    expect(showSpy).toHaveBeenNthCalledWith(3, { severity: 'info', life: 3000, summary: 'Third' });
  });
});
