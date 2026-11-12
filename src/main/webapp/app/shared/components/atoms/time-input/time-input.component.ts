import { Component, computed, input, output } from '@angular/core';
import { TumAetUiInputDirective } from '@tumaet/ui-angular';

const TIME_DIGITS = 4;
const SLOT_CHAR = '-';

/**
 * Keeps the first four digits of a value and formats them as HH:mm while they are typed.
 *
 * @param raw the text to format
 * @returns the digits with a colon after the hours, for example "9" stays "9" and "0930" becomes "09:30"
 */
function formatTimeDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, TIME_DIGITS);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

/**
 * Pads partially typed digits with slot characters to the HH:mm shape, so an incomplete time never parses as a
 * valid one downstream.
 *
 * @param digits up to four typed digits
 * @returns an empty string for no digits, otherwise a five character HH:mm string such as "09:3-"
 */
function toMaskedTime(digits: string): string {
  if (digits === '') {
    return '';
  }
  const padded = digits.padEnd(TIME_DIGITS, SLOT_CHAR);
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

@Component({
  selector: 'jhi-time-input',
  templateUrl: './time-input.component.html',
  standalone: true,
  imports: [TumAetUiInputDirective],
})
export class TimeInputComponent {
  id = input<string>('');
  value = input<string>('');
  disabled = input<boolean>(false);
  classStyling = input<string>('');

  valueChange = output<string>();

  protected readonly inputId = computed(() => (this.id() === '' ? undefined : this.id()));
  protected readonly displayValue = computed(() => formatTimeDigits(this.value()));

  /**
   * Reformats the typed text in place and emits it in the HH:mm shape.
   *
   * @param event the input event of the time field
   */
  onInput(event: Event): void {
    const field = event.target;
    if (!(field instanceof HTMLInputElement)) {
      return;
    }
    const formatted = formatTimeDigits(field.value);
    field.value = formatted;
    this.onValueChange(toMaskedTime(formatted.replace(':', '')));
  }

  onValueChange(newValue: string): void {
    this.valueChange.emit(newValue);
  }
}
