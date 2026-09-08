package de.tum.cit.aet.usermanagement.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.usermanagement.constants.UserRole;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Request body for admin user edits. All fields optional. email, password and userId are not
 * updatable from this DTO, and neither is universityId: it marks an account as a TUM member, which
 * is decided by Keycloak rather than by an admin editing a form.
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record UpdateUserDTO(
    String firstName,
    String lastName,
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
