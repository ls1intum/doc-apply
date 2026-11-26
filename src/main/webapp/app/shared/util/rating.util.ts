import { RecommendationDecision } from 'app/generated/model/recommendation-decision';

/**
 * Maps the server's average of recommendation decisions to the decision it sits closest to.
 * The server averages the signed values -2, -1, 1 and 2, so the boundaries lie halfway between neighbouring decisions.
 * An even split averages to 0 and counts as a soft pass, the same way the former neutral rating was migrated.
 *
 * @param average the average signed value, or undefined when nobody has decided yet
 * @returns the closest decision, or undefined when there is no average
 */
export function averageToRecommendationDecision(average: number | undefined): RecommendationDecision | undefined {
  if (average === undefined) {
    return undefined;
  }
  if (average >= 1.5) {
    return RecommendationDecision.StrongPass;
  }
  if (average >= 0) {
    return RecommendationDecision.SoftPass;
  }
  if (average > -1.5) {
    return RecommendationDecision.SoftFail;
  }
  return RecommendationDecision.StrongFail;
}
