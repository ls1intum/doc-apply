import { Component, computed, input } from '@angular/core';
import { TumAetUiProgressSpinnerComponent } from '@tumaet/ui-angular';

const STROKE_CLASSES: Record<'2' | '4', string> = {
  '2': '',
  '4': '[&_circle]:[stroke-width:4]',
};

@Component({
  selector: 'jhi-progress-spinner',
  standalone: true,
  templateUrl: './progress-spinner.component.html',
  imports: [TumAetUiProgressSpinnerComponent],
  host: { class: 'inline-flex shrink-0 items-center' },
})
export class ProgressSpinnerComponent {
  classStyling = input<string>('');

  strokeWidth = input<'2' | '4'>('2');

  readonly spinnerClass = computed(() => `${STROKE_CLASSES[this.strokeWidth()]} ${this.classStyling() || 'size-full'}`);
}
