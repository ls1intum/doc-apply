package de.tum.cit.aet.job.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.application.constants.ApplicationState;
import de.tum.cit.aet.core.dto.UiTextFormatter;
import de.tum.cit.aet.job.constants.Campus;
import de.tum.cit.aet.job.constants.RecommendationType;
import de.tum.cit.aet.job.constants.SubjectArea;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record JobCardDTO(
    @NotNull UUID jobId,
    @NotNull String title,
    @NotNull Campus location,
    @NotNull String professorName,
    @NotNull SubjectArea subjectArea,
    String avatar,
    UUID applicationId,
    ApplicationState applicationState,
    Integer workload,
    LocalDate startDate,
    String relativeTimeEnglish,
    String relativeTimeGerman,
    Integer contractDuration,
    Integer referenceLettersRequired,
    RecommendationType recommendationType,
    String imageUrl // Job banner image URL (e.g., "/images/jobs/abc.jpg")
) {
    public JobCardDTO(
        @NotNull UUID jobId,
        @NotNull String title,
        @NotNull Campus location,
        @NotNull String professorName,
        @NotNull SubjectArea subjectArea,
        String avatar,
        UUID applicationId,
        ApplicationState applicationState,
        Integer workload,
        LocalDate startDate,
        LocalDate endDate,
        Integer contractDuration,
        Integer referenceLettersRequired,
        RecommendationType recommendationType,
        String imageUrl
    ) {
        this(
            jobId,
            title,
            location,
            professorName,
            subjectArea,
            avatar,
            applicationId,
            applicationState,
            workload,
            startDate,
            UiTextFormatter.getTimeLeftLabelEnglish(endDate),
            UiTextFormatter.getTimeLeftLabelGerman(endDate),
            contractDuration,
            referenceLettersRequired,
            recommendationType,
            imageUrl
        );
    }
}
