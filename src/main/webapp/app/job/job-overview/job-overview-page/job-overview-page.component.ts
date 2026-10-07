import { ChangeDetectionStrategy, Component } from '@angular/core';

import { JobCardListComponent } from '../job-card-list/job-card-list.component';
import TranslateDirective from '../../../shared/language/translate.directive';

@Component({
  selector: 'jhi-job-overview-page',
  standalone: true,
  imports: [JobCardListComponent, TranslateDirective],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './job-overview-page.component.html',
})
export class JobOverviewPageComponent {}
