import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TooltipModule } from 'primeng/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import LocalizedDatePipe from 'app/shared/pipes/localized-date.pipe';
import { TranslateDirective } from 'app/shared/language';
import { UserAvatarComponent } from 'app/shared/components/atoms/user-avatar/user-avatar.component';
import { TagComponent } from 'app/shared/components/atoms/tag/tag.component';
import { JobCardDTOApplicationStateEnum, JobCardDTOSubjectAreaEnum } from 'app/generated/model/job-card-dto';

import * as DropDownOptions from '../../dropdown-options';
export type ApplicationStatusExtended = JobCardDTOApplicationStateEnum | 'NOT_YET_APPLIED';

export const ApplicationStatusExtended = {
  NotYetApplied: 'NOT_YET_APPLIED' as ApplicationStatusExtended,
};

@Component({
  selector: 'jhi-job-card',
  templateUrl: './job-card.component.html',
  imports: [
    FontAwesomeModule,
    CardModule,
    TooltipModule,
    TranslateModule,
    TranslateDirective,
    LocalizedDatePipe,
    UserAvatarComponent,
    TagComponent,
    RouterLink,
  ],
})
export class JobCardComponent {
  jobId = input<string>('');
  jobTitle = input<string>('');
  subjectArea = input<JobCardDTOSubjectAreaEnum>();
  researchArea = input<string>('');
  location = input<string>('');
  professor = input<string>('');
  avatarUrl = input<string | undefined>(undefined);
  workload = input<number | undefined>(undefined);
  startDate = input<string | undefined>('');
  relativeTime = input<string>('');
  applicationId = input<string | undefined>(undefined);
  contractDuration = input<number | undefined>(undefined);

  applicationState = input<ApplicationStatusExtended>(ApplicationStatusExtended.NotYetApplied);

  // Optional header background image
  headerImageUrl = input<string | undefined>(undefined);
  // TO-DO: Replace value of icon with an icon corresponding to the field of study
  icon = input<string>('flask-vial');
  ref: DynamicDialogRef | undefined;
  readonly dropDownOptions = DropDownOptions;
  translate = inject(TranslateService);

  currentLang = toSignal(this.translate.onLangChange);

  readonly detailLink = computed(() => `/job/detail/${this.jobId()}`);

  readonly formattedWorkload = computed(() => {
    const workloadValue = this.workload();
    if (workloadValue === undefined) {
      return undefined;
    }
    void this.currentLang();
    if (workloadValue === 40) {
      return this.translate.instant('jobDetailPage.workload.fullTime');
    }
    const percentage = Math.round((workloadValue / 40) * 100);
    return this.translate.instant('jobDetailPage.workload.partTime', { percentage });
  });

  readonly formattedContractDuration = computed(() => {
    const duration = this.contractDuration();
    if (duration === undefined) {
      return undefined;
    }
    return duration;
  });

  /**
   * True when the applicant has already submitted an application for this job.
   * Drafts (`SAVED`) are excluded so the user can still come back to a draft.
   */
  readonly hasApplied = computed(() => {
    const state = this.applicationState();
    return state !== ApplicationStatusExtended.NotYetApplied && state !== JobCardDTOApplicationStateEnum.Saved;
  });
}
