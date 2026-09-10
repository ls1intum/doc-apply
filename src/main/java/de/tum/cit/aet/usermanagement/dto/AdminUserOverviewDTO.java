package de.tum.cit.aet.usermanagement.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.usermanagement.constants.UserRole;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Row-level admin user listing DTO for the "Manage Users" page table.
 *
 * @param userId            the Keycloak / local user UUID
 * @param firstName         the user's given name
 * @param lastName          the user's family name
 * @param email             the user's email
 * @param avatar            URL of the user's avatar (optional)
 * @param universityId      the TUM identifier (optional)
 * @param primaryRole       the highest-privilege role across the user's research-group roles
 * @param researchGroupId   id of the user's primary research group (optional)
 * @param researchGroupName name of that research group (optional)
 * @param lastActivityAt    last activity timestamp (optional)
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record AdminUserOverviewDTO(
    @NotNull UUID userId,
    String firstName,
    String lastName,
    String email,
    String avatar,
    String universityId,
    UserRole primaryRole,
    UUID researchGroupId,
    String researchGroupName,
    LocalDateTime lastActivityAt
) {}
