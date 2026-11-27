package de.tum.cit.aet.interview.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.application.domain.dto.ApplicationDetailDTO;
import de.tum.cit.aet.application.domain.dto.ApplicationDocumentIdsDTO;
import de.tum.cit.aet.evaluation.domain.enumeration.RecommendationDecision;
import java.time.Instant;
import java.util.UUID;

/**
 * Detailed DTO for a single interviewee with full application context.
 * Includes application details, documents, and assessment information.
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record IntervieweeDetailDTO(
    UUID id,
    UUID applicationId,
    IntervieweeDTO.IntervieweeUserDTO user,
    Instant lastInvited,
    InterviewSlotDTO scheduledSlot,
    IntervieweeState state,
    RecommendationDecision rating,
    String assessmentNotes,
    ApplicationDetailDTO application,
    ApplicationDocumentIdsDTO documents
) {}
