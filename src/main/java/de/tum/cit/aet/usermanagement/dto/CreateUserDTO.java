package de.tum.cit.aet.usermanagement.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.usermanagement.constants.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Request body for admin user creation. Required fields are sent to Keycloak;
 * optional fields are stored only in the local DB.
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record CreateUserDTO(
    @NotBlank String firstName,
    @NotBlank String lastName,
    @NotBlank @Email String email,
    @NotBlank @Size(min = 8) String password,
    String universityId,
    String phoneNumber,
    String gender,
    String nationality,
    LocalDate birthday,
    String website,
    String linkedinUrl,
    String selectedLanguage,
    UserRole primaryRole,
    UUID researchGroupId
) {}
