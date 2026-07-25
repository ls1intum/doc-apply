import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ReferenceRequestDTO } from 'app/generated/model/reference-request-dto';
import { OverallRecommendation } from 'app/generated/model/overall-recommendation';
import TranslateDirective from 'app/shared/language/translate.directive';
import {
  DEPTH_OPTIONS,
  DURATION_OPTIONS,
  OVERALL_OPTIONS,
  RATING_OPTIONS,
  RATING_ROWS,
  RELATIONSHIP_OPTIONS,
  assessmentLabelKey,
} from 'app/reference/reference-assessment.constants';

/**
 * Read-only display of the structured assessment a referee submitted with their recommendation letter.
 * Renders one card per referee whose letter has been submitted; references without an assessment are
 * ignored so the section can be fed the full reference list.
 */
@Component({
  selector: 'jhi-reference-assessment-section',
  standalone: true,
  imports: [TranslateDirective],
  templateUrl: './reference-assessment-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferenceAssessmentSectionComponent {
  readonly assessments = input<ReferenceRequestDTO[]>([]);

  protected readonly cards = computed(() =>
    this.assessments()
      .filter(reference => !!reference.overallRecommendation)
      .map(reference => ({
        id: reference.referenceRequestId,
        name: this.refereeName(reference),
        overallKey: assessmentLabelKey(OVERALL_OPTIONS, reference.overallRecommendation),
        overallClass: this.overallSeverityClass(reference),
        relationshipKey: assessmentLabelKey(RELATIONSHIP_OPTIONS, reference.relationship),
        durationKey: assessmentLabelKey(DURATION_OPTIONS, reference.acquaintanceDuration),
        depthKey: assessmentLabelKey(DEPTH_OPTIONS, reference.acquaintanceDepth),
        ratings: RATING_ROWS.map(row => ({
          labelKey: row.labelKey,
          valueKey: assessmentLabelKey(RATING_OPTIONS, (reference as unknown as Record<string, string | undefined>)[row.key]),
        })),
      })),
  );

  private refereeName(reference: ReferenceRequestDTO): string {
    return [reference.title, reference.firstName, reference.lastName].filter(part => !!part).join(' ');
  }

  private overallSeverityClass(reference: ReferenceRequestDTO): string {
    switch (reference.overallRecommendation) {
      case OverallRecommendation.HighestEnthusiasm:
      case OverallRecommendation.StronglyRecommend:
        return 'text-positive-default';
      case OverallRecommendation.RecommendWithReservations:
        return 'text-warning-default';
      case OverallRecommendation.DoNotRecommend:
        return 'text-negative-default';
      default:
        return 'text-primary';
    }
  }
}
