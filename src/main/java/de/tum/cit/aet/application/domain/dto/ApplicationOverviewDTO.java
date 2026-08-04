package de.tum.cit.aet.application.domain.dto;

import de.tum.cit.aet.application.constants.ApplicationState;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ApplicationOverviewDTO {

    private UUID applicationId;
    private UUID jobId;
    private String jobTitle;
    private String researchGroup;
    private ApplicationState applicationState;
    private LocalDateTime createdAt;
    private boolean recommendationMissing;

    public ApplicationOverviewDTO(
        UUID applicationId,
        UUID jobId,
        String jobTitle,
        String researchGroup,
        ApplicationState applicationState,
        LocalDateTime createdAt,
        boolean recommendationMissing
    ) {
        this.applicationId = applicationId;
        this.jobId = jobId;
        this.jobTitle = jobTitle;
        this.researchGroup = researchGroup;
        this.applicationState = applicationState;
        this.createdAt = createdAt;
        this.recommendationMissing = recommendationMissing;
    }
}
