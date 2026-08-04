package de.tum.cit.aet.usermanagement.dto;

import de.tum.cit.aet.usermanagement.constants.UserRole;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import java.time.LocalDate;
import java.util.UUID;

/**
 * DTO for {@link User}
 */
public record UserDTO(
    UUID userId,
    String email,
    String avatar,
    String firstName,
    String lastName,
    String gender,
    String nationality,
    LocalDate birthday,
    String phoneNumber,
    String website,
    String linkedinUrl,
    String selectedLanguage,
    ResearchGroupShortDTO researchGroupShortDTO
) {
    /**
     * @param user
     * @return The userDTO from the user
     */
    public static UserDTO getFromEntity(User user) {
        if (user == null) {
            return null;
        }
        ResearchGroup primaryGroup = user
            .getResearchGroupRoles()
            .stream()
            .filter(role -> role.getRole() == UserRole.PROFESSOR || role.getRole() == UserRole.EMPLOYEE)
            .map(role -> role.getResearchGroup())
            .filter(rg -> rg != null)
            .findFirst()
            .orElse(null);
        ResearchGroupShortDTO researchGroupShortDTO = primaryGroup != null ? new ResearchGroupShortDTO(primaryGroup) : null;
        return new UserDTO(
            user.getUserId(),
            user.getEmail(),
            user.getAvatar(),
            user.getFirstName(),
            user.getLastName(),
            user.getGender(),
            user.getNationality(),
            user.getBirthday(),
            user.getPhoneNumber(),
            user.getWebsite(),
            user.getLinkedinUrl(),
            user.getSelectedLanguage(),
            researchGroupShortDTO
        );
    }
}
