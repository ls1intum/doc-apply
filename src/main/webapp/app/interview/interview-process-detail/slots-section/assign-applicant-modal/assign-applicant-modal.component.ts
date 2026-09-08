import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { InterviewResourceApi } from 'app/generated/api/interview-resource-api';
import { InterviewSlotDTO } from 'app/generated/model/interview-slot-dto';
import { IntervieweeDTO } from 'app/generated/model/interviewee-dto';
import { IntervieweeDTOStateEnum } from 'app/generated/model/interviewee-dto';
import { ToastService } from 'app/service/toast-service';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { DialogComponent } from 'app/shared/components/atoms/dialog/dialog.component';
import TranslateDirective from 'app/shared/language/translate.directive';
import { formatDateWithWeekday, formatTime, getLocale } from 'app/shared/util/date-time.util';
import { isVirtualLocation } from 'app/shared/util/location.util';
import { CheckboxComponent } from 'app/shared/components/atoms/checkbox/checkbox.component';
import { DynamicTableComponent } from 'app/shared/components/organisms/dynamic-table/dynamic-table.component';
import { UserAvatarComponent } from 'app/shared/components/atoms/user-avatar/user-avatar.component';
import { ClickableDirective } from 'app/shared/directives/clickable.directive';

// Modal component for assigning an applicant to an interview slot.
// Displays available interviewees and allows single selection for slot assignment.
@Component({
  selector: 'jhi-assign-applicant-modal',
  standalone: true,
  imports: [
    TranslateModule,
    TranslateDirective,
    FormsModule,
    DialogComponent,
    ButtonComponent,
    FontAwesomeModule,
    CheckboxComponent,
    DynamicTableComponent,
    UserAvatarComponent,
    ClickableDirective,
  ],
  templateUrl: './assign-applicant-modal.component.html',
})
export class AssignApplicantModalComponent {
  // Inputs
  visible = input.required<boolean>();
  slot = input.required<InterviewSlotDTO>();
  processId = input.required<string>();
  refreshKey = input<number>(0);

  // Outputs
  visibleChange = output<boolean>();
  applicantAssigned = output<InterviewSlotDTO | undefined>();

  // Signals
  interviewees = signal<IntervieweeDTO[]>([]);
  selectedApplicantId = signal<string | null>(null);

  // Filters out already scheduled and completed interviewees (UNCONTACTED + INVITED are assignable)
  availableInterviewees = computed(() =>
    this.interviewees().filter(i => i.state !== IntervieweeDTOStateEnum.Scheduled && i.state !== IntervieweeDTOStateEnum.Completed),
  );

  // Returns true if an applicant is selected
  canAssign = computed(() => this.selectedApplicantId() !== null);

  // Computed state for template conditional rendering
  readonly intervieweeState = computed(() => {
    if (this.interviewees().length === 0) return 'empty';
    if (this.availableInterviewees().length === 0) return 'allAssigned';
    return 'selectable';
  });

  // Computed values for slot display
  slotDate = computed(() => formatDateWithWeekday(this.slot().startDateTime, this.locale()));
  slotStartTime = computed(() => formatTime(this.slot().startDateTime, this.locale()));
  slotEndTime = computed(() => formatTime(this.slot().endDateTime, this.locale()));
  isVirtual = computed(() => isVirtualLocation(this.slot().location));

  // Computed
  private locale = computed(() => getLocale(this.translateService));

  // Services
  private readonly interviewApi = inject(InterviewResourceApi);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  // Effects
  // Fetches interviewees when modal becomes visible or refreshKey changes
  private readonly loadEffect = effect(() => {
    this.refreshKey(); // Track refreshKey to trigger reload
    if (this.visible()) {
      void this.fetchInterviewees();
    }
  });

  // Assigns the selected applicant to the interview slot.
  // Shows success toast on completion, handles 409 (conflict), 400 (bad request),
  // and other errors with appropriate messages.
  async assignApplicant(): Promise<void> {
    const applicationId = this.selectedApplicantId();
    const slotId = this.slot().id;

    if (applicationId === null || slotId === undefined) {
      return;
    }

    try {
      const updatedSlot = await firstValueFrom(this.interviewApi.assignSlotToInterviewee(slotId, { applicationId }));
      this.toastService.showSuccessKey('interview.assign.success');
      this.applicantAssigned.emit(updatedSlot);
      this.closeModal();
    } catch (error: unknown) {
      const httpError = error as { status?: number };
      switch (httpError.status) {
        case 409:
          this.toastService.showErrorKey('interview.assign.error.alreadyBooked');
          this.applicantAssigned.emit(undefined);
          this.closeModal();
          break;
        case 400:
          this.toastService.showErrorKey('interview.assign.error.notInProcess');
          break;
        case 403:
        case 404:
          this.toastService.showErrorKey('interview.assign.error.failed');
          this.applicantAssigned.emit(undefined);
          this.closeModal();
          break;
        default:
          this.toastService.showErrorKey('interview.assign.error.failed');
          break;
      }
    }
  }

  // Toggles selection of an interviewee.
  // Clicking the same applicant again deselects them.
  selectApplicant(interviewee: IntervieweeDTO): void {
    if (this.isDisabled(interviewee)) {
      return;
    }
    const applicationId = interviewee.applicationId ?? null;
    if (this.selectedApplicantId() === applicationId) {
      this.selectedApplicantId.set(null);
    } else {
      this.selectedApplicantId.set(applicationId);
    }
  }

  // Returns true if the interviewee is currently selected
  isSelected(interviewee: IntervieweeDTO): boolean {
    return this.selectedApplicantId() === interviewee.applicationId;
  }

  // Returns true if the interviewee already has a scheduled slot
  isDisabled(interviewee: IntervieweeDTO): boolean {
    return interviewee.state === IntervieweeDTOStateEnum.Scheduled;
  }

  // Handles visibility changes from the dialog component
  onVisibleChange(isVisible: boolean): void {
    if (!isVisible) {
      this.resetState();
    }
    this.visibleChange.emit(isVisible);
  }

  // Closes the modal and resets state
  closeModal(): void {
    this.onVisibleChange(false);
  }

  // Fetches all interviewees for the current interview process
  private async fetchInterviewees(): Promise<void> {
    try {
      const processId = this.processId();
      const data = await firstValueFrom(this.interviewApi.getIntervieweesByProcessId(processId));
      this.interviewees.set(data);
    } catch {
      this.toastService.showErrorKey('interview.assign.error.loadFailed');
    }
  }

  // Clears selection and interviewees list
  private resetState(): void {
    this.selectedApplicantId.set(null);
    this.interviewees.set([]);
  }
}
