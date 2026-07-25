import { hasText } from 'app/shared/util/text.util';
import { Component, computed, inject, input, model, output, signal, viewChildren } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectButtonModule } from 'primeng/selectbutton';
import { DividerModule } from 'primeng/divider';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { TooltipModule } from 'primeng/tooltip';
import { InterviewResourceApi } from 'app/generated/api/interview-resource-api';
import { ToastService } from 'app/service/toast-service';
import { InterviewSlotDTO } from 'app/generated/model/interview-slot-dto';
import { ConflictDataDTO } from 'app/generated/model/conflict-data-dto';
import { ExistingSlotDTO } from 'app/generated/model/existing-slot-dto';
import { SlotInput } from 'app/generated/model/slot-input';
import { firstValueFrom } from 'rxjs';
import { DateSlotCardComponent } from 'app/interview/interview-process-detail/slots-section/slot-creation-form/date-slot-card.component';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { NumberInputComponent } from 'app/shared/components/atoms/number-input/number-input.component';
import { DialogComponent } from 'app/shared/components/atoms/dialog/dialog.component';
import { SegmentButtonComponent } from 'app/shared/components/atoms/segment-button/segment-button.component';
import { HttpErrorResponse } from '@angular/common/http';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { toLocalDateString } from 'app/shared/util/date-time.util';

@Component({
  selector: 'jhi-slot-creation-form',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    DialogModule,
    ButtonModule,
    DatePickerModule,
    SelectButtonModule,
    DividerModule,
    ScrollPanelModule,
    DateSlotCardComponent,
    ButtonComponent,
    NumberInputComponent,
    DialogComponent,
    SegmentButtonComponent,
    TooltipModule,
    FontAwesomeModule,
  ],
  templateUrl: './slot-creation-form.component.html',
})
export class SlotCreationFormComponent {
  readonly dateCards = viewChildren(DateSlotCardComponent);

  // Inputs
  readonly visible = model.required<boolean>();
  readonly processId = input.required<string>();

  // Outputs
  readonly visibleChange = output<boolean>();
  readonly success = output<InterviewSlotDTO[]>();

  // State
  readonly isSubmitting = signal(false);

  selectedDates: Date[] = [];

  // Signal to track template changes
  readonly selectedDatesSignal = signal<Date[]>([]);

  // Sorted dates for display
  readonly sortedDates = computed(() => Array.from(this.selectedDatesSignal()).sort((a, b) => a.getTime() - b.getTime()));

  // Computed map: date timestamp -> date key string (YYYY-MM-DD)
  readonly dateKeys = computed(() => {
    const map = new Map<number, string>();
    for (const date of this.selectedDatesSignal()) {
      map.set(date.getTime(), toLocalDateString(date));
    }
    return map;
  });

  readonly duration = signal<number>(30);

  // Custom Duration State
  readonly customDuration = signal<number | null>(null);
  readonly isCustomDurationMode = signal(false);

  readonly durationError = signal<string | null>(null);
  readonly showValidationErrors = signal(false);

  // Map date string to slots
  readonly slotsByDate = signal<Map<string, InterviewSlotDTO[]>>(new Map());

  // Conflict detection state
  readonly conflictDataByDate = signal<Map<string, ConflictDataDTO>>(new Map());

  // Computes all conflicts between new slots and existing server data.
  readonly serverConflicts = computed(() => {
    const conflicts = new Map<string, { type: 'SAME_PROCESS' | 'BOOKED_OTHER_PROCESS'; slot: ExistingSlotDTO; displayTime: string }>();

    // Iterates over all selected dates
    for (const [dateKey, newSlots] of this.slotsByDate().entries()) {
      // Get the server-side conflict data loaded for this specific date
      const conflictData = this.conflictDataByDate().get(dateKey);
      if (!conflictData?.slots) continue;

      // Check each new slot against the server's existing slots for that day
      for (const slot of newSlots) {
        const conflict = this.findConflict(slot, conflictData);

        if (conflict) {
          // normalized ISO string key (Start-End) to identify which specific NEW slot has a conflict.
          // This key matches the one generated in the child component (DateSlotCard)
          const key = `${new Date(slot.startDateTime ?? '').toISOString()}-${new Date(slot.endDateTime ?? '').toISOString()}`;
          conflicts.set(key, conflict);
        }
      }
    }
    return conflicts;
  });

  // Flag to disable save button when conflicts exist
  readonly hasConflicts = computed(() => this.serverConflicts().size > 0 || this.hasInternalConflicts());

  readonly hasInternalConflicts = computed(() => {
    for (const slots of this.slotsByDate().values()) {
      if (this.checkInternalOverlaps(slots)) {
        return true;
      }
    }
    return false;
  });

  // Options
  readonly durationOptions = [
    { label: 'interview.slots.create.durations.30min', value: 30 },
    { label: 'interview.slots.create.durations.45min', value: 45 },
    { label: 'interview.slots.create.durations.60min', value: 60 },
    { label: 'interview.slots.create.durations.90min', value: 90 },
  ];

  readonly minDate = new Date();

  // Dependencies
  private readonly interviewApi = inject(InterviewResourceApi);
  private readonly toastService = inject(ToastService);

  /**
   * Selects a predefined duration.
   * If value is -1, switches to custom duration mode.
   * @param value The duration in minutes or -1 for custom.
   */
  selectDuration(value: number): void {
    if (value === -1) {
      this.isCustomDurationMode.set(true);
      if (this.customDuration() === null) {
        this.customDuration.set(this.duration());
      }
    } else {
      this.isCustomDurationMode.set(false);
      this.durationError.set(null); // Clear error on preset switch
      this.duration.set(value);
    }
  }

  /**
   * Updates the duration from the custom input field.
   * @param value The new duration in minutes.
   */
  onCustomDurationInput(value: number | undefined): void {
    const safeValue = value ?? 0;
    this.customDuration.set(safeValue);

    if (safeValue <= 0) {
      this.durationError.set('interview.slots.create.validation.durationPositive');
      // Prevent invalid updates to preserve child component stability
      return;
    }

    this.durationError.set(null);
    this.duration.set(safeValue);
  }

  /**
   * Handles date selection from the calendar.
   * Syncs the regular property with the signal for template reactivity.
   * Also loads conflict data for newly selected dates.
   */
  onDateSelect(dates: Date | Date[] | null): void {
    if (!dates) {
      this.selectedDatesSignal.set([]);
      this.selectedDates = [];
      return;
    }

    const currentSelection = Array.isArray(dates) ? dates : [dates];

    // Handle single vs multi selection behavior
    let newSelection: Date[];
    const previousSelection = this.selectedDatesSignal();

    if (currentSelection.length === 1 && !Array.isArray(dates)) {
      // Toggle logic for single click in calendar
      const clickedDate = currentSelection[0];
      const exists = previousSelection.some(d => d.getTime() === clickedDate.getTime());

      if (exists) {
        // Deselect if already selected
        newSelection = previousSelection.length > 1 ? previousSelection.filter(d => d.getTime() !== clickedDate.getTime()) : [];
      } else {
        newSelection = [...previousSelection, clickedDate];
      }
    } else {
      // Standard multi-select update
      newSelection = [...currentSelection];
    }

    newSelection.sort((a, b) => a.getTime() - b.getTime());
    this.selectedDatesSignal.set(newSelection);
    this.selectedDates = newSelection;

    // Load conflict data for all selected dates
    newSelection.forEach(date => {
      void this.loadConflictDataForDate(date);
    });
  }

  /**
   * Removes a date from the selected dates list.
   * @param dateToRemove The date to remove.
   */
  removeDate(dateToRemove: Date): void {
    const timeToRemove = dateToRemove.getTime();
    const newSelection = this.selectedDatesSignal().filter(d => d.getTime() !== timeToRemove);
    this.selectedDatesSignal.set(newSelection);
    this.selectedDates = newSelection;
  }

  /**
   * Updates the slots map for a specific date.
   * @param date The date to update.
   * @param slots The new list of slots for that date.
   */
  updateSlotsForDate(date: Date, slots: InterviewSlotDTO[]): void {
    const dateStr = toLocalDateString(date);
    this.slotsByDate.update(map => {
      const newMap = new Map(map);
      newMap.set(dateStr, slots);
      return newMap;
    });
  }

  /**
   * Copies the slots from the first selected date to all other selected dates.
   */
  copySlotsToAllDays(): void {
    const cards = this.dateCards();
    if (cards.length < 2) {
      return;
    }

    // 1. Get ranges from first card
    const sourceCard = cards[0];
    const sourceRanges = sourceCard.getRanges();

    if (sourceRanges.length === 0) {
      return;
    }

    // 2. Apply ranges to other cards
    cards.slice(1).forEach(targetCard => {
      targetCard.setRanges(sourceRanges);
    });

    this.toastService.showSuccessKey('interview.slots.create.copySuccess');
  }

  /**
   * Closes the dialog and resets the form state.
   */
  close(): void {
    this.visibleChange.emit(false);
    this.resetState();
  }

  /**
   * Submits the created slots to server.
   * Validate slots before submission.
   */
  async submit(): Promise<void> {
    const allSlots = Array.from(this.slotsByDate().values()).flat();

    if (allSlots.length === 0) {
      this.toastService.showErrorKey('interview.slots.create.error.noSlots');
      return;
    }

    // Validate that all slots have a location to display red border if missing
    const hasMissingLocation = allSlots.some(slot => (slot.location ?? '').trim() === '');
    if (hasMissingLocation) {
      this.showValidationErrors.set(true);
      this.toastService.showErrorKey('interview.slots.create.validation.locationRequired');
      return;
    }

    this.isSubmitting.set(true);

    try {
      const slotsToCreate: SlotInput[] = allSlots.map(slot => {
        const start = new Date(slot.startDateTime ?? '');
        const end = new Date(slot.endDateTime ?? '');
        return {
          date: toLocalDateString(start),
          startTime: start.toTimeString().slice(0, 5),
          endTime: end.toTimeString().slice(0, 5),
          location: slot.location ?? '',
          streamLink: slot.streamLink,
        };
      });

      const createdSlots = await firstValueFrom(this.interviewApi.createSlots(this.processId(), { slots: slotsToCreate }));

      this.toastService.showSuccessKey('interview.slots.create.success');
      this.success.emit(createdSlots);
      this.close();
    } catch (error: unknown) {
      console.error(error);
      if (error instanceof HttpErrorResponse && error.status === 409) {
        this.toastService.showErrorKey('interview.slots.create.error.conflict');
      } else {
        this.toastService.showErrorKey('interview.slots.create.error.generic');
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /**
   * Resets the internal state of the form.
   * Clears selected dates, slots, and resets duration/break settings.
   */
  private resetState(): void {
    this.selectedDatesSignal.set([]);
    this.selectedDates = [];
    this.slotsByDate.set(new Map());
    this.conflictDataByDate.set(new Map());
    this.isSubmitting.set(false);
    this.showValidationErrors.set(false);
  }

  /**
   * Finds conflicts for a new slot against existing slots.
   * Priority: BOOKED_OTHER_PROCESS > SAME_PROCESS
   */
  /**
   * Finds conflicts for a new slot against existing slots.
   * Priority: BOOKED_OTHER_PROCESS > SAME_PROCESS
   * If multiple conflicts exist, returns the most severe type and a combined time string.
   */
  private findConflict(
    slot: InterviewSlotDTO,
    data: ConflictDataDTO,
  ): { type: 'SAME_PROCESS' | 'BOOKED_OTHER_PROCESS'; slot: ExistingSlotDTO; displayTime: string } | null {
    if (!data.slots || (data.currentProcessId ?? '') === '') {
      return null;
    }

    const start = new Date(slot.startDateTime ?? '').getTime();
    const end = new Date(slot.endDateTime ?? '').getTime();

    const conflicts: ExistingSlotDTO[] = [];
    let hasBookedConflict = false;

    // Collect all overlapping existing slots
    for (const existing of data.slots) {
      if (this.overlaps(start, end, existing)) {
        conflicts.push(existing);
        if (existing.interviewProcessId !== data.currentProcessId && existing.isBooked === true) {
          hasBookedConflict = true;
        }
      }
    }

    if (conflicts.length === 0) {
      return null;
    }

    // Determine type and formatted times
    // Sort logic or keeping order? Server order is usually chronological, which is good.
    const displayTimes = conflicts
      .map(c => this.formatTimeRange(c.startDateTime, c.endDateTime))
      .filter(t => t !== '')
      .join(', ');

    const primaryType = hasBookedConflict ? 'BOOKED_OTHER_PROCESS' : 'SAME_PROCESS';

    // We return the first slot as the "representative" slot object for the interface,
    // but the displayTime contains info for all of them.
    return { type: primaryType, slot: conflicts[0], displayTime: displayTimes };
  }

  private formatTimeRange(start: string | undefined, end: string | undefined): string {
    if (!hasText(start) || !hasText(end)) return '';
    const s = new Date(start);
    const e = new Date(end);

    // Check for invalid dates
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return '';

    const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
    return `${s.toLocaleTimeString([], options)} - ${e.toLocaleTimeString([], options)}`;
  }

  private overlaps(start: number, end: number, existing: ExistingSlotDTO): boolean {
    const existStart = new Date(existing.startDateTime ?? '').getTime();
    const existEnd = new Date(existing.endDateTime ?? '').getTime();
    return start < existEnd && end > existStart;
  }

  private checkInternalOverlaps(slots: InterviewSlotDTO[]): boolean {
    if (slots.length < 2) return false;

    const sorted = [...slots]
      .map(s => ({
        start: new Date(s.startDateTime ?? '').getTime(),
        end: new Date(s.endDateTime ?? '').getTime(),
      }))
      .filter(s => !isNaN(s.start) && !isNaN(s.end))
      .sort((a, b) => a.start - b.start);

    // Scan through sorted slots to find any overlap
    let maxEndTime = 0;
    let isFirst = true;

    for (const current of sorted) {
      if (isFirst) {
        maxEndTime = current.end;
        isFirst = false;
        continue;
      }

      // If current slot starts before the previous max end time, we have an overlap
      if (current.start < maxEndTime) {
        return true;
      }

      // Update maxEndTime if current slot extends further
      if (current.end > maxEndTime) {
        maxEndTime = current.end;
      }
    }

    return false;
  }

  /**
   * Loads conflict data for a specific date from server.
   */
  private async loadConflictDataForDate(date: Date): Promise<void> {
    const dateStr = toLocalDateString(date);

    // Skip if already loaded
    if (this.conflictDataByDate().has(dateStr)) {
      return;
    }

    try {
      const conflictData = await firstValueFrom(this.interviewApi.getConflictDataForDate(this.processId(), dateStr));
      this.conflictDataByDate.update(map => {
        const newMap = new Map(map);
        newMap.set(dateStr, conflictData);
        return newMap;
      });
    } catch {
      /* Fail silently as conflict data is optional and only used for UI warnings */
    }
  }
}
