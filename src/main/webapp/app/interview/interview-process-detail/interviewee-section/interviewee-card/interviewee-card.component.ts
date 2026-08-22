import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { LangChangeEvent, TranslateModule, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';
import { IntervieweeDTO, IntervieweeDTOStateEnum } from 'app/generated/model/interviewee-dto';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { UserAvatarComponent } from 'app/shared/components/atoms/user-avatar/user-avatar.component';
import { ClickableDirective } from 'app/shared/directives/clickable.directive';
import TranslateDirective from 'app/shared/language/translate.directive';
import { formatDate, formatTimeRange, getLocale } from 'app/shared/util/date-time.util';
import { formatFullName } from 'app/shared/util/name.util';

/**
 * Card component displaying an interviewee's status and scheduled slot details.
 * Shows different UI based on state: UNCONTACTED, INVITED, SCHEDULED, COMPLETED.
 */
@Component({
  selector: 'jhi-interviewee-card',
  standalone: true,
  imports: [TranslateModule, TranslateDirective, ButtonComponent, FontAwesomeModule, UserAvatarComponent, ClickableDirective],
  templateUrl: './interviewee-card.component.html',
})
export class IntervieweeCardComponent {
  // Enum exposed for template access
  readonly IntervieweeState = IntervieweeDTOStateEnum;

  // Inputs
  interviewee = input.required<IntervieweeDTO>();
  processId = input.required<string>();
  sending = input<boolean>(false);
  isClosed = input<boolean>(false);
  hasSlots = input<boolean>(false);

  // Outputs
  sendInvitation = output<IntervieweeDTO>();
  cancelInterview = output<IntervieweeDTO>();

  // Computed values
  fullName = computed(() => {
    const user = this.interviewee().user;
    return formatFullName(user?.firstName, user?.lastName);
  });
  avatarUrl = computed(() => this.interviewee().user?.avatar);

  scheduledDate = computed(() => {
    const slot = this.interviewee().scheduledSlot;
    return slot ? formatDate(slot.startDateTime, this.locale()) : '';
  });

  timeRange = computed(() => {
    const slot = this.interviewee().scheduledSlot;
    return slot ? formatTimeRange(slot.startDateTime, slot.endDateTime, this.locale()) : '';
  });

  location = computed(() => this.interviewee().scheduledSlot?.location ?? '');
  isVirtual = computed(() => this.interviewee().scheduledSlot?.location === 'virtual');
  noSlotsTooltip = computed(() => {
    this.currentLang();
    return !this.hasSlots() ? this.translateService.instant('interview.interviewees.invitation.noSlots.detail') : '';
  });

  // Services
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);
  private readonly currentLang = toSignal(this.translateService.onLangChange.pipe(map((event: LangChangeEvent) => event.lang)), {
    initialValue: this.translateService.getCurrentLang(),
  });
  private locale = computed(() => getLocale(this.translateService));

  // Methods
  navigateToAssessment(): void {
    void this.router.navigate(['/interviews', 'process', this.processId(), 'interviewee', this.interviewee().id, 'assessment']);
  }

  onCancelInterview(event: Event): void {
    event.stopPropagation();
    this.cancelInterview.emit(this.interviewee());
  }
}
