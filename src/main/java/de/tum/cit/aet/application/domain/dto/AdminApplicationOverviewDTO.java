package de.tum.cit.aet.application.domain.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.application.constants.ApplicationState;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Admin-scoped application summary used by the "All Applications" page.
 *
 * @param applicationId            unique identifier of the application
 * @param applicantUserId          the applicant's user id
 * @param applicantName            the applicant's display name
 * @param applicantAvatar          URL of the applicant's avatar (optional)
 * @param jobId                    the job the application is for
 * @param jobTitle                 title of that job
 * @param researchGroupId          id of the research group that owns the job
 * @param researchGroupName        display name of the research group
 * @param supervisingProfessorId   the supervising professor's user id
 * @param supervisingProfessorName the supervising professor's display name
 * @param state                    current application state
 * @param createdAt                creation timestamp
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record AdminApplicationOverviewDTO(
    @NotNull UUID applicationId,
    @NotNull UUID applicantUserId,
    String applicantName,
    String applicantAvatar,
    @NotNull UUID jobId,
    String jobTitle,
    UUID researchGroupId,
    String researchGroupName,
    UUID supervisingProfessorId,
    String supervisingProfessorName,
    ApplicationState state,
    LocalDateTime createdAt
) {}
