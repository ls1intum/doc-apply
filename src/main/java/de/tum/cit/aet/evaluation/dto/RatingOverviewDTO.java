package de.tum.cit.aet.evaluation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.evaluation.domain.Rating;
import de.tum.cit.aet.evaluation.domain.enumeration.RecommendationDecision;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Recommendation decisions for an application, split into the current user's own decision and those of other reviewers.
 *
 * @param currentUserRating the decision of the current user, or null if the user has not decided yet
 * @param otherRatings      the decisions of other users
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record RatingOverviewDTO(RecommendationDecision currentUserRating, Set<RatingDTO> otherRatings) {
    /**
     * Creates a {@link RatingOverviewDTO} containing the current user's rating and
     * a collection of all ratings as {@link RatingDTO} objects.
     *
     * @param currentRating the current user's {@link Rating}, or {@code null} if the user has not rated yet
     * @param ratings       the set of all {@link Rating} entities; must not be {@code null}
     * @return a {@link RatingOverviewDTO} containing the current user's decision and all other decisions
     */
    public static RatingOverviewDTO getRatingOverviewDTO(Rating currentRating, Set<Rating> ratings) {
        RecommendationDecision currentUserRating = null;

        if (currentRating != null) {
            currentUserRating = currentRating.getRating();
        }

        return new RatingOverviewDTO(currentUserRating, ratings.stream().map(RatingDTO::from).collect(Collectors.toSet()));
    }
}
