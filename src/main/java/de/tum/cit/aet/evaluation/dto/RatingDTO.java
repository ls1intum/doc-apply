package de.tum.cit.aet.evaluation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.evaluation.domain.Rating;
import de.tum.cit.aet.evaluation.domain.enumeration.RecommendationDecision;
import de.tum.cit.aet.usermanagement.domain.User;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record RatingDTO(UUID fromUserId, String from, RecommendationDecision rating) {
    /**
     * Creates a {@link RatingDTO} from a given {@link Rating} entity.
     *
     * @param rating the {@link Rating} entity to convert; must not be {@code null}
     * @return a {@link RatingDTO} containing the rater's id, full name and decision
     */
    public static RatingDTO from(Rating rating) {
        User rater = rating.getFrom();
        return new RatingDTO(rater.getUserId(), rater.getFirstName() + " " + rater.getLastName(), rating.getRating());
    }
}
