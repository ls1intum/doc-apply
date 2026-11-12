import { hasText } from 'app/shared/util/text.util';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { InterviewSlotDTO } from 'app/generated/model/interview-slot-dto';
import { ProfessorDTO } from 'app/generated/model/professor-dto';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { UserAvatarComponent } from 'app/shared/components/atoms/user-avatar/user-avatar.component';
import TranslateDirective from 'app/shared/language/translate.directive';
import { getLocale } from 'app/shared/util/date-time.util';
import { formatFullName } from 'app/shared/util/name.util';
import { isVirtualLocation } from 'app/shared/util/location.util';

/** Summary panel for interview booking. Displays job info, supervisor, selected slot details and book button. */
@Component({
  selector: 'jhi-booking-summary',
  standalone: true,
  imports: [FontAwesomeModule, TranslateModule, TranslateDirective, ButtonComponent, ConfirmDialog, UserAvatarComponent],
  templateUrl: './booking-summary.component.html',
  host: { class: 'flex flex-col h-full' },
})
export class BookingSummaryComponent {
  // Inputs
  jobTitle = input.required<string>();

  researchGroupName = input<string>();
  supervisor = input<ProfessorDTO>();
  selectedSlot = input<InterviewSlotDTO | null>(null);
  alreadyBooked = input(false);
  bookedDate = input<string>('');
  bookedTime = input<string>('');
  bookedIsVirtual = input(false);
  bookedLocation = input<string | undefined>(undefined);

  // Outputs
  book = output();

  // Signals
  showBookingDialog = signal(false);

  // Computed
  hasSelection = computed(() => this.selectedSlot() !== null);
  supervisorName = computed(() => {
    const s = this.supervisor();
    return s === undefined ? '' : formatFullName(s.firstName, s.lastName);
  });

  /** Formats selected slot date for display. */
  formattedDate = computed(() => {
    const startDateTime = this.selectedSlot()?.startDateTime;
    if (!hasText(startDateTime)) return '';
    return new Date(startDateTime).toLocaleDateString(this.locale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  });

  /** Formats selected slot time range for display. */
  formattedTime = computed(() => {
    const slot = this.selectedSlot();
    const start = slot?.startDateTime;
    const end = slot?.endDateTime;
    if (!hasText(start) || !hasText(end)) return '';
    const loc = this.locale();
    return `${new Date(start).toLocaleTimeString(loc, {
      hour: '2-digit',
      minute: '2-digit',
    })} - ${new Date(end).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}`;
  });

  isVirtual = computed(() => isVirtualLocation(this.selectedSlot()?.location));

  /** Returns date from booked appointment or selected slot. */
  displayDate = computed(() => (this.alreadyBooked() ? this.bookedDate() : this.formattedDate()));
  /** Returns time from booked appointment or selected slot. */
  displayTime = computed(() => (this.alreadyBooked() ? this.bookedTime() : this.formattedTime()));
  displayIsVirtual = computed(() => (this.alreadyBooked() ? this.bookedIsVirtual() : this.isVirtual()));

  /** Returns custom location string if available, null if generic. */
  displayLocation = computed(() => {
    const location = this.alreadyBooked() ? this.bookedLocation() : this.selectedSlot()?.location;
    return hasText(location) && !isVirtualLocation(location) ? location : null;
  });

  /** Returns translation key for virtual/in-person location. */
  displayLocationKey = computed(() => (this.displayIsVirtual() ? 'interview.slots.location.virtual' : 'interview.slots.location.inPerson'));

  // Services
  private readonly translateService = inject(TranslateService);

  // Signals
  private readonly langChange = toSignal(this.translateService.onLangChange);

  // Computed
  private readonly locale = computed(() => {
    this.langChange();
    return getLocale(this.translateService);
  });

  onBook(): void {
    this.showBookingDialog.set(true);
  }
}
