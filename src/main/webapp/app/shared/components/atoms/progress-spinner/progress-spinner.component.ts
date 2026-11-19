import { Component, computed, input } from '@angular/core';
import { TumAetUiProgressSpinnerComponent } from '@tumaet/ui-angular';

@Component({
  selector: 'jhi-progress-spinner',
  standalone: true,
  templateUrl: './progress-spinner.component.html',
  imports: [TumAetUiProgressSpinnerComponent],
  host: { class: 'inline-flex shrink-0 items-center' },
})
export class ProgressSpinnerComponent {
  classStyling = input<string>('');

  /**
   * Thickness of the spinner stroke.
   */
  strokeWidth = input<string>('2');

  /**
   * Optional inline styles.
   */
  style = input<Record<string, string> | undefined>(undefined);

  readonly sizeClass = computed(() => this.classStyling() || 'size-full');
}
