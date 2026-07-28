import { hasText } from 'app/shared/util/text.util';
import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { InterviewSlotDTO } from 'app/generated/model/interview-slot-dto';
import TranslateDirective from 'app/shared/language/translate.directive';
import { formatTimeRange, getLocale } from 'app/shared/util/date-time.util';
import { isVirtualLocation } from 'app/shared/util/location.util';

/** Selectable slot card for interview booking. Displays time, duration, and location. */
@Component({
  selector: 'jhi-selectable-slot-card',
  standalone: true,
  imports: [FontAwesomeModule, TranslateModule, TranslateDirective],
  templateUrl: './selectable-slot-card.component.html',
})
export class SelectableSlotCardComponent {
  // Inputs
  slot = input.required<InterviewSlotDTO>();
  selected = input<boolean>(false);

  // Outputs
  slotSelected = output<InterviewSlotDTO>();

  // Computed
  /** Formats time range as "HH:MM - HH:MM". */
  timeRange = computed(() => formatTimeRange(this.slot().startDateTime, this.slot().endDateTime, this.locale()));

  /** Calculates and formats duration in minutes. */
  duration = computed(() => {
    const start = this.slot().startDateTime;
    const end = this.slot().endDateTime;
    if (!hasText(start) || !hasText(end)) return '';
    return `${Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)} min`;
  });

  /** Checks if slot is virtual. */
  isVirtual = computed(() => isVirtualLocation(this.slot().location));

  // Services
  private readonly translateService = inject(TranslateService);

  // Signals
  private readonly langChange = toSignal(this.translateService.onLangChange);

  // Computed
  private readonly locale = computed(() => {
    this.langChange();
    return getLocale(this.translateService);
  });

  /** Emits slot selection event. */
  onSelect(): void {
    this.slotSelected.emit(this.slot());
  }
}
