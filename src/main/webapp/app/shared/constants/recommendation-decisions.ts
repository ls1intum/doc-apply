import { RecommendationDecision } from 'app/generated/model/recommendation-decision';

/**
 * How one recommendation decision is shown as a star: its translation key and the colour of the filled stars while it is shown.
 */
export interface RecommendationDecisionOption {
  value: RecommendationDecision;
  labelKey: string;
  starColourClass: string;
}

/**
 * The four recommendation decisions from rejection to acceptance, one star each, in the order the stars are lined up.
 * The colour only reinforces the direction; the number of filled stars and the label carry the meaning.
 */
export const RECOMMENDATION_DECISION_OPTIONS: readonly RecommendationDecisionOption[] = [
  { value: RecommendationDecision.StrongFail, labelKey: 'evaluation.ratings.STRONG_FAIL', starColourClass: 'text-negative-strong' },
  { value: RecommendationDecision.SoftFail, labelKey: 'evaluation.ratings.SOFT_FAIL', starColourClass: 'text-warning-default' },
  { value: RecommendationDecision.SoftPass, labelKey: 'evaluation.ratings.SOFT_PASS', starColourClass: 'text-positive-default' },
  { value: RecommendationDecision.StrongPass, labelKey: 'evaluation.ratings.STRONG_PASS', starColourClass: 'text-positive-strong' },
];
