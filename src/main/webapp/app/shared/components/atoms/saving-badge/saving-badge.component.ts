import { Component, computed, input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import TranslateDirective from 'app/shared/language/translate.directive';
import { SavingState, SavingStates } from 'app/shared/constants/saving-states';

const STATE_COLOR_CLASS: Record<SavingState, string> = {
  [SavingStates.SAVED]: 'text-positive-default',
  [SavingStates.SAVING]: 'text-warning-default',
  [SavingStates.FAILED]: 'text-negative-default',
};

/**
 * Inline status pill showing whether the surrounding form is `SAVED`, `SAVING`, or `FAILED`.
 * Drives off the same SavingState the AutoSaveController emits.
 */
@Component({
  selector: 'jhi-saving-badge',
  standalone: true,
  imports: [FontAwesomeModule, TranslateDirective],
  templateUrl: './saving-badge.component.html',
})
export class SavingBadgeComponent {
  state = input.required<SavingState>();

  readonly translationKey = computed(() => `entity.applicationSteps.status.${this.state()}`);
  readonly colorClass = computed(() => STATE_COLOR_CLASS[this.state()]);
}
