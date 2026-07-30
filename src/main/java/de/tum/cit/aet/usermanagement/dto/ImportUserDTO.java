package de.tum.cit.aet.usermanagement.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;

/**
 * Request body for importing an existing TUM member from Keycloak.
 *
 * @param universityId the university ID (LDAP_ID) of the Keycloak user to import
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record ImportUserDTO(@NotBlank String universityId) {}
