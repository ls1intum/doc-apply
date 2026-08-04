package de.tum.cit.aet.job.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.ai.domain.ComplianceIssue;
import de.tum.cit.aet.job.constants.Campus;
import de.tum.cit.aet.job.constants.FundingType;
import de.tum.cit.aet.job.constants.JobState;
import de.tum.cit.aet.job.constants.RecommendationType;
import de.tum.cit.aet.job.constants.SubjectArea;
import de.tum.cit.aet.job.constants.TvlGrade;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record JobDTO(
    @NotNull UUID jobId,
    @NotNull String title,
    String researchArea,
    SubjectArea subjectArea,
    @NotNull UUID supervisingProfessor,
    Campus location,
    LocalDate startDate,
    LocalDate endDate,
    Integer workload,
    Integer contractDuration,
    FundingType fundingType,
    TvlGrade tvlGrade,
    String jobDescriptionEN,
    String jobDescriptionDE,
    @NotNull JobState state,
    UUID imageId,
    String imageUrl,
    Boolean suitableForDisabled,
    Boolean startDateByArrangement,
    Integer referenceLettersRequired,
    RecommendationType recommendationType,
    Integer genderBiasScore,
    List<ComplianceIssue> complianceIssues
) {}
