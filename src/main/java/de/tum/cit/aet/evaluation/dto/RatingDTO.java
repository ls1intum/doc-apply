package de.tum.cit.aet.evaluation.dto;

import de.tum.cit.aet.evaluation.domain.Rating;
import de.tum.cit.aet.usermanagement.domain.User;
import java.util.UUID;

public record RatingDTO(UUID fromUserId, String from, int rating) {
    /**
     * Creates a {@link RatingDTO} from a given {@link Rating} entity.
     *
     * @param rating the {@link Rating} entity to convert; must not be {@code null}
     * @return a {@link RatingDTO} containing the rater's id, full name and rating value
     */
    public static RatingDTO from(Rating rating) {
        User rater = rating.getFrom();
        return new RatingDTO(rater.getUserId(), rater.getFirstName() + " " + rater.getLastName(), rating.getRating());
    }
}
