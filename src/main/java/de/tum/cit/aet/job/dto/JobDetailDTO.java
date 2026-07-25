package de.tum.cit.aet.job.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.application.constants.ApplicationState;
import de.tum.cit.aet.job.constants.*;
import de.tum.cit.aet.usermanagement.dto.ResearchGroupSummaryDTO;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record JobDetailDTO(
    @NotNull UUID jobId,
    @NotNull String supervisingProfessorName,
    @NotNull ResearchGroupSummaryDTO researchGroup,
    @NotNull String title,
    @NotNull SubjectArea subjectArea,
    String researchArea,
    Campus location,
    Integer workload,
    Integer contractDuration,
    FundingType fundingType,
    TvlGrade tvlGrade,
    String jobDescriptionEN,
    String jobDescriptionDE,
    LocalDate startDate,
    LocalDate endDate,
    @NotNull LocalDateTime createdAt,
    @NotNull LocalDateTime lastModifiedAt,
    JobState state,
    UUID applicationId,
    ApplicationState applicationState,
    Boolean suitableForDisabled,
    Boolean startDateByArrangement,
    Integer referenceLettersRequired,
    RecommendationType recommendationType,
    UUID imageId // Job banner image ID for PDF export
) {}
