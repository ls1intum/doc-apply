import { RecommendationDecision } from 'app/generated/model/recommendation-decision';

/**
 * How one recommendation decision is shown: its translation key and the colour of the dot that marks its direction.
 */
export interface RecommendationDecisionOption {
  value: RecommendationDecision;
  labelKey: string;
  dotClass: string;
}

/**
 * The four recommendation decisions from rejection to acceptance, in the order they are offered and listed.
 * The colour only reinforces the direction; the label always carries the meaning.
 */
export const RECOMMENDATION_DECISION_OPTIONS: readonly RecommendationDecisionOption[] = [
  { value: RecommendationDecision.StrongFail, labelKey: 'evaluation.ratings.STRONG_FAIL', dotClass: 'bg-negative-strong' },
  { value: RecommendationDecision.SoftFail, labelKey: 'evaluation.ratings.SOFT_FAIL', dotClass: 'bg-warning-default' },
  { value: RecommendationDecision.SoftPass, labelKey: 'evaluation.ratings.SOFT_PASS', dotClass: 'bg-positive-default' },
  { value: RecommendationDecision.StrongPass, labelKey: 'evaluation.ratings.STRONG_PASS', dotClass: 'bg-positive-strong' },
];
