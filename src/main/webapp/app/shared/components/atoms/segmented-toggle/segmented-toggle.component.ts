import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { TranslateDirective } from 'app/shared/language';

/**
 * Generic two-option segmented toggle.
 *
 * Use this wherever you need a clean "Option A / Option B" switch:
 * - EN / DE
 * - Public / Private
 * - Draft / Preview
 * - etc.
 *
 * Parent owns the selected value. Component just emits changes.
 */
export type SegmentedToggleValue = 'left' | 'right';

@Component({
  selector: 'jhi-segmented-toggle',
  standalone: true,
  imports: [CommonModule, TranslateDirective],
  templateUrl: './segmented-toggle.component.html',
})
export class SegmentedToggleComponent {
  /**
   * Currently selected side. Parent controls this (one-way in).
   */
  value = input<SegmentedToggleValue>('left');

  /**
   * Disable both buttons (e.g. while saving/translating).
   */
  disabled = input<boolean>(false);

  /**
   * Label shown on the left option.
   * Can be a translation key if you set `translateLabels=true`.
   */
  leftLabel = input<string>('Left');

  /**
   * Label shown on the right option.
   * Can be a translation key if you set `translateLabels=true`.
   */
  rightLabel = input<string>('Right');

  /**
   * If true, `leftLabel` and `rightLabel` are treated as translation keys.
   */
  translateLabels = input<boolean>(true);

  /**
   * Emits when user selects a new side.
   */
  valueChange = output<SegmentedToggleValue>();

  readonly btnClass =
    'relative z-[2] flex-1 py-1 px-4 min-w-[5rem] text-sm font-semibold cursor-pointer transition-colors duration-200 disabled:opacity-50 text-text-tertiary hover:enabled:text-text-primary';

  setValue(next: SegmentedToggleValue): void {
    if (next === this.value() || this.disabled()) return;
    this.valueChange.emit(next);
  }
}
