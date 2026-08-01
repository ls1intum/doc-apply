package de.tum.cit.aet.usermanagement.dto;

import de.tum.cit.aet.usermanagement.constants.UserRole;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.domain.UserResearchGroupRole;
import java.util.List;
import java.util.UUID;
import lombok.Data;

/**
 * A minimal representation of a user for lightweight API responses.
 */
@Data
public class UserShortDTO {

    private UUID userId;
    private String universityId;
    private String email;
    private String avatar;
    private String firstName;
    private String lastName;
    private List<UserRole> roles;

    /**
     * Every PROFESSOR/EMPLOYEE research group the user is a member of.
     */
    private List<ResearchGroupShortDTO> memberships;

    public UserShortDTO() {}

    public UserShortDTO(User user) {
        this.userId = user.getUserId();
        this.universityId = user.getUniversityId();
        this.email = user.getEmail();
        this.avatar = user.getAvatar();
        this.firstName = user.getFirstName();
        this.lastName = user.getLastName();
        this.roles = user.getResearchGroupRoles().stream().map(UserResearchGroupRole::getRole).distinct().toList();
        this.memberships = user
            .getResearchGroupRoles()
            .stream()
            .filter(r -> r.getRole() == UserRole.PROFESSOR || r.getRole() == UserRole.EMPLOYEE)
            .map(UserResearchGroupRole::getResearchGroup)
            .filter(rg -> rg != null)
            .distinct()
            .map(ResearchGroupShortDTO::new)
            .toList();
    }
}
