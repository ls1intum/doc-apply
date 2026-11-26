package de.tum.cit.aet.interview.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.evaluation.domain.enumeration.RecommendationDecision;

/**
 * DTO for updating interviewee assessment (rating and notes).
 * At least one field must be provided.
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record UpdateAssessmentDTO(RecommendationDecision rating, Boolean clearRating, String notes) {
    /**
     * Checks if the DTO has at least one field set.
     *
     * @return true if either rating, clearRating, or notes is provided
     */
    public boolean hasContent() {
        return rating != null || Boolean.TRUE.equals(clearRating) || notes != null;
    }
}
