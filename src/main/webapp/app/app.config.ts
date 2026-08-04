import {
  ApplicationConfig,
  LOCALE_ID,
  importProvidersFrom,
  inject,
  provideAppInitializer,
  provideZonelessChangeDetection,
} from '@angular/core';
import { BrowserModule, Title } from '@angular/platform-browser';
import { RouterModule, TitleStrategy, provideRouter, withRouterConfig } from '@angular/router';
import { ServiceWorkerModule } from '@angular/service-worker';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { NgbDateAdapter } from '@ng-bootstrap/ng-bootstrap';
import './config/dayjs';
import { MissingTranslationHandler, TranslateCompiler, provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { DatePipe } from '@angular/common';
import { provideAnimations } from '@angular/platform-browser/animations';
import { providePrimeNG } from 'primeng/config';
import { DialogService } from 'primeng/dynamicdialog';
import { MessageService } from 'primeng/api';
import { PublicConfigResourceApi } from 'app/generated/api/public-config-resource-api';
import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { SiteConfigService } from 'app/core/config/site-config.service';
import { initializeAppConfig } from 'app/core/config/runtime-config.loader';

import { DocApplyPreset } from '../content/theming/docapplypreset';

import { I18N_HASH } from './environments/environment';
import { httpInterceptors } from './core/interceptor';
import routes from './app.routes';
import { NgbDateDayjsAdapter } from './config/datepicker-adapter';
import { AppPageTitleStrategy } from './app-page-title-strategy';
import { missingTranslationHandler } from './config/translation.config';
import { AuthFacadeService } from './core/auth/auth-facade.service';
import { IcuTranslateCompiler } from './shared/language/icu-translate-compiler';
import { PrimengTranslationService } from './shared/language/primeng-translation.service';
import { SiteNameTranslationSync } from './shared/language/site-name-translation-sync.service';

/**
 * Application initializer that enforces strict order:
 * 1) Load runtime config
 * 2) Initialize Auth
 */
export async function initializeApp(): Promise<void> {
  const api = inject(PublicConfigResourceApi);
  const appConfigService = inject(ApplicationConfigService);
  const siteConfigService = inject(SiteConfigService);
  const authFacade = inject(AuthFacadeService);

  await initializeAppConfig(api, appConfigService, siteConfigService)();
  await authFacade.initAuth();
}

export function initializePrimeNgI18n(): void {
  inject(PrimengTranslationService);
}

export function initializeSiteNameSync(): void {
  inject(SiteNameTranslationSync);
}

export const appConfig: ApplicationConfig = {
  providers: [
    MessageService,
    provideAppInitializer(initializeApp),
    provideAppInitializer(initializePrimeNgI18n),
    provideAppInitializer(initializeSiteNameSync),
    provideZonelessChangeDetection(),
    provideRouter(routes, withRouterConfig({ onSameUrlNavigation: 'reload' })),
    // PrimeNG still drives its overlay and dialog animations through this provider, so it cannot be
    // dropped for animate.enter/animate.leave until PrimeNG stops depending on it.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    provideAnimations(),
    providePrimeNG({
      theme: {
        preset: DocApplyPreset,
        options: {
          darkModeSelector: '.docapply-dark-mode',
          cssLayer: { name: 'primeng', order: 'theme, base, primeng' },
        },
      },
    }),
    importProvidersFrom(BrowserModule),
    // Set this to true to enable service worker (PWA)
    importProvidersFrom(ServiceWorkerModule.register('ngsw-worker.js', { enabled: false })),
    importProvidersFrom(RouterModule, ScrollingModule),
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: '/i18n/',
        suffix: `.json?_=${I18N_HASH}`,
      }),
      missingTranslationHandler: {
        provide: MissingTranslationHandler,
        useFactory: missingTranslationHandler,
      },
    }),
    {
      provide: TranslateCompiler,
      useClass: IcuTranslateCompiler,
    },
    provideHttpClient(withInterceptors(httpInterceptors), withFetch()),
    Title,
    { provide: LOCALE_ID, useValue: 'en' },
    { provide: NgbDateAdapter, useClass: NgbDateDayjsAdapter },
    { provide: TitleStrategy, useClass: AppPageTitleStrategy },
    DatePipe,
    DialogService,
  ],
};
