import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';

/**
 * An always-visible month calendar on which the user picks several days.
 */
@Component({
  selector: 'jhi-calendar',
  standalone: true,
  imports: [FormsModule, DatePickerModule],
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

  /**
   * Forwards the picked days, treating a cleared calendar as no days.
   *
   * @param dates the days the calendar reports as picked
   */
  onDatesChange(dates: Date[] | undefined): void {
    this.selectedDatesChange.emit(dates ?? []);
  }
}
