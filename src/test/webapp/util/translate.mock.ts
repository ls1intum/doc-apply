// src/test/webapp/util/translate.mock.ts
import {
  FallbackLangChangeEvent,
  InterpolatableTranslationObject,
  LangChangeEvent,
  TranslateService,
  TranslationChangeEvent,
} from '@ngx-translate/core';
import { type Provider } from '@angular/core';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';

export type TranslateServiceMock = Pick<
  TranslateService,
  | 'instant'
  | 'get'
  | 'getParsedResult'
  | 'stream'
  | 'onTranslationChange'
  | 'onLangChange'
  | 'onDefaultLangChange'
  | 'onFallbackLangChange'
  | 'currentLang'
  | 'getCurrentLang'
  | 'getBrowserCultureLang'
  | 'getBrowserLang'
  | 'use'
  | 'setDefaultLang'
  | 'setFallbackLang'
>;

export function createTranslateServiceMock(): TranslateServiceMock {
  const onTranslationChangeSubject = new Subject<TranslationChangeEvent>();
  const onLangChangeSubject = new Subject<LangChangeEvent>();
  const onFallbackLangChangeSubject = new Subject<FallbackLangChangeEvent>();

  const emptyTranslations: InterpolatableTranslationObject = {};

  const mock = {
    instant: vi.fn((key: string | string[]) => (Array.isArray(key) ? key.map(k => String(k)) : String(key))),
    get: vi.fn((key: string | string[]) => of(Array.isArray(key) ? key.map(k => String(k)) : String(key))),
    getParsedResult: vi.fn((key: string | string[], interpolateParams?: object) =>
      Array.isArray(key) ? key.map(k => String(k)) : String(key),
    ),
    stream: vi.fn((key: string | string[]) => of(Array.isArray(key) ? key.map(k => String(k)) : String(key))),
    onTranslationChange: onTranslationChangeSubject.asObservable(),
    onLangChange: onLangChangeSubject.asObservable(),
    onDefaultLangChange: onFallbackLangChangeSubject.asObservable(), // Deprecated, aliased to onFallbackLangChange
    onFallbackLangChange: onFallbackLangChangeSubject.asObservable(),
    currentLang: 'en',
    getCurrentLang: vi.fn(() => mock.currentLang),
    use: vi.fn((_lang: string) => {
      mock.currentLang = _lang;
      onLangChangeSubject.next({ lang: _lang, translations: emptyTranslations });
      return of(emptyTranslations);
    }),
    setDefaultLang: vi.fn((_lang: string) => {
      onFallbackLangChangeSubject.next({ lang: _lang, translations: emptyTranslations });
      return of(emptyTranslations);
    }),
    setFallbackLang: vi.fn((_lang: string) => {
      onFallbackLangChangeSubject.next({ lang: _lang, translations: emptyTranslations });
      return of(emptyTranslations);
    }),
    getBrowserCultureLang: vi.fn(() => 'en'),
    getBrowserLang: vi.fn(() => 'en'),
  };

  return mock;
}

export function provideTranslateMock(mock: ReturnType<typeof createTranslateServiceMock> = createTranslateServiceMock()): Provider {
  return { provide: TranslateService, useValue: mock };
}
