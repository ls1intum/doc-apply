package de.tum.cit.aet.core.domain;

import de.tum.cit.aet.usermanagement.constants.UserRole;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

public record CurrentUser(UUID userId, String email, String firstName, String lastName, List<ResearchGroupRole> researchGroupRoles) {
    public boolean isAdmin() {
        return researchGroupRoles.stream().anyMatch(r -> r.role() == UserRole.ADMIN);
    }

    public boolean isProfessor() {
        return researchGroupRoles.stream().anyMatch(r -> r.role() == UserRole.PROFESSOR);
    }

    public boolean isEmployee() {
        return researchGroupRoles.stream().anyMatch(r -> r.role() == UserRole.EMPLOYEE);
    }

    /**
     * Returns the ID of the first PROFESSOR-role research group the user belongs to,
     * or empty if the user is not a professor of any group.
     */
    public Optional<UUID> getResearchGroupIdIfProfessor() {
        return researchGroupRoles
            .stream()
            .filter(r -> r.role() == UserRole.PROFESSOR)
            .map(ResearchGroupRole::researchGroupId)
            .filter(Objects::nonNull)
            .findFirst();
    }

    /**
     * Returns the ID of the first PROFESSOR/EMPLOYEE-role research group the user belongs to,
     * or empty if the user is not a member of any group.
     */
    public Optional<UUID> getResearchGroupIdIfMember() {
        return researchGroupRoles
            .stream()
            .filter(r -> r.role() == UserRole.EMPLOYEE || r.role() == UserRole.PROFESSOR)
            .map(ResearchGroupRole::researchGroupId)
            .filter(Objects::nonNull)
            .findFirst();
    }

    /**
     * Returns true when the user holds a PROFESSOR or EMPLOYEE role in the given group.
     */
    public boolean isMemberOf(UUID researchGroupId) {
        if (researchGroupId == null) {
            return false;
        }
        return researchGroupRoles
            .stream()
            .anyMatch(
                r -> (r.role() == UserRole.EMPLOYEE || r.role() == UserRole.PROFESSOR) && researchGroupId.equals(r.researchGroupId())
            );
    }

    /**
     * Returns true when the user holds a PROFESSOR role in the given group.
     */
    public boolean isProfessorOf(UUID researchGroupId) {
        if (researchGroupId == null) {
            return false;
        }
        return researchGroupRoles.stream().anyMatch(r -> r.role() == UserRole.PROFESSOR && researchGroupId.equals(r.researchGroupId()));
    }

    /**
     * Returns the IDs of every research group the user is a PROFESSOR/EMPLOYEE of, in insertion order.
     */
    public List<UUID> memberResearchGroupIds() {
        return researchGroupRoles
            .stream()
            .filter(r -> r.role() == UserRole.EMPLOYEE || r.role() == UserRole.PROFESSOR)
            .map(ResearchGroupRole::researchGroupId)
            .filter(Objects::nonNull)
            .distinct()
            .toList();
    }
}
