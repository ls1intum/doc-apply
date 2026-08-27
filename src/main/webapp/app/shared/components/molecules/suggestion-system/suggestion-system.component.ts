import { Component, input, output, signal } from '@angular/core';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';

@Component({
  selector: 'jhi-suggestion-system',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './suggestion-system.component.html',
})
/**
 * Presentational card for a single AI suggestion.
 *
 * Renders the source article, the proposed text and its explanation above an
 * accept and a dismiss button. It holds no domain knowledge and only reports
 * which of the two the user picked.
 */
export class SuggestionSystemComponent {
  /** Regulation or guideline the suggestion is based on. Hidden when empty. */
  article = input<string | undefined>(undefined);

  /** Proposed replacement text. Hidden when empty. */
  suggestion = input<string | undefined>(undefined);

  /** Reason the suggestion is being made. Hidden when empty. */
  explanation = input<string | undefined>(undefined);

  /** Translation key for the accept button, so the label can name the concrete action. */
  actionLabel = input<string>('jobCreationForm.positionDetailsSection.jobDescription.popover.applyButton');

  /** Emits when the user accepts the suggestion. */
  accepted = output();

  /** Emits when the user dismisses the suggestion. */
  dismissed = output();

  /** True while the accept button has pointer or keyboard focus, which highlights the suggestion text it would apply. */
  readonly isActionHovered = signal(false);
}
