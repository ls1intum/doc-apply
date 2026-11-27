import { RecommendationDecision } from 'app/generated/model/recommendation-decision';

/**
 * Maps the server's average of recommendation decisions to the decision it sits closest to.
 * The server averages the signed values -2, -1, 0, 1 and 2, so the boundaries lie halfway between neighbouring decisions,
 * at -1.5, -0.5, 0.5 and 1.5. An average exactly on a boundary rounds away from neutral, so the scale stays symmetric:
 * 1.5 and above is a strong pass, 0.5 up to 1.5 a soft pass, above -0.5 and below 0.5 neutral, above -1.5 down to -0.5
 * a soft fail, and -1.5 and below a strong fail.
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
  if (average >= 0.5) {
    return RecommendationDecision.SoftPass;
  }
  if (average > -0.5) {
    return RecommendationDecision.Neutral;
  }
  if (average > -1.5) {
    return RecommendationDecision.SoftFail;
  }
  return RecommendationDecision.StrongFail;
}
