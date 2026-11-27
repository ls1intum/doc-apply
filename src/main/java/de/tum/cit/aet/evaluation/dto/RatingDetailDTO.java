package de.tum.cit.aet.evaluation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.evaluation.domain.Rating;
import de.tum.cit.aet.evaluation.domain.enumeration.RecommendationDecision;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Flat representation of a {@link Rating} that keeps the entity id and the
 * rater's user id, suitable for re-importable JSON dumps. The lighter-weight
 * {@link RatingDTO} (string-based) is used for UI display lists.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RatingDetailDTO(UUID ratingId, UUID fromUserId, RecommendationDecision rating, LocalDateTime createdAt) {
    /**
     * @param rating the entity to convert; may be {@code null}
     * @return a flat DTO, or {@code null} if {@code rating} is {@code null}
     */
    public static RatingDetailDTO getFromEntity(Rating rating) {
        if (rating == null) {
            return null;
        }
        return new RatingDetailDTO(
            rating.getRatingId(),
            rating.getFrom() == null ? null : rating.getFrom().getUserId(),
            rating.getRating(),
            rating.getCreatedAt()
        );
    }
}
