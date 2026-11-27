package de.tum.cit.aet.evaluation.dto;

/**
 * Aggregated recommendation across an application's professor/employee decisions
 * and the interview decision, averaged over their signed values (-2, -1, 0, 1, 2).
 * Internal to the evaluation flow; never serialised to JSON.
 *
 * @param average the mean signed decision value, or {@code null} if no rating of any kind exists
 * @param count   the total number of contributing decisions
 */
public record RatingSummary(Double average, int count) {
    public static RatingSummary empty() {
        return new RatingSummary(null, 0);
    }
}
