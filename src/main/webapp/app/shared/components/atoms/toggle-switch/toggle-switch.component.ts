import { Component, computed, input, output } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FormsModule } from '@angular/forms';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

@Component({
  selector: 'jhi-toggle-switch',
  standalone: true,
  templateUrl: './toggle-switch.component.html',
  imports: [ToggleSwitchModule, FormsModule, FontAwesomeModule],
})
export class ToggleSwitchComponent {
  /**
   * Current on/off state of the toggle.
   */
  model = input<boolean>(false);

  /**
   * Emits whenever the toggle value changes.
   */
  modelChange = output<boolean>();

  /**
   * Whether the toggle is disabled.
   */
  disabled = input<boolean>(false);

  /**
   * Optional style class passed to PrimeNG ToggleSwitch.
   */
  classStyling = input<string>('');

  readonly enabledIcon = faCheck;
  readonly disabledIcon = faXmark;

  readonly toggleClass = computed(() =>
    [
      'jhi-toggle-switch',
      '[--jhi-toggle-handle-width:1.55rem]',
      '[&_.p-toggleswitch-slider]:border-negative-strong',
      '[&_.p-toggleswitch-slider]:bg-negative-strong',
      '[&_.p-toggleswitch-slider]:transition-colors',
      '[&_.p-toggleswitch-handle]:flex',
      '[&_.p-toggleswitch-handle]:items-center',
      '[&_.p-toggleswitch-handle]:justify-center',
      '[&_.p-toggleswitch-handle]:w-[var(--jhi-toggle-handle-width)]',
      '[&_.p-toggleswitch-handle]:rounded-full',
      '[&.p-toggleswitch-checked_.p-toggleswitch-slider]:border-positive-strong',
      '[&.p-toggleswitch-checked_.p-toggleswitch-slider]:bg-positive-strong',
      '[&.p-toggleswitch-checked_.p-toggleswitch-handle]:[inset-inline-start:calc(var(--p-toggleswitch-width)-var(--jhi-toggle-handle-width)-var(--p-toggleswitch-gap))]',
      '[&.p-disabled_.p-toggleswitch-slider]:!bg-background-disabled',
      '[&.p-disabled_.p-toggleswitch-slider]:!border-border-default',
      this.classStyling(),
    ]
      .filter(Boolean)
      .join(' '),
  );

  onChange(value: boolean): void {
    this.modelChange.emit(value);
  }
}
