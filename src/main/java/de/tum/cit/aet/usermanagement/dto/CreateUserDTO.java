package de.tum.cit.aet.usermanagement.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.usermanagement.constants.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Request body for admin user creation. Every user created here is internally managed, so no
 * universityId is accepted: that marks an account as a TUM member, and TUM identities come from
 * Keycloak through the import endpoint rather than from a local form.
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record CreateUserDTO(
    @NotBlank String firstName,
    @NotBlank String lastName,
    @NotBlank @Email String email,
    @NotBlank @Size(min = 8) String password,
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
