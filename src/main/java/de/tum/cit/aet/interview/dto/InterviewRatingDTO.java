package de.tum.cit.aet.interview.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.evaluation.domain.enumeration.RecommendationDecision;

/**
 * Thin DTO carrying the interview recommendation decision and the professor's
 * assessment notes for an application. The {@code rating} is the
 * {@link RecommendationDecision}, or {@code null} if no decision has been
 * recorded yet. The {@code assessmentNotes} is the free-text notes the
 * professor recorded during the interview, or {@code null} if none.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record InterviewRatingDTO(RecommendationDecision rating, String assessmentNotes) {}
