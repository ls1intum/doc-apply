package de.tum.cit.aet.usermanagement.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.usermanagement.constants.UserRole;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Request body for admin user edits. All fields optional. `email`, `password`,
 * and `userId` are not updatable from this DTO.
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record UpdateUserDTO(
    String firstName,
    String lastName,
    String universityId,
    String phoneNumber,
    String gender,
    String nationality,
    LocalDate birthday,
    String website,
    String linkedinUrl,
    String selectedLanguage,
    Boolean aiFeaturesEnabled,
    String avatar,
    UserRole primaryRole,
    UUID researchGroupId
) {}
