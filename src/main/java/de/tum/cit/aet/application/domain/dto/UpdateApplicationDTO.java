package de.tum.cit.aet.application.domain.dto;

import de.tum.cit.aet.application.constants.ApplicationState;
import de.tum.cit.aet.usermanagement.dto.ApplicantDTO;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

public record UpdateApplicationDTO(
    @NotNull UUID applicationId,
    @NotNull ApplicantDTO applicant,
    LocalDate desiredDate,
    @NotNull ApplicationState applicationState,
    String projects,
    String specialSkills,
    String motivation,
    Boolean referenceLettersConfidential
) {}
