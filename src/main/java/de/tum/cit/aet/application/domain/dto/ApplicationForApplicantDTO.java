package de.tum.cit.aet.application.domain.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.application.constants.ApplicationState;
import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.core.util.HtmlSanitizer;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.job.dto.JobCardDTO;
import de.tum.cit.aet.reference.dto.ReferenceRequestDTO;
import de.tum.cit.aet.usermanagement.dto.ApplicantDTO;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record ApplicationForApplicantDTO(
    UUID applicationId,
    ApplicantDTO applicant,
    @NotNull JobCardDTO job,
    @NotNull ApplicationState applicationState,
    LocalDate desiredDate,
    String projects,
    String specialSkills,
    String motivation,
    boolean referenceLettersConfidential,
    List<ReferenceRequestDTO> references
) {
    /**
     * Builds the DTO without references. The reference list is loaded separately from the scalar
     * application data (the JPQL constructor projections and the entity mapper cannot build it inline),
     * so this constructor defaults it to an empty list and callers attach it afterwards.
     */
    public ApplicationForApplicantDTO(
        UUID applicationId,
        ApplicantDTO applicant,
        JobCardDTO job,
        ApplicationState applicationState,
        LocalDate desiredDate,
        String projects,
        String specialSkills,
        String motivation,
        boolean referenceLettersConfidential
    ) {
        this(
            applicationId,
            applicant,
            job,
            applicationState,
            desiredDate,
            projects,
            specialSkills,
            motivation,
            referenceLettersConfidential,
            List.of()
        );
    }

    /**
     * Returns a copy of this DTO carrying the given reference requests.
     *
     * @param references the reference requests attached to the application
     * @return a new DTO identical to this one but with the given references
     */
    public ApplicationForApplicantDTO withReferences(List<ReferenceRequestDTO> references) {
        return new ApplicationForApplicantDTO(
            applicationId,
            applicant,
            job,
            applicationState,
            desiredDate,
            projects,
            specialSkills,
            motivation,
            referenceLettersConfidential,
            references
        );
    }

    /**
     * Converts an Application entity to a DTO for the applicant view.
     * Rich-text fields (projects, specialSkills, motivation) are sanitized on read
     * as defense-in-depth before sending to the client.
     *
     * @param application the application entity
     * @return the DTO, or null if the application is null
     */
    public static ApplicationForApplicantDTO getFromEntity(Application application) {
        if (application == null) {
            return null;
        }
        Job job = application.getJob();
        return new ApplicationForApplicantDTO(
            application.getApplicationId(),
            ApplicantDTO.getFromApplicationSnapshot(application),
            new JobCardDTO(
                job.getJobId(),
                job.getTitle(),
                job.getLocation(),
                job.getSupervisingProfessor().getLastName(),
                job.getSubjectArea(),
                job.getSupervisingProfessor().getAvatar(),
                application.getApplicationId(),
                application.getState(),
                job.getWorkload(),
                job.getStartDate(),
                job.getEndDate(),
                job.getContractDuration(),
                job.getReferenceLettersRequired(),
                job.getRecommendationType(),
                job.getImage() != null ? job.getImage().getUrl() : null
            ),
            application.getState(),
            application.getDesiredStartDate(),
            HtmlSanitizer.sanitize(application.getProjects()),
            HtmlSanitizer.sanitize(application.getSpecialSkills()),
            HtmlSanitizer.sanitize(application.getMotivation()),
            application.isReferenceLettersConfidential()
        );
    }
}
