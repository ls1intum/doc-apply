import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { registerLocaleData } from '@angular/common';
import locale from '@angular/common/locales/en';

import { DEBUG_INFO_ENABLED } from './app/app.constants';
import AppComponent from './app/app.component';
import { appConfig } from './app/app.config';
import { JhiLanguageHelper } from './app/config/language.helper';

// disable debug data on prod profile to improve performance
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
if (!DEBUG_INFO_ENABLED) {
  enableProdMode();
}

bootstrapApplication(AppComponent, appConfig)
  .then(app => {
    const translateService = app.injector.get(TranslateService);
    const languageHelper = app.injector.get(JhiLanguageHelper);

    // Perform initialization logic
    registerLocaleData(locale);
    translateService.setFallbackLang('en');
    const languageKey = sessionStorage.getItem('locale') ?? languageHelper.determinePreferredLanguage();
    translateService.use(languageKey);

    /* // Set up global dark mode based on browser settings
             const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
             const updateDarkModeClass = (isDarkMode: boolean): void => {
               const className = 'docapply-dark-mode';
               if (isDarkMode) {
                 document.body.classList.add(className);
               } else {
                 document.body.classList.remove(className);
               }
             };

        // Initialize and listen for changes
        updateDarkModeClass(darkModeMediaQuery.matches);
        darkModeMediaQuery.addEventListener('change', event => {
          updateDarkModeClass(event.matches);
        });*/
  })

  .catch((err: unknown) => console.error(err));
