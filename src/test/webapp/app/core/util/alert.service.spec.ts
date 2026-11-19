import { TestBed, inject } from '@angular/core/testing';
import { vi } from 'vitest';
import { translationNotFoundMessage } from 'app/config/translation.config';
import { Alert, AlertService } from 'app/core/util/alert.service';
import { createTranslateServiceMock, provideTranslateMock } from 'util/translate.mock';

const TRANSLATIONS: Record<string, string> = { 'hello.jhipster': 'Translated message' };

describe('AlertService', () => {
  let extAlerts: Alert[];

  beforeEach(() => {
    const translateServiceMock = createTranslateServiceMock();
    translateServiceMock.instant.mockImplementation((key: string) => TRANSLATIONS[key] ?? `${translationNotFoundMessage}[${key}]`);
    TestBed.configureTestingModule({
      providers: [provideTranslateMock(translateServiceMock)],
    });
    vi.useFakeTimers();
    extAlerts = [];
  });

  it('should add alert to internal array and assign sequential ids', inject([AlertService], (service: AlertService) => {
    const a1 = service.addAlert({ type: 'success', message: 'Hello' });
    const a2 = service.addAlert({ type: 'info', message: 'Hi' });

    expect(a1.id).toBe(0);
    expect(a2.id).toBe(1);
    expect(service.get().length).toBe(2);
  }));

  it('should produce alert with all custom fields', inject([AlertService], (service: AlertService) => {
    expect(service.addAlert({ type: 'success', message: 'Hello', timeout: 3000, toast: true, position: 'top left' })).toEqual(
      expect.objectContaining({
        type: 'success',
        message: 'Hello',
        id: 0,
        timeout: 3000,
        toast: true,
        position: 'top left',
      } as Alert),
    );
  }));

  it('should add alert to external array when provided', inject([AlertService], (service: AlertService) => {
    service.addAlert({ type: 'success', message: 'Hello' }, extAlerts);

    expect(extAlerts.length).toBe(1);
    expect(service.get().length).toBe(0);
  }));

  it('should close alerts via close handler', inject([AlertService], (service: AlertService) => {
    const alert0 = service.addAlert({ type: 'info', message: 'a' });
    const alert1 = service.addAlert({ type: 'info', message: 'b' });
    expect(service.get().length).toBe(2);

    alert1.close?.(service.get());
    expect(service.get().length).toBe(1);
    alert0.close?.(service.get());
    expect(service.get().length).toBe(0);
  }));

  it('should auto-close alert after default timeout', inject([AlertService], (service: AlertService) => {
    service.addAlert({ type: 'info', message: 'Hello' });
    expect(service.get().length).toBe(1);

    vi.advanceTimersByTime(6000);

    expect(service.get().length).toBe(0);
  }));

  it('should clear all alerts', inject([AlertService], (service: AlertService) => {
    service.addAlert({ type: 'info', message: 'a' });
    service.addAlert({ type: 'danger', message: 'b' });
    expect(service.get().length).toBe(2);
    service.clear();
    expect(service.get().length).toBe(0);
  }));

  it('should translate via translationKey when key exists', inject([AlertService], (service: AlertService) => {
    expect(service.addAlert({ type: 'info', message: 'Hello', translationKey: 'hello.jhipster' })).toEqual(
      expect.objectContaining({ message: 'Translated message' } as Alert),
    );
  }));

  it('should fall back to provided message when translation key missing', inject([AlertService], (service: AlertService) => {
    expect(service.addAlert({ type: 'info', message: 'Hello', translationKey: 'hello.missing' })).toEqual(
      expect.objectContaining({ message: 'Hello' } as Alert),
    );
  }));

  it('should fall back to translationKey when neither translation nor message provided', inject([AlertService], (service: AlertService) => {
    expect(service.addAlert({ type: 'info', translationKey: 'hello.missing' })).toEqual(
      expect.objectContaining({ message: 'hello.missing' } as Alert),
    );
  }));
});
