import { Component, computed, input, output, signal } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateDirective } from 'app/shared/language';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

export type CalendarDay = {
  date: Date;
  time: number;
  dayOfMonth: number;
  label: string;
  inMonth: boolean;
  selected: boolean;
  disabled: boolean;
  today: boolean;
};

const DAYS_PER_WEEK = 7;
const WEEKS_SHOWN = 6;

/**
 * An always-visible month calendar on which the user picks several days. Weeks start on Monday.
 */
@Component({
  selector: 'jhi-calendar',
  imports: [FontAwesomeModule, TranslateDirective],
  templateUrl: './calendar.component.html',
})
export class CalendarComponent {
  /**
   * The days that are currently picked.
   */
  selectedDates = input<Date[]>([]);

  /**
   * The earliest day the user can pick.
   */
  minDate = input<Date | undefined>(undefined);

  /**
   * Emits all picked days after the user picks or unpicks one.
   */
  selectedDatesChange = output<Date[]>();

  readonly shownMonth = signal<Date>(startOfMonth(new Date()));

  readonly previousMonthDisabled = computed(() => {
    const minDate = this.minDate();
    return minDate !== undefined && this.shownMonth().getTime() <= startOfMonth(minDate).getTime();
  });

  readonly monthLabel = computed(() =>
    new Intl.DateTimeFormat(this.locale(), { month: 'long', year: 'numeric' }).format(this.shownMonth()),
  );

  readonly weekdayLabels = computed(() => {
    const format = new Intl.DateTimeFormat(this.locale(), { weekday: 'short' });
    // 5 January 2026 is a Monday.
    return Array.from({ length: DAYS_PER_WEEK }, (_, index) => format.format(new Date(2026, 0, 5 + index)));
  });

  readonly weeks = computed(() => {
    const month = this.shownMonth();
    const selectedTimes = new Set(this.selectedDates().map(date => startOfDay(date).getTime()));
    const minDate = this.minDate();
    const minTime = minDate === undefined ? undefined : startOfDay(minDate).getTime();
    const todayTime = startOfDay(new Date()).getTime();
    const dayFormat = new Intl.DateTimeFormat(this.locale(), { dateStyle: 'full' });
    // Monday-based offset of the first of the month.
    const leadingDays = (month.getDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;

    const weeks: CalendarDay[][] = [];
    for (let week = 0; week < WEEKS_SHOWN; week++) {
      const days: CalendarDay[] = [];
      for (let weekday = 0; weekday < DAYS_PER_WEEK; weekday++) {
        const date = new Date(month.getFullYear(), month.getMonth(), 1 - leadingDays + week * DAYS_PER_WEEK + weekday);
        const time = date.getTime();
        days.push({
          date,
          time,
          dayOfMonth: date.getDate(),
          label: dayFormat.format(date),
          inMonth: date.getMonth() === month.getMonth(),
          selected: selectedTimes.has(time),
          disabled: minTime !== undefined && time < minTime,
          today: time === todayTime,
        });
      }
      weeks.push(days);
    }
    return weeks;
  });

  private readonly translator = injectTranslator();

  private readonly locale = computed(() => this.translator.langChange()?.lang ?? this.translator.translateService.getCurrentLang());

  /**
   * Moves the shown month by the given number of months.
   *
   * @param offset how many months to move; negative values move back
   */
  showMonth(offset: number): void {
    const month = this.shownMonth();
    this.shownMonth.set(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  }

  /**
   * Picks the day if it was not picked yet and unpicks it otherwise, then emits the new selection.
   *
   * @param day the day the user clicked
   */
  toggle(day: CalendarDay): void {
    if (day.disabled) {
      return;
    }
    const remaining = this.selectedDates().filter(date => startOfDay(date).getTime() !== day.time);
    if (remaining.length === this.selectedDates().length) {
      remaining.push(day.date);
    }
    this.selectedDatesChange.emit(remaining);
  }
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
