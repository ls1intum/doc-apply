package de.tum.cit.aet.job.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.ai.domain.ComplianceIssue;
import de.tum.cit.aet.core.exception.EntityNotFoundException;
import de.tum.cit.aet.core.util.HtmlSanitizer;
import de.tum.cit.aet.job.constants.*;
import de.tum.cit.aet.job.domain.Job;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record JobFormDTO(
    UUID jobId,
    @NotNull String title,
    String researchArea,
    @NotNull SubjectArea subjectArea,
    @NotNull UUID supervisingProfessor,
    @NotNull Campus location,
    LocalDate startDate,
    LocalDate endDate,
    Integer workload,
    Integer contractDuration,
    FundingType fundingType,
    TvlGrade tvlGrade,
    Integer referenceLettersRequired,
    RecommendationType recommendationType,
    String jobDescriptionEN,
    String jobDescriptionDE,
    @NotNull JobState state,
    UUID imageId, // Optional job banner image
    Boolean suitableForDisabled, // Position suitable for persons with severe disabilities
    Boolean startDateByArrangement, // Start date is to be agreed upon individually
    Integer genderBiasScore,
    List<ComplianceIssue> complianceIssues
) {
    /**
     * Converts a Job entity to a form DTO.
     * Job description fields are sanitized on read as defense-in-depth
     * before sending to the client.
     *
     * @param job the job entity to convert
     * @return a JobFormDTO containing the data from the job entity
     */
    public static JobFormDTO getFromEntity(Job job) {
        if (job == null) {
            throw new EntityNotFoundException("Cannot convert non-existent Job entity to JobFormDTO");
        }

        return new JobFormDTO(
            job.getJobId(),
            job.getTitle(),
            job.getResearchArea(),
            job.getSubjectArea(),
            job.getSupervisingProfessor().getUserId(),
            job.getLocation(),
            job.getStartDate(),
            job.getEndDate(),
            job.getWorkload(),
            job.getContractDuration(),
            job.getFundingType(),
            job.getTvlGrade(),
            job.getReferenceLettersRequired(),
            job.getRecommendationType(),
            HtmlSanitizer.sanitize(job.getJobDescriptionEN()),
            HtmlSanitizer.sanitize(job.getJobDescriptionDE()),
            job.getState(),
            job.getImage() != null ? job.getImage().getImageId() : null,
            job.getSuitableForDisabled(),
            job.getStartDateByArrangement(),
            job.getGenderBiasScore(),
            job.getComplianceIssues()
        );
    }
}
