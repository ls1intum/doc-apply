package de.tum.cit.aet.job.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.job.constants.JobState;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Admin-scoped job summary used by the "All Positions" page.
 *
 * @param jobId             unique identifier of the job
 * @param avatar            URL of the supervising professor's avatar (optional)
 * @param professorName     supervising professor's display name
 * @param professorId       supervising professor's user id
 * @param researchGroupId   id of the research group that owns the job
 * @param researchGroupName display name of the research group
 * @param state             current job state
 * @param title             job title
 * @param startDate         planned start date (optional)
 * @param createdAt         creation timestamp
 * @param lastModifiedAt    last-modification timestamp
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record AdminCreatedJobDTO(
    @NotNull UUID jobId,
    String avatar,
    String professorName,
    UUID professorId,
    UUID researchGroupId,
    String researchGroupName,
    JobState state,
    @NotNull String title,
    LocalDate startDate,
    LocalDateTime createdAt,
    LocalDateTime lastModifiedAt
) {}
