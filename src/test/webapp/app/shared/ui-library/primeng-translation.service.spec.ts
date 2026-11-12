import { TestBed } from '@angular/core/testing';
import { PrimengTranslationService } from 'app/shared/ui-library/primeng-translation.service';
import { TranslateService } from '@ngx-translate/core';
import { PrimeNG } from 'primeng/config';
import { createTranslateServiceMock, provideTranslateMock } from 'util/translate.mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';

describe('PrimengTranslationService', () => {
  let primeNG: PrimeNG;
  let mockTranslate: ReturnType<typeof createTranslateServiceMock>;
  let langChangeSubject: Subject<{ lang: string }>;

  beforeEach(() => {
    langChangeSubject = new Subject<{ lang: string }>();
    mockTranslate = createTranslateServiceMock();
    mockTranslate.getCurrentLang = vi.fn().mockReturnValue('en');

    Object.defineProperty(mockTranslate, 'onLangChange', {
      get: () => langChangeSubject.asObservable(),
      configurable: true,
    });

    TestBed.configureTestingModule({
      providers: [provideTranslateMock(mockTranslate), PrimengTranslationService, PrimeNG],
    });
    TestBed.inject(TranslateService);
    primeNG = TestBed.inject(PrimeNG);

    vi.spyOn(primeNG, 'setTranslation');
  });

  afterEach(() => {
    langChangeSubject.complete();
    vi.clearAllMocks();
  });

  it.each([
    ['en', { today: 'Today', clear: 'Clear', weekHeader: 'Wk' }],
    ['de', { today: 'Heute', clear: 'Zurücksetzen', weekHeader: 'KW' }],
    ['', { today: 'Today', clear: 'Clear' }],
  ])('should apply correct locale strings when current lang is "%s"', (lang, expected) => {
    mockTranslate.getCurrentLang = vi.fn().mockReturnValue(lang);
    TestBed.inject(PrimengTranslationService);

    expect(primeNG.setTranslation).toHaveBeenCalledWith(expect.objectContaining(expected));
  });

  it('should apply full English locale strings (day/month/empty messages)', () => {
    TestBed.inject(PrimengTranslationService);

    expect(primeNG.setTranslation).toHaveBeenCalledWith(
      expect.objectContaining({
        dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        monthNames: expect.arrayContaining(['January', 'December']),
        emptyFilterMessage: 'No results found',
        emptyMessage: 'No available options',
      }),
    );
  });

  it('should apply full German locale strings (day/month/empty messages)', () => {
    mockTranslate.getCurrentLang = vi.fn().mockReturnValue('de');
    TestBed.inject(PrimengTranslationService);

    expect(primeNG.setTranslation).toHaveBeenCalledWith(
      expect.objectContaining({
        dayNames: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
        monthNames: expect.arrayContaining(['Januar', 'Dezember']),
        emptyFilterMessage: 'Keine Ergebnisse gefunden',
        emptyMessage: 'Keine Optionen verfügbar',
      }),
    );
  });

  describe('Language switching', () => {
    beforeEach(() => {
      TestBed.inject(PrimengTranslationService);
    });

    it.each([
      ['de', 'Heute'],
      ['DE', 'Heute'],
      ['dE', 'Heute'],
      ['en', 'Today'],
      ['fr', 'Today'],
    ])('should switch when lang changes to "%s"', (lang, expectedToday) => {
      langChangeSubject.next({ lang });
      expect(primeNG.setTranslation).toHaveBeenCalledWith(expect.objectContaining({ today: expectedToday }));
    });
  });
});
