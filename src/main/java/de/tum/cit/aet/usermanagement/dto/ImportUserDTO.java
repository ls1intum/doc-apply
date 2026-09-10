package de.tum.cit.aet.usermanagement.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.usermanagement.constants.UserRole;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

/**
 * Request body for importing an existing TUM member from Keycloak.
 *
 * @param universityId    the university ID (LDAP_ID) of the Keycloak user to import
 * @param role            optional role to assign once the user is linked; omit to leave the roles
 *                        the user already holds untouched
 * @param researchGroupId the research group the role is held in; required for PROFESSOR and
 *                        EMPLOYEE, and rejected for any other role
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record ImportUserDTO(@NotBlank String universityId, UserRole role, UUID researchGroupId) {}
