import { TestBed } from '@angular/core/testing';
import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import * as ngCommon from '@angular/common';
import enLocale from '@angular/common/locales/en';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';

vi.mock('@angular/common', async importOriginal => {
  const actual = await importOriginal<typeof import('@angular/common')>();
  return Object.assign({}, actual, { registerLocaleData: vi.fn() });
});

vi.mock('app/layouts/main/main.component', () => {
  @Component({ selector: 'jhi-main', standalone: true, template: '' })
  class StubMainComponent {}
  return { default: StubMainComponent };
});

type AppComponentType = (typeof import('app/app.component'))['default'];
let AppComponentDef!: AppComponentType;

describe('AppComponent (standalone)', () => {
  beforeEach(async () => {
    ({ default: AppComponentDef } = await import('app/app.component'));
    await TestBed.configureTestingModule({
      imports: [AppComponentDef],
      providers: [provideRouter([]), provideFontAwesomeTesting()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  it('should register the English locale data on creation', () => {
    const appFixture = TestBed.createComponent(AppComponentDef);

    expect(appFixture.componentInstance).toBeTruthy();

    const registerLocaleDataMock = vi.mocked(ngCommon.registerLocaleData);
    expect(registerLocaleDataMock).toHaveBeenCalledWith(enLocale);
  });
});
