import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TumAetUiButtonDirective, TumAetUiInputDirective, TumAetUiTooltipDirective } from '@tumaet/ui-angular';
import { getLocale, parseLocalDateString, toLocalDateString } from 'app/shared/util/date-time.util';
import TranslateDirective from 'app/shared/language/translate.directive';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

let nextInputId = 0;

const DAYS_PER_WEEK = 7;
const WEEKS_PER_MONTH_GRID = 6;
const SUNDAY = 0;
const MONDAY = 1;
/** How many years past the current one the year picker offers when no maximum date is set. */
const OPEN_YEAR_RANGE = 10;
const TYPED_DATE_PATTERN = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/;

const DAY_BUTTON_BASE =
  'inline-flex size-8 items-center justify-center rounded-full text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-default';
const DAY_BUTTON_SELECTED = 'bg-primary-default text-text-on-primary font-semibold';
const DAY_BUTTON_UNAVAILABLE = 'cursor-default text-text-disabled';
const DAY_BUTTON_OUTSIDE_MONTH = 'cursor-pointer text-text-tertiary hover:bg-primary-default hover:text-text-on-primary';
const DAY_BUTTON_AVAILABLE = 'cursor-pointer text-text-primary hover:bg-primary-default hover:text-text-on-primary';
const DAY_BUTTON_TODAY = 'bg-primary-hover-outlined';
const DAY_BUTTON_HIGHLIGHTED = 'font-semibold ring-2 ring-inset ring-primary-default';

/** One day cell of the calendar grid, with everything the template needs precomputed. */
interface CalendarDay {
  date: Date;
  key: string;
  dayOfMonth: number;
  ariaLabel: string;
  selectable: boolean;
  selected: boolean;
  focused: boolean;
  highlighted: boolean;
  classes: string;
}

interface CalendarOption {
  value: number;
  label: string;
  selected: boolean;
}

interface WeekdayLabel {
  short: string;
  long: string;
}

/**
 * Returns a copy of the date at local midnight.
 *
 * @param date the date to copy
 * @returns the same calendar day at 00:00
 */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Returns the first day of the date's month.
 *
 * @param date any day of the month
 * @returns the first of that month at 00:00
 */
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Moves a date by whole days.
 *
 * @param date the starting day
 * @param days how many days to move, negative for earlier days
 * @returns the moved day at 00:00
 */
function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Moves a date by whole months, keeping the day of month where the target month has it.
 *
 * @param date   the starting day
 * @param months how many months to move, negative for earlier months
 * @returns the moved day, clamped to the last day of a shorter target month
 */
function addMonths(date: Date, months: number): Date {
  const firstOfTarget = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDayOfTarget = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0).getDate();
  return new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), Math.min(date.getDate(), lastDayOfTarget));
}

/**
 * Compares two dates by calendar day.
 *
 * @param first  the first date
 * @param second the second date
 * @returns true when both fall on the same day
 */
function isSameDay(first: Date | undefined, second: Date | undefined): boolean {
  return first !== undefined && second !== undefined && toLocalDateString(first) === toLocalDateString(second);
}

/**
 * Keeps a day inside the selectable range.
 *
 * @param date the day to clamp
 * @param min  the earliest selectable day
 * @param max  the latest selectable day, if any
 * @returns the day itself, or the nearest bound it lies beyond
 */
function clampDay(date: Date, min: Date, max: Date | undefined): Date {
  if (date < min) {
    return min;
  }
  return max !== undefined && date > max ? max : date;
}

/**
 * Date field with a calendar overlay. Takes and emits dates as local ISO strings ('YYYY-MM-DD'), shows them in
 * the active language's format, names months and weekdays in that language, and blocks days outside the
 * minimum and maximum date.
 */
@Component({
  selector: 'jhi-datepicker',
  standalone: true,
  imports: [
    CdkConnectedOverlay,
    CdkOverlayOrigin,
    CdkTrapFocus,
    FontAwesomeModule,
    TranslateDirective,
    TumAetUiButtonDirective,
    TumAetUiInputDirective,
    TumAetUiTooltipDirective,
  ],
  templateUrl: './datepicker.component.html',
})
export class DatePickerComponent {
  readonly generatedInputId = `jhi-datepicker-${nextInputId++}`;

  readonly overlayPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  ];

  isCalendarOpen = signal(false);

  width = input<string>('100%');
  inputId = input<string | undefined>(undefined);
  label = input<string | undefined>(undefined);
  required = input<boolean>(false);
  disabled = input<boolean>(false);
  placeholder = input<string | undefined>(undefined);
  icon = input<string | undefined>(undefined);
  tooltipText = input<string | undefined>(undefined);
  shouldTranslate = input<boolean>(true);
  errorEnabled = input<boolean>(false);

  /**
   * Input date value in ISO format: 'YYYY-MM-DD'
   */
  selectedDate = input<string | undefined>(undefined);

  /**
   * Minimum selectable date - if not provided, defaults to today to prevent past date selection
   */
  minDate = input<Date | undefined>(undefined);

  /**
   * Maximum selectable date - if not provided, no maximum date restriction
   */
  maxDate = input<Date | undefined>(undefined);

  /**
   * Default date to show in calendar when opening (does not set the value, just the view)
   */
  defaultDate = input<Date | undefined>(undefined);

  /**
   * Optional reference date to highlight inside the calendar.
   */
  highlightedDate = input<Date | undefined>(undefined);

  /**
   * Optional label shown when hovering or focusing the highlighted day.
   */
  highlightedDateLabel = input<string | undefined>(undefined);

  /**
   * Emits ISO date string ('YYYY-MM-DD') when user selects a date
   */
  selectedDateChange = output<string | undefined>();

  /** The committed date; follows selectedDate and is overwritten by the user's own picks. */
  readonly modelDate = linkedSignal<Date | undefined>(() => {
    try {
      return parseLocalDateString(this.selectedDate());
    } catch {
      return undefined;
    }
  });

  readonly resolvedInputId = computed(() => this.inputId() ?? this.generatedInputId);

  /**
   * Effective minimum date - defaults to today if no minDate provided
   */
  readonly effectiveMinDate = computed(() => {
    const min = this.minDate();
    if (min?.getHours() === 0 && min.getMinutes() === 0 && min.getSeconds() === 0 && min.getMilliseconds() === 0) {
      return min;
    }
    return startOfDay(min ?? new Date());
  });

  /** Locale used to format dates and name months and weekdays; follows the active language. */
  readonly locale = computed(() => {
    this.translator.langChange();
    return getLocale(this.translateService);
  });

  /** Text in the field: the committed date in the active language's format, or what the user is typing. */
  readonly inputText = linkedSignal(() => this.formatForInput(this.modelDate(), this.locale()));

  readonly displayPlaceholder = computed(() => this.translator.translate(this.placeholder(), this.shouldTranslate()) ?? '');
  readonly displayTooltipText = computed(() => this.translator.translate(this.tooltipText(), this.shouldTranslate()) ?? '');
  readonly openCalendarLabel = computed(() => this.translator.translate('tumAetUi.datePicker.open') ?? '');
  readonly dialogLabel = computed(() => this.translator.translate('global.datepicker.dialog') ?? '');
  readonly monthSelectLabel = computed(() => this.translator.translate('global.datepicker.month') ?? '');
  readonly yearSelectLabel = computed(() => this.translator.translate('global.datepicker.year') ?? '');
  readonly displayHighlightedDateLabel = computed(
    () => this.translator.translate(this.highlightedDateLabel(), this.shouldTranslate()) ?? '',
  );

  /** First day of the month the calendar shows. */
  readonly viewMonth = signal<Date>(startOfMonth(new Date()));

  /** The day that holds keyboard focus inside the grid. */
  readonly focusedDate = signal<Date>(startOfDay(new Date()));

  /** Weeks start on Monday in German and on Sunday in English. */
  readonly firstDayOfWeek = computed(() => (this.locale().startsWith('de') ? MONDAY : SUNDAY));

  readonly weekdayLabels = computed<WeekdayLabel[]>(() => {
    const shortFormat = new Intl.DateTimeFormat(this.locale(), { weekday: 'short' });
    const longFormat = new Intl.DateTimeFormat(this.locale(), { weekday: 'long' });
    const firstDay = this.gridStart(new Date(2024, 0, 1));
    return Array.from({ length: DAYS_PER_WEEK }, (_, offset) => {
      const day = addDays(firstDay, offset);
      return { short: shortFormat.format(day), long: longFormat.format(day) };
    });
  });

  readonly monthOptions = computed<CalendarOption[]>(() => {
    const monthFormat = new Intl.DateTimeFormat(this.locale(), { month: 'long' });
    const viewMonth = this.viewMonth().getMonth();
    return Array.from({ length: 12 }, (_, month) => ({
      value: month,
      label: monthFormat.format(new Date(2024, month, 1)),
      selected: month === viewMonth,
    }));
  });

  readonly yearOptions = computed<CalendarOption[]>(() => {
    const viewYear = this.viewMonth().getFullYear();
    const firstYear = Math.min(this.effectiveMinDate().getFullYear(), viewYear);
    const lastYear = Math.max(this.maxDate()?.getFullYear() ?? new Date().getFullYear() + OPEN_YEAR_RANGE, viewYear);
    return Array.from({ length: lastYear - firstYear + 1 }, (_, offset) => ({
      value: firstYear + offset,
      label: String(firstYear + offset),
      selected: firstYear + offset === viewYear,
    }));
  });

  readonly canShowPreviousMonth = computed(() => this.viewMonth() > startOfMonth(this.effectiveMinDate()));
  readonly canShowNextMonth = computed(() => {
    const max = this.maxDate();
    return max === undefined || this.viewMonth() < startOfMonth(max);
  });

  readonly previousMonthLabel = computed(() =>
    this.translateMonthKey('tumAetUi.datePicker.previousMonth', addMonths(this.viewMonth(), -1)),
  );
  readonly nextMonthLabel = computed(() => this.translateMonthKey('tumAetUi.datePicker.nextMonth', addMonths(this.viewMonth(), 1)));

  readonly todaySelectable = computed(() => this.isSelectable(startOfDay(new Date())));

  readonly weeks = computed<CalendarDay[][]>(() => {
    const viewMonth = this.viewMonth();
    const firstCell = this.gridStart(viewMonth);
    const selected = this.modelDate();
    const focused = this.focusedDate();
    const highlighted = this.highlightedDate();
    const today = new Date();
    const fullDateFormat = new Intl.DateTimeFormat(this.locale(), { dateStyle: 'full' });

    return Array.from({ length: WEEKS_PER_MONTH_GRID }, (_, week) =>
      Array.from({ length: DAYS_PER_WEEK }, (_unused, weekday) => {
        const date = addDays(firstCell, week * DAYS_PER_WEEK + weekday);
        const selectable = this.isSelectable(date);
        const isSelected = isSameDay(date, selected);
        const isHighlighted = isSameDay(date, highlighted);
        return {
          date,
          key: toLocalDateString(date),
          dayOfMonth: date.getDate(),
          ariaLabel: fullDateFormat.format(date),
          selectable,
          selected: isSelected,
          focused: isSameDay(date, focused),
          highlighted: isHighlighted,
          classes: this.dayClasses(selectable, isSelected, date.getMonth() === viewMonth.getMonth(), isSameDay(date, today), isHighlighted),
        };
      }),
    );
  });

  private readonly translator = injectTranslator();
  private readonly translateService = this.translator.translateService;
  private readonly injector = inject(Injector);
  private readonly fieldElement = viewChild.required<ElementRef<HTMLElement>>('field');
  private readonly dateInput = viewChild.required<ElementRef<HTMLInputElement>>('dateInput');
  private readonly calendarPanel = viewChild<ElementRef<HTMLElement>>('calendarPanel');

  /**
   * Opens the calendar when it is closed and closes it otherwise.
   */
  toggleCalendar(): void {
    if (this.isCalendarOpen()) {
      this.closeCalendar(true);
    } else {
      this.openCalendar();
    }
  }

  /**
   * Opens the calendar on the committed date, or on the default date or today when nothing is picked yet,
   * and moves focus into the grid.
   */
  openCalendar(): void {
    if (this.disabled()) {
      return;
    }
    const start = this.modelDate() ?? clampDay(startOfDay(this.defaultDate() ?? new Date()), this.effectiveMinDate(), this.maxDate());
    this.focusedDate.set(start);
    this.viewMonth.set(startOfMonth(start));
    this.isCalendarOpen.set(true);
    this.focusActiveDay();
  }

  /**
   * Closes the calendar.
   *
   * @param restoreFocus whether focus goes back to the text field
   */
  closeCalendar(restoreFocus: boolean): void {
    if (!this.isCalendarOpen()) {
      return;
    }
    this.isCalendarOpen.set(false);
    if (restoreFocus) {
      this.dateInput().nativeElement.focus();
    }
  }

  /**
   * Closes the calendar on a click outside of it. Clicks on the field itself are left to the field, so the
   * calendar button can still toggle it.
   *
   * @param event the click outside the overlay
   */
  onOverlayOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Node && this.fieldElement().nativeElement.contains(target)) {
      return;
    }
    this.closeCalendar(false);
  }

  /**
   * Closes the calendar on Escape and returns focus to the field.
   *
   * @param event the key pressed inside the overlay
   */
  onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeCalendar(true);
    }
  }

  /**
   * Commits a clicked day and closes the calendar. Days outside the allowed range are ignored.
   *
   * @param day the clicked day
   */
  selectDay(day: CalendarDay): void {
    if (!day.selectable) {
      return;
    }
    this.onDateChange(day.date);
    this.closeCalendar(true);
  }

  /**
   * Commits today and closes the calendar, when today is inside the allowed range.
   */
  selectToday(): void {
    const today = startOfDay(new Date());
    if (!this.isSelectable(today)) {
      return;
    }
    this.onDateChange(today);
    this.closeCalendar(true);
  }

  /**
   * Removes the committed date and closes the calendar.
   */
  clearDate(): void {
    this.onDateChange(undefined);
    this.closeCalendar(true);
  }

  /**
   * Moves the calendar by whole months, keeping the focused day of month where possible.
   *
   * @param months how many months to move, negative for earlier months
   */
  shiftMonth(months: number): void {
    this.showMonth(addMonths(this.focusedDate(), months));
  }

  /**
   * Shows the month picked in the month dropdown.
   *
   * @param event the change event of the month dropdown
   */
  onMonthSelect(event: Event): void {
    const month = this.readSelectValue(event);
    if (month !== undefined) {
      const focused = this.focusedDate();
      this.showMonth(addMonths(focused, month - focused.getMonth()));
    }
  }

  /**
   * Shows the year picked in the year dropdown.
   *
   * @param event the change event of the year dropdown
   */
  onYearSelect(event: Event): void {
    const year = this.readSelectValue(event);
    if (year !== undefined) {
      const focused = this.focusedDate();
      this.showMonth(addMonths(focused, (year - focused.getFullYear()) * 12));
    }
  }

  /**
   * Moves keyboard focus through the grid with the arrow, Home, End and Page keys.
   *
   * @param event the key pressed on a day
   */
  onDayKeydown(event: KeyboardEvent): void {
    const focused = this.focusedDate();
    const weekdayIndex = (focused.getDay() - this.firstDayOfWeek() + DAYS_PER_WEEK) % DAYS_PER_WEEK;
    const targets: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -DAYS_PER_WEEK),
      ArrowDown: () => addDays(focused, DAYS_PER_WEEK),
      Home: () => addDays(focused, -weekdayIndex),
      End: () => addDays(focused, DAYS_PER_WEEK - 1 - weekdayIndex),
      PageUp: () => addMonths(focused, event.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focused, event.shiftKey ? 12 : 1),
    };
    const target = Object.prototype.hasOwnProperty.call(targets, event.key) ? targets[event.key]() : undefined;
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    this.focusedDate.set(target);
    this.viewMonth.set(startOfMonth(target));
    this.focusActiveDay();
  }

  /**
   * Keeps the typed text while the user edits it.
   *
   * @param event the input event of the text field
   */
  onInputText(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.inputText.set(target.value);
    }
  }

  /**
   * Commits a typed date ('dd.mm.yyyy' or 'dd/mm/yyyy'). Empty text clears the date; text that is no valid,
   * allowed date falls back to the committed one.
   */
  commitTypedDate(): void {
    const text = this.inputText().trim();
    if (text === '') {
      if (this.modelDate() !== undefined) {
        this.onDateChange(undefined);
      }
      return;
    }
    const typed = this.parseTypedDate(text);
    if (typed === undefined || !this.isSelectable(typed)) {
      this.showInputText(this.formatForInput(this.modelDate(), this.locale()));
      return;
    }
    if (!isSameDay(typed, this.modelDate())) {
      this.onDateChange(typed);
    } else {
      this.showInputText(this.formatForInput(typed, this.locale()));
    }
  }

  /**
   * Converts a Date object to ISO date string and emits it as `selectedDateChange`.
   * @param date - The Date object selected by the user
   */
  onDateChange(date: Date | undefined): void {
    this.modelDate.set(date);
    this.selectedDateChange.emit(date ? toLocalDateString(date) : undefined);
  }
  /**
   * Replaces the field text. The element is written directly as well, because the value binding skips the
   * update when the text returns to what it showed at the last render while the user's edit is still visible.
   *
   * @param text the text to show
   */
  private showInputText(text: string): void {
    this.inputText.set(text);
    this.dateInput().nativeElement.value = text;
  }

  /**
   * Shows the month of the given day and moves focus to that day.
   *
   * @param day the day to show and focus
   */
  private showMonth(day: Date): void {
    this.focusedDate.set(day);
    this.viewMonth.set(startOfMonth(day));
  }

  /**
   * Focuses the grid's focusable day once the calendar has rendered.
   */
  private focusActiveDay(): void {
    afterNextRender(
      () => {
        const activeDay = this.calendarPanel()?.nativeElement.querySelector<HTMLElement>('[data-day][tabindex="0"]');
        activeDay?.focus();
      },
      { injector: this.injector },
    );
  }

  /**
   * Returns the first cell of the six-week grid that shows the given month.
   *
   * @param month any day of the month to show
   * @returns the day the grid starts on
   */
  private gridStart(month: Date): Date {
    const first = startOfMonth(month);
    const offset = (first.getDay() - this.firstDayOfWeek() + DAYS_PER_WEEK) % DAYS_PER_WEEK;
    return addDays(first, -offset);
  }

  /**
   * Checks a day against the allowed range.
   *
   * @param date the day to check
   * @returns true when the day lies between the minimum and maximum date
   */
  private isSelectable(date: Date): boolean {
    const max = this.maxDate();
    return date >= this.effectiveMinDate() && (max === undefined || date <= max);
  }

  /**
   * Builds the classes of one day button.
   *
   * @param selectable   whether the day is inside the allowed range
   * @param selected     whether the day is the committed date
   * @param inViewMonth  whether the day belongs to the month on display
   * @param today        whether the day is today
   * @param highlighted  whether the day is the highlighted reference date
   * @returns the Tailwind classes for the button
   */
  private dayClasses(selectable: boolean, selected: boolean, inViewMonth: boolean, today: boolean, highlighted: boolean): string {
    const classes = [DAY_BUTTON_BASE];
    if (selected) {
      classes.push(DAY_BUTTON_SELECTED);
    } else if (!selectable) {
      classes.push(DAY_BUTTON_UNAVAILABLE);
    } else {
      classes.push(inViewMonth ? DAY_BUTTON_AVAILABLE : DAY_BUTTON_OUTSIDE_MONTH);
      if (today) {
        classes.push(DAY_BUTTON_TODAY);
      }
    }
    if (highlighted && !selected) {
      classes.push(DAY_BUTTON_HIGHLIGHTED);
    }
    return classes.join(' ');
  }

  /**
   * Formats a date the way the field shows it: 'dd/mm/yyyy' in English and 'dd.mm.yyyy' in German.
   *
   * @param date   the date to format
   * @param locale the active locale
   * @returns the formatted date, or an empty string when there is none
   */
  private formatForInput(date: Date | undefined, locale: string): string {
    if (date === undefined) {
      return '';
    }
    const separator = locale.startsWith('de') ? '.' : '/';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return [day, month, String(date.getFullYear()).padStart(4, '0')].join(separator);
  }

  /**
   * Parses typed text as day, month and year.
   *
   * @param text the trimmed field text
   * @returns the typed day, or undefined when the text is no valid date
   */
  private parseTypedDate(text: string): Date | undefined {
    const match = TYPED_DATE_PATTERN.exec(text);
    if (match === null) {
      return undefined;
    }
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    return parseLocalDateString(`${match[3]}-${month}-${day}`);
  }

  /**
   * Reads the numeric value of a calendar dropdown.
   *
   * @param event the change event of the dropdown
   * @returns the picked number, or undefined when the event did not come from a dropdown
   */
  private readSelectValue(event: Event): number | undefined {
    const target = event.target;
    return target instanceof HTMLSelectElement ? Number(target.value) : undefined;
  }

  /**
   * Translates a month navigation label.
   *
   * @param key   the translation key, which takes the month as parameter
   * @param month a day of the month the button leads to
   * @returns the translated label
   */
  private translateMonthKey(key: string, month: Date): string {
    const monthName = new Intl.DateTimeFormat(this.locale(), { month: 'long', year: 'numeric' }).format(month);
    return this.translator.translate(key, true, { month: monthName }) ?? '';
  }
}
