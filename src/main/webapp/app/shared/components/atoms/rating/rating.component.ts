import { Component, ElementRef, computed, inject, input, model, viewChildren } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { RecommendationDecision } from 'app/generated/model/recommendation-decision';
import { RECOMMENDATION_DECISION_OPTIONS, RecommendationDecisionOption } from 'app/shared/constants/recommendation-decisions';
import { TranslateDirective } from 'app/shared/language';

/**
 * One option of the segmented control, with the state the template needs to render it.
 */
interface DecisionSegment extends RecommendationDecisionOption {
  selected: boolean;
  tabbable: boolean;
  buttonClass: string;
}

const SEGMENT_CLASSES =
  'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary-default';
const SELECTED_SEGMENT_CLASSES = 'border-border-default bg-background-default text-text-primary shadow-sm';
const UNSELECTED_SEGMENT_CLASSES = 'border-transparent bg-transparent text-text-secondary hover:text-text-primary';

/**
 * Shows a recommendation decision (strong fail, soft fail, soft pass or strong pass).
 * When selectable it is a segmented control that sets the decision; otherwise it is a compact read-only chip.
 */
@Component({
  selector: 'jhi-rating',
  imports: [TranslateDirective],
  templateUrl: './rating.component.html',
})
export class RatingComponent {
  rating = model<RecommendationDecision | undefined>(undefined);
  selectable = input<boolean>(false);

  readonly segments = computed<DecisionSegment[]>(() => {
    const current = this.rating();
    const focused = this.focusedValue();
    return RECOMMENDATION_DECISION_OPTIONS.map(option => {
      const selected = option.value === current;
      return {
        value: option.value,
        labelKey: option.labelKey,
        dotClass: option.dotClass,
        selected,
        tabbable: option.value === focused,
        buttonClass: `${SEGMENT_CLASSES} ${selected ? SELECTED_SEGMENT_CLASSES : UNSELECTED_SEGMENT_CLASSES}`,
      };
    });
  });

  /** The option matching the current decision, shown by the read-only chip; undefined while nobody has decided. */
  readonly selectedOption = computed<RecommendationDecisionOption | undefined>(() =>
    RECOMMENDATION_DECISION_OPTIONS.find(option => option.value === this.rating()),
  );

  readonly groupLabel = computed<string>(() => {
    this.langChange();
    return this.translateService.instant('evaluation.ratings.groupLabel');
  });

  private readonly segmentButtons = viewChildren<ElementRef<HTMLButtonElement>>('segmentButton');
  private readonly translateService = inject(TranslateService);
  private readonly langChange = toSignal(this.translateService.onLangChange, { initialValue: undefined });

  /** Which option owns the group's single tab stop: the chosen one, or the first while nothing is chosen. */
  private readonly focusedValue = computed<RecommendationDecision>(
    () => this.selectedOption()?.value ?? RECOMMENDATION_DECISION_OPTIONS[0].value,
  );

  /**
   * Sets the decision, or clears it when the chosen option is picked again so that "no recommendation yet" stays reachable.
   *
   * @param value the decision of the clicked option
   */
  onSelect(value: RecommendationDecision): void {
    if (!this.selectable()) {
      return;
    }
    this.rating.set(this.rating() === value ? undefined : value);
  }

  /**
   * Moves the decision with the arrow keys as a radio group is expected to, with Home and End jumping to the ends.
   *
   * @param event the keyboard event raised on an option
   */
  onKeydown(event: KeyboardEvent): void {
    if (!this.selectable()) {
      return;
    }
    const values = RECOMMENDATION_DECISION_OPTIONS.map(option => option.value);
    const currentIndex = values.indexOf(this.focusedValue());
    let nextIndex: number;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = Math.min(currentIndex + 1, values.length - 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = Math.max(currentIndex - 1, 0);
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = values.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.rating.set(values[nextIndex]);
    this.segmentButtons()[nextIndex]?.nativeElement.focus();
  }
}
