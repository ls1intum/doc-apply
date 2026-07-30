package de.tum.cit.aet.usermanagement.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.usermanagement.constants.UserRole;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/** Full admin-scoped user detail DTO returned by the view / edit page. */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record AdminUserDetailDTO(
    @NotNull UUID userId,
    String firstName,
    String lastName,
    String email,
    String avatar,
    String universityId,
    UserRole primaryRole,
    UUID researchGroupId,
    String researchGroupName,
    String phoneNumber,
    String gender,
    String nationality,
    LocalDate birthday,
    String website,
    String linkedinUrl,
    String selectedLanguage,
    Boolean aiFeaturesEnabled,
    LocalDateTime createdAt,
    LocalDateTime lastActivityAt
) {}
