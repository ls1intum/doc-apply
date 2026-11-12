import { Component, input } from '@angular/core';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { ApplicationDetailDTOApplicationStateEnum } from 'app/generated/model/application-detail-dto';

import { TagComponent } from '../../shared/components/atoms/tag/tag.component';

@Component({
  selector: 'jhi-application-state-for-applicants',
  imports: [TagComponent],
  templateUrl: './application-state-for-applicants.component.html',
})
export class ApplicationStateForApplicantsComponent {
  readonly AppState = ApplicationDetailDTOApplicationStateEnum;

  state = input.required<ApplicationDetailDTOApplicationStateEnum>();
  recommendationMissing = input<boolean>(false);

  protected readonly faExclamationTriangle = faExclamationTriangle;
}
