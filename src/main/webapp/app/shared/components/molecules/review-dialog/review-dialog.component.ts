import { Component, ViewEncapsulation, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faBriefcase, faCircleCheck, faCircleXmark } from '@fortawesome/free-solid-svg-icons';
import { TranslateService } from '@ngx-translate/core';
import { RejectDTOReasonEnum } from 'app/generated/model/reject-dto';

import { SelectComponent, SelectOption } from '../../atoms/select/select.component';
import { ButtonComponent } from '../../atoms/button/button.component';
import { DialogComponent } from '../../atoms/dialog/dialog.component';
import { OptionRowComponent } from '../option-row/option-row.component';
import { ApplicationEvaluationDetailDTO } from '../../../../generated/model/application-evaluation-detail-dto';
import { AcceptDTO } from '../../../../generated/model/accept-dto';
import { RejectDTO } from '../../../../generated/model/reject-dto';

type ReasonEnum = RejectDTOReasonEnum;

@Component({
  selector: 'jhi-review-dialog',
  imports: [DialogComponent, OptionRowComponent, FontAwesomeModule, SelectComponent, ButtonComponent],
  templateUrl: './review-dialog.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class ReviewDialogComponent {
  translate = inject(TranslateService);

  mode = input.required<'ACCEPT' | 'REJECT'>();
  visible = model<boolean>(false);

  application = input<ApplicationEvaluationDetailDTO | undefined>(undefined);

  notifyApplicant = model<boolean>(true);
  closeJob = model<boolean>(false);

  editorModel = signal<string>('');

  selectedRejectReason = signal<SelectOption | undefined>(undefined);

  accept = output<AcceptDTO>();
  reject = output<RejectDTO>();

  readonly faBriefcase = faBriefcase;

  applicantName = computed(() => this.application()?.applicationDetailDTO.applicant?.user.name ?? '');
  jobTitle = computed(() => this.application()?.applicationDetailDTO.jobTitle ?? '');
  headerIcon = computed(() => (this.mode() === 'ACCEPT' ? faCircleCheck : faCircleXmark));
  headerIconClass = computed(() => {
    const tint = this.mode() === 'ACCEPT' ? 'bg-positive-default/15 text-positive-default' : 'bg-negative-default/15 text-negative-default';
    return `flex h-16 w-16 shrink-0 items-center justify-center rounded-lg ${tint}`;
  });

  /** Whether the acceptance can be sent: a notification needs a message longer than an empty HTML tag such as `<p></p>`. */
  canAccept = computed(() => {
    return (this.notifyApplicant() && this.editorModel().length > 7) || !this.notifyApplicant();
  });

  canReject = computed(() => {
    return this.selectedRejectReason() !== undefined;
  });

  translationMetaData = computed(() => {
    const application = this.application();

    if (application) {
      return {
        APPLICANT_FIRST_NAME: application.applicationDetailDTO.applicant?.user.name ?? '',
        PROFESSOR_EMAIL: application.professor?.email,
        JOB_NAME: application.applicationDetailDTO.jobTitle,
        PROFESSOR_FIRST_NAME: application.professor?.firstName,
        PROFESSOR_LAST_NAME: application.professor?.lastName,
        RESEARCH_GROUP_NAME: application.professor?.researchGroupName,
        RESEARCH_GROUP_WEBSITE: application.professor?.researchGroupWebsite,
      };
    }
    return undefined;
  });

  rejectReasons: SelectOption[] = [
    {
      name: 'evaluation.rejectReasons.jobFilled',
      value: RejectDTOReasonEnum.JobFilled,
    },
    {
      name: 'evaluation.rejectReasons.jobOutdated',
      value: RejectDTOReasonEnum.JobOutdated,
    },
    {
      name: 'evaluation.rejectReasons.failedRequirements',
      value: RejectDTOReasonEnum.FailedRequirements,
    },
    {
      name: 'evaluation.rejectReasons.otherReason',
      value: RejectDTOReasonEnum.OtherReason,
    },
  ];

  _defaultTextEffect = effect(() => {
    if (this.visible()) {
      this.resetDialogState();
      const value = this.translate.instant('evaluation.defaultAcceptMessage', this.translationMetaData());
      this.editorModel.set(value);
    }
  });

  resetDialogState(): void {
    this.notifyApplicant.set(true);
    this.closeJob.set(false);
    this.selectedRejectReason.set(undefined);
  }

  onSelectChange(option: SelectOption | undefined): void {
    this.selectedRejectReason.set(option);
  }

  onAccept(): void {
    this.accept.emit({
      message: this.editorModel(),
      notifyApplicant: this.notifyApplicant(),
      closeJob: this.closeJob(),
    });
  }

  onReject(): void {
    const reason = this.selectedRejectReason();
    if (!reason) {
      return;
    }

    this.reject.emit({
      reason: this.getRejectReason(reason),
      notifyApplicant: this.notifyApplicant(),
    });
  }

  getRejectReason(option: SelectOption): ReasonEnum {
    return option.value as ReasonEnum;
  }
}
