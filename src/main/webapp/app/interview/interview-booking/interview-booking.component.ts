import { hasText } from 'app/shared/util/text.util';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import dayjs from 'dayjs/esm';
import { InterviewBookingResourceApi } from 'app/generated/api/interview-booking-resource-api';
import { BookingDTO } from 'app/generated/model/booking-dto';
import { InterviewSlotDTO } from 'app/generated/model/interview-slot-dto';
import { ToastService } from 'app/service/toast-service';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import TranslateDirective from 'app/shared/language/translate.directive';
import { formatTimeRange, getLocale } from 'app/shared/util/date-time.util';
import { formatFullName } from 'app/shared/util/name.util';
import { isVirtualLocation } from 'app/shared/util/location.util';
import { DateHeaderComponent } from 'app/interview/interview-process-detail/slots-section/date-header/date-header.component';
import { InfoBoxComponent } from 'app/shared/components/atoms/info-box/info-box.component';

import { SelectableSlotCardComponent } from './selectable-slot-card/selectable-slot-card.component';
import { BookingSummaryComponent } from './booking-summary/booking-summary.component';

/** Interview booking page for applicants. Allows selecting and booking an interview slot. */
@Component({
  selector: 'jhi-interview-booking',
  standalone: true,
  imports: [
    FontAwesomeModule,
    TranslateModule,
    TranslateDirective,
    ButtonComponent,
    SelectableSlotCardComponent,
    BookingSummaryComponent,
    DateHeaderComponent,
    InfoBoxComponent,
  ],
  templateUrl: './interview-booking.component.html',
})
export class InterviewBookingComponent {
  // Constants
  readonly MAX_VISIBLE_SLOTS = 8;

  bookingData = signal<BookingDTO | null>(null);
  loading = signal(true);
  error = signal(false);
  isClosed = signal(false);
  selectedSlot = signal<InterviewSlotDTO | null>(null);
  currentMonthOffset = signal(0);
  currentDatePage = signal(0);
  expandedDates = signal<Set<string>>(new Set());

  // Computed- Date Info
  targetDate = computed(() => dayjs().add(this.currentMonthOffset(), 'month'));
  currentYear = computed(() => this.targetDate().year());
  currentMonthNumber = computed(() => this.targetDate().month() + 1);

  // Computed - Job Info
  jobTitle = computed(() => this.bookingData()?.jobTitle ?? '');
  researchGroupName = computed(() => this.bookingData()?.researchGroupName);
  supervisor = computed(() => this.bookingData()?.supervisor);
  supervisorName = computed(() => {
    const s = this.bookingData()?.supervisor;
    return s === undefined ? '' : formatFullName(s.firstName, s.lastName);
  });

  // Computed - Booking Status
  hasBookedSlot = computed(() => this.bookingData()?.userBookingInfo?.hasBookedSlot ?? false);
  bookedSlot = computed(() => this.bookingData()?.userBookingInfo?.bookedSlot ?? null);

  /** Formats the booked slot date for display. */
  bookedSlotDate = computed(() => {
    const startDateTime = this.bookedSlot()?.startDateTime;
    if (!hasText(startDateTime)) return '';
    return new Date(startDateTime).toLocaleDateString(this.locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  });

  /** Formats the booked slot time range for display. */
  bookedSlotTime = computed(() => {
    const slot = this.bookedSlot();
    const startDateTime = slot?.startDateTime;
    const endDateTime = slot?.endDateTime;
    if (!hasText(startDateTime) || !hasText(endDateTime)) return '';
    return formatTimeRange(startDateTime, endDateTime, this.locale());
  });

  /** Returns location string or translated virtual/in-person label. */
  bookedSlotLocation = computed(() => {
    const slot = this.bookedSlot();
    if (slot === null) return '';
    const location = slot.location;
    if (hasText(location) && !isVirtualLocation(location)) return location;
    return this.translateService.instant(
      isVirtualLocation(location) ? 'interview.slots.location.virtual' : 'interview.slots.location.inPerson',
    );
  });

  isBookedVirtual = computed(() => isVirtualLocation(this.bookedSlot()?.location));

  /** Groups available slots by date and sorts chronologically (slots already filtered by server). */
  groupedSlots = computed(() => {
    const slots = this.bookingData()?.availableSlots;
    if (slots === undefined || slots.length === 0) return [];

    const grouped = new Map<string, InterviewSlotDTO[]>();
    slots.forEach(slot => {
      const localDate = new Date(this.safeDate(slot.startDateTime));
      const dateKey = localDate.toISOString().split('T')[0];
      if (!grouped.has(dateKey)) grouped.set(dateKey, []);
      grouped.get(dateKey)?.push(slot);
    });

    return Array.from(grouped.entries())
      .map(([dateKey, dateSlots]) => ({
        date: dateKey,
        localDate: new Date(dateKey),
        slots: dateSlots.sort((a, b) => this.safeDate(a.startDateTime) - this.safeDate(b.startDateTime)),
      }))
      .sort((a, b) => a.localDate.getTime() - b.localDate.getTime());
  });

  /** Returns all slots for current month (server already filters by month). */
  currentMonthSlots = computed(() => this.groupedSlots());

  /** Returns the current page of date groups for display. */
  paginatedSlots = computed(() => {
    const start = this.currentDatePage() * this.DATES_PER_PAGE;
    return this.currentMonthSlots().slice(start, start + this.DATES_PER_PAGE);
  });

  // Computed - Pagination
  totalDatePages = computed(() => Math.ceil(this.currentMonthSlots().length / this.DATES_PER_PAGE));
  canGoPreviousDate = computed(() => this.currentDatePage() > 0);
  canGoNextDate = computed(() => this.currentDatePage() < this.totalDatePages() - 1);

  currentMonthLabel = computed(() => {
    return this.targetDate().toDate().toLocaleDateString(this.locale(), { month: 'long', year: 'numeric' });
  });

  // Constants
  private readonly DATES_PER_PAGE = 4;
  private readonly initialized = signal(false);

  // Services
  private readonly route = inject(ActivatedRoute);
  private readonly bookingApi = inject(InterviewBookingResourceApi);
  private readonly translateService = inject(TranslateService);
  private readonly toastService = inject(ToastService);

  // Private Signals
  private readonly langChangeSignal = toSignal(this.translateService.onLangChange);
  private readonly currentLangSignal = signal(this.translateService.getBrowserCultureLang() ?? 'en');

  private locale = computed(() => {
    this.currentLangSignal();
    return getLocale(this.translateService);
  });

  // Effects
  private readonly langChangeEffect = effect(() => {
    const langEvent = this.langChangeSignal();
    if (langEvent?.lang !== undefined) {
      this.currentLangSignal.set(langEvent.lang);
    }
  });

  private readonly loadEffect = effect(() => {
    const processId = this.route.snapshot.paramMap.get('processId');
    if (processId !== null && processId !== '') {
      if (!this.initialized()) {
        void this.loadData(processId);
      } else {
        void this.loadData(processId, this.currentYear(), this.currentMonthNumber());
      }
    }
  });

  /** Toggles slot selection. */
  onSlotSelected(slot: InterviewSlotDTO): void {
    this.selectedSlot.set(this.selectedSlot()?.id === slot.id ? null : slot);
  }

  /** Initiates booking for the selected slot. */
  async onBook(): Promise<void> {
    const slot = this.selectedSlot();
    if (slot?.id === undefined) return;

    const processId = this.route.snapshot.paramMap.get('processId');
    if (processId === null) return;

    try {
      await firstValueFrom(this.bookingApi.bookSlot(processId, { slotId: slot.id }));
      this.toastService.showSuccessKey('interview.booking.bookingSuccess');
      this.selectedSlot.set(null);
      // Reload data to show confirmation
      await this.loadData(processId, this.currentYear(), this.currentMonthNumber());
    } catch (error: unknown) {
      if (error !== null && typeof error === 'object' && 'status' in error && error.status === 409) {
        this.toastService.showErrorKey('interview.booking.slotAlreadyBooked');
        // Reload to get updated slot availability
        await this.loadData(processId, this.currentYear(), this.currentMonthNumber());
      } else {
        this.toastService.showErrorKey('interview.booking.bookingError');
      }
    }
  }

  /** Navigates to the previous month and reloads slots. */
  previousMonth(): void {
    this.currentMonthOffset.update(v => v - 1);
    this.currentDatePage.set(0);
    this.expandedDates.set(new Set());
  }

  /** Navigates to the next month and reloads slots. */
  nextMonth(): void {
    this.currentMonthOffset.update(v => v + 1);
    this.currentDatePage.set(0);
    this.expandedDates.set(new Set());
  }

  /** Navigates to the previous date page. */
  previousDatePage(): void {
    if (this.canGoPreviousDate()) this.currentDatePage.update(v => v - 1);
  }

  /** Navigates to the next date page. */
  nextDatePage(): void {
    if (this.canGoNextDate()) this.currentDatePage.update(v => v + 1);
  }

  /** Returns visible slots for a date, respecting expansion state. */
  getVisibleSlots(dateKey: string, allSlots: InterviewSlotDTO[]): InterviewSlotDTO[] {
    return this.expandedDates().has(dateKey) || allSlots.length <= this.MAX_VISIBLE_SLOTS
      ? allSlots
      : allSlots.slice(0, this.MAX_VISIBLE_SLOTS);
  }

  /** Returns count of hidden slots for a date. */
  getRemainingCount(dateKey: string, totalSlots: number): number {
    return this.expandedDates().has(dateKey) ? 0 : Math.max(0, totalSlots - this.MAX_VISIBLE_SLOTS);
  }

  /** Checks if a date group is expanded. */
  isExpanded(dateKey: string): boolean {
    return this.expandedDates().has(dateKey);
  }

  /** Toggles expansion state for a date group. */
  toggleExpanded(dateKey: string): void {
    const expanded = new Set(this.expandedDates());
    if (expanded.has(dateKey)) {
      expanded.delete(dateKey);
    } else {
      expanded.add(dateKey);
    }
    this.expandedDates.set(expanded);
  }

  /** Returns translated "show more" text with count. */
  getShowMoreText(count: number): string {
    const key = count === 1 ? 'interview.slots.showMoreSingular' : 'interview.slots.showMorePlural';
    return `${count} ${this.translateService.instant(key)}`;
  }

  /** Loads booking data from server with month filter for server-side pagination. */
  private async loadData(processId: string, year?: number, month?: number): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(false);
      const data = await firstValueFrom(this.bookingApi.getBookingData(processId, year, month, 0, 100));

      // Auto-select first available month on initial load using first slot's date
      if (!this.initialized()) {
        const slots = data.availableSlots;
        if (slots && slots.length > 0 && slots[0].startDateTime !== undefined && slots[0].startDateTime !== '') {
          const firstSlotDate = dayjs(slots[0].startDateTime);
          const now = dayjs();
          // Calculate calendar month difference for offset
          const offset = (firstSlotDate.year() - now.year()) * 12 + (firstSlotDate.month() - now.month());
          if (offset !== 0) {
            this.currentMonthOffset.set(offset);
          }
        }
        this.initialized.set(true);
      }

      this.bookingData.set(data);
    } catch (error: unknown) {
      if (error !== null && typeof error === 'object' && 'status' in error && error.status === 403) {
        this.isClosed.set(true);
      } else {
        this.error.set(true);
      }
    } finally {
      this.loading.set(false);
    }
  }

  /** Safely converts date string to timestamp. */
  private safeDate(value?: string): number {
    return !hasText(value) ? Number.POSITIVE_INFINITY : new Date(value).getTime();
  }
}
