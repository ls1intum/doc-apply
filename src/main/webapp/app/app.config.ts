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
import { MissingTranslationHandler, TranslateCompiler, TranslateService, provideTranslateService } from '@ngx-translate/core';
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
import { firstValueFrom } from 'rxjs';

import { DocApplyPreset } from '../content/theming/docapplypreset';

import { I18N_HASH } from './environments/environment';
import { LANGUAGES } from './config/language.constants';
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
 * Picks the language to start in: the browser's, when the app has translations for it.
 *
 * @param translate the translate service, used to read the browser's preference
 * @returns a supported language code
 */
function pickStartupLanguage(translate: TranslateService): string {
  const browserLang = translate.getBrowserLang();
  return browserLang !== undefined && LANGUAGES.includes(browserLang) ? browserLang : LANGUAGES[0];
}

/**
 * Application initializer that enforces strict order:
 * 1) Activate a language
 * 2) Load runtime config
 * 3) Initialize Auth
 *
 * No step may reject. Angular abandons the bootstrap if an initializer does, leaving the static
 * error page from index.html on screen with no way back. Untranslated labels or defaulted config are
 * both recoverable from; a page that never starts is not.
 */
export async function initializeApp(): Promise<void> {
  const api = inject(PublicConfigResourceApi);
  const appConfigService = inject(ApplicationConfigService);
  const siteConfigService = inject(SiteConfigService);
  const authFacade = inject(AuthFacadeService);
  const translate = inject(TranslateService);

  // Before anything else: a toast raised during startup would otherwise ask for a key while no
  // language is loaded, and render as translation-not-found[...] instead of its message.
  try {
    await firstValueFrom(translate.use(pickStartupLanguage(translate)));
  } catch (error) {
    console.error('Failed to load translations; starting with untranslated labels.', error);
  }

  try {
    await initializeAppConfig(api, appConfigService, siteConfigService)();
  } catch (error) {
    console.error('Failed to load the runtime configuration; starting with defaults.', error);
  }
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
