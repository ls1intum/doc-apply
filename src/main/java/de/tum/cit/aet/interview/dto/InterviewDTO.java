package de.tum.cit.aet.interview.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.core.util.HtmlSanitizer;
import de.tum.cit.aet.evaluation.domain.enumeration.RecommendationDecision;
import de.tum.cit.aet.interview.domain.Interviewee;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Flat representation of an {@link Interviewee} along with its scheduled
 * slots. Built specifically to be re-importable: keeps both the interviewee id
 * and the interview-process id, plus the rating and free-form notes recorded
 * by the interviewer. Slots reuse the existing {@link InterviewSlotDTO}.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record InterviewDTO(
    UUID intervieweeId,
    UUID interviewProcessId,
    Instant lastInvited,
    RecommendationDecision rating,
    String assessmentNotes,
    List<InterviewSlotDTO> slots
) {
    /**
     * @param interviewee the entity to convert; may be {@code null}
     * @return a flat DTO, or {@code null} if {@code interviewee} is {@code null}
     */
    public static InterviewDTO getFromEntity(Interviewee interviewee) {
        if (interviewee == null) {
            return null;
        }
        List<InterviewSlotDTO> slots =
            interviewee.getSlots() == null ? List.of() : interviewee.getSlots().stream().map(InterviewSlotDTO::fromEntity).toList();
        return new InterviewDTO(
            interviewee.getId(),
            interviewee.getInterviewProcess() == null ? null : interviewee.getInterviewProcess().getId(),
            interviewee.getLastInvited(),
            interviewee.getRating(),
            HtmlSanitizer.sanitize(interviewee.getAssessmentNotes()),
            slots
        );
    }
}
