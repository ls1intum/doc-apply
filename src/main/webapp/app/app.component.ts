import { Component, inject } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import dayjs from 'dayjs/esm';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { NgbDatepickerConfig } from '@ng-bootstrap/ng-bootstrap';
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
  private readonly dpConfig = inject(NgbDatepickerConfig);

  constructor() {
    registerLocaleData(locale);
    this.iconLibrary.addIcons(...fontAwesomeIcons, ...Object.values(docApplyIconPack));
    this.dpConfig.minDate = { year: dayjs().subtract(100, 'year').year(), month: 1, day: 1 };
  }
}
