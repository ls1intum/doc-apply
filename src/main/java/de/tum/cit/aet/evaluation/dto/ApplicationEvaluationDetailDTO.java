package de.tum.cit.aet.evaluation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.application.domain.dto.ApplicationDetailDTO;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.usermanagement.dto.ProfessorDTO;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record ApplicationEvaluationDetailDTO(
    @NotNull ApplicationDetailDTO applicationDetailDTO,
    ProfessorDTO professor,
    UUID jobId,
    LocalDateTime appliedAt,
    Double averageRating,
    Integer ratingCount
) {
    /**
     * Creates an {@link ApplicationEvaluationDetailDTO} from the given
     * {@link Application} entity.
     *
     * @param application the {@link Application} entity
     * @return a new {@link ApplicationEvaluationDetailDTO} populated from the
     *         application data
     */
    public static ApplicationEvaluationDetailDTO fromApplication(Application application) {
        Job job = application.getJob();
        return new ApplicationEvaluationDetailDTO(
            ApplicationDetailDTO.getFromEntity(application, job),
            ProfessorDTO.fromJob(job),
            job.getJobId(),
            application.getAppliedAt(),
            null,
            null
        );
    }

    /**
     * Creates a new DTO with the given rating summary applied.
     *
     * @param summary the aggregated rating summary
     * @return a new DTO carrying the summary's average and count
     */
    public ApplicationEvaluationDetailDTO withRatingSummary(RatingSummary summary) {
        return new ApplicationEvaluationDetailDTO(
            this.applicationDetailDTO,
            this.professor,
            this.jobId,
            this.appliedAt,
            summary.average(),
            summary.count()
        );
    }
}
