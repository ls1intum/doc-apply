import { Component, inject } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import locale from '@angular/common/locales/en';
import { RouterModule } from '@angular/router';

import { fontAwesomeIcons } from './config/font-awesome-icons';
import { docApplyIconPack } from './shared/icons/icons';
import MainComponent from './layouts/main/main.component';

@Component({
  selector: 'jhi-app',
  template: '<jhi-main />',
  imports: [MainComponent, RouterModule],
})
export default class AppComponent {
  private readonly iconLibrary = inject(FaIconLibrary);

  constructor() {
    registerLocaleData(locale);
    this.iconLibrary.addIcons(...fontAwesomeIcons, ...Object.values(docApplyIconPack));
  }
}
