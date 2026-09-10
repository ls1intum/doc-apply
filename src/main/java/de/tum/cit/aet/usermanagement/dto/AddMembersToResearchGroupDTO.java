package de.tum.cit.aet.usermanagement.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.usermanagement.constants.UserRole;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AddMembersToResearchGroupDTO(@NotEmpty List<KeycloakUserDTO> keycloakUsers, UUID researchGroupId, UserRole role) {
    /**
     * Returns the role to assign to the added members, defaulting to {@link UserRole#EMPLOYEE}
     * when no role was specified by the caller (back-compat).
     *
     * @return the resolved {@link UserRole}, never {@code null}
     */
    public UserRole roleOrDefault() {
        return role == null ? UserRole.EMPLOYEE : role;
    }
}
