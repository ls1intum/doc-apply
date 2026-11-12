import { Component, input, output } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateDirective } from 'app/shared/language';
import { ProgressSpinnerComponent } from 'app/shared/components/atoms/progress-spinner/progress-spinner.component';

/**
 * A generic pill that displays a colored dot, a label, and a trailing
 * indicator (spinner while loading, count, or a checkmark when clear).
 *
 * Can be used for filter lists, status indicators, or any toggleable
 * pill-style UI element.
 */
@Component({
  selector: 'jhi-status-pill',
  standalone: true,
  imports: [FontAwesomeModule, TranslateDirective, ProgressSpinnerComponent],
  templateUrl: './status-pill.component.html',
})
export class StatusPillComponent {
  /** Translation key for the pill label. */
  labelKey = input.required<string>();

  /** Tailwind background-color class for the leading dot (e.g. 'bg-negative-default'). */
  dotColor = input.required<string>();

  /** Number of items in this category. 0 disables the pill. */
  count = input<number>(0);

  /** Whether the pill is currently selected / active. */
  isActive = input<boolean>(false);

  /** Whether a background process is running (shows spinner instead of count). */
  loading = input<boolean>(false);

  /** Emitted when the user clicks an enabled pill. */
  selected = output();
}
