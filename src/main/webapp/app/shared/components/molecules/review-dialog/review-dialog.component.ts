import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateService } from '@ngx-translate/core';
import { RejectDTOReasonEnum } from 'app/generated/model/reject-dto';

import { SelectComponent, SelectOption } from '../../atoms/select/select.component';
import { ButtonComponent } from '../../atoms/button/button.component';
import TranslateDirective from '../../../language/translate.directive';
import { ApplicationEvaluationDetailDTO } from '../../../../generated/model/application-evaluation-detail-dto';
import { AcceptDTO } from '../../../../generated/model/accept-dto';
import { RejectDTO } from '../../../../generated/model/reject-dto';
import { UserAvatarComponent } from '../../atoms/user-avatar/user-avatar.component';

type ReasonEnum = RejectDTOReasonEnum;

@Component({
  selector: 'jhi-review-dialog',
  imports: [
    CheckboxModule,
    DialogModule,
    FormsModule,
    FontAwesomeModule,
    ReactiveFormsModule,
    SelectComponent,
    NgTemplateOutlet,
    ButtonComponent,
    TranslateDirective,
    UserAvatarComponent,
  ],
  templateUrl: './review-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
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

  canAccept = computed(() => {
    // 7 chars are an empty HTML tag (e.g. '<p></p>)
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

  // TODO adapt to translation keys when select is adjusted
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
      // TODO: Removed until editor is fixed
      // this.editorModel.set(this.translate.instant('evaluation.defaultAcceptMessage', this.translationMetaData()));

      // TODO: Remove this when editor is fixed
      // Always use english for the message
      const value = this.translate.instant('evaluation.defaultAcceptMessage', this.translationMetaData());
      this.editorModel.set(value);
    }
  });

  resetDialogState(): void {
    this.notifyApplicant.set(true);
    this.closeJob.set(false);
    this.selectedRejectReason.set(undefined);
  }

  onSelectChange(option: SelectOption): void {
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
