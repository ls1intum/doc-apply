package de.tum.cit.aet.usermanagement.web;

import de.tum.cit.aet.core.dto.PageDTO;
import de.tum.cit.aet.core.dto.PageResponseDTO;
import de.tum.cit.aet.core.security.annotations.Admin;
import de.tum.cit.aet.core.security.annotations.Authenticated;
import de.tum.cit.aet.core.security.annotations.ProfessorOrEmployeeOrAdmin;
import de.tum.cit.aet.core.service.AuthenticationService;
import de.tum.cit.aet.core.service.ImageService;
import de.tum.cit.aet.core.util.StringUtil;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.dto.KeycloakUserDTO;
import de.tum.cit.aet.usermanagement.dto.UpdateAvatarDTO;
import de.tum.cit.aet.usermanagement.dto.UpdatePasswordDTO;
import de.tum.cit.aet.usermanagement.dto.UpdateUserNameDTO;
import de.tum.cit.aet.usermanagement.dto.UserShortDTO;
import de.tum.cit.aet.usermanagement.service.KeycloakUserService;
import de.tum.cit.aet.usermanagement.service.KeycloakUserService.PagedResult;
import de.tum.cit.aet.usermanagement.service.UserService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserResource {

    private final AuthenticationService authenticationService;
    private final ImageService imageService;
    private final UserService userService;
    private final KeycloakUserService keycloakUserService;

    /**
     * Returns information about the currently authenticated user.
     * If the user does not exist yet, a new user is created and assigned a default role.
     *
     * @param jwt of the authenticated user
     * @return the user data as {@link UserShortDTO}, or an empty response if unauthenticated
     */
    @Authenticated
    @GetMapping("/me")
    public ResponseEntity<UserShortDTO> getCurrentUser(@AuthenticationPrincipal Jwt jwt) {
        log.info("GET /api/users/me - Retrieving current user for subject={}", jwt.getSubject());
        User user = authenticationService.provisionUserIfMissing(jwt);

        if (user == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(new UserShortDTO(user));
    }

    /**
     * Allows the currently authenticated user to update their first and last name.
     * Names are stored in the local database and are independent from Keycloak.
     *
     * @param jwt               of the authenticated user
     * @param updateUserNameDTO contains the new first and last name
     * @return 204 No Content if updated successfully
     */
    @Authenticated
    @PutMapping("/name")
    public ResponseEntity<Void> updateUserName(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UpdateUserNameDTO updateUserNameDTO) {
        log.info("PUT /api/users/name - Updating user name for subject={}", jwt.getSubject());
        userService.updateNames(jwt.getSubject(), updateUserNameDTO.firstName(), updateUserNameDTO.lastName());
        return ResponseEntity.noContent().build();
    }

    /**
     * Allows the currently authenticated user to set or change their local (in-app) password.
     * Passwords are stored as a BCrypt hash in the application database; TUM staff continue to authenticate
     * via login.tum.de and do not use this endpoint.
     *
     * @param jwt of the authenticated user
     * @param dto contains the new password
     * @return 204 No Content if updated successfully, 400 Bad Request if update fails
     */
    @Authenticated
    @PutMapping("/password")
    public ResponseEntity<Void> updatePassword(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UpdatePasswordDTO dto) {
        log.info("PUT /api/users/password - Updating password for subject={}", jwt.getSubject());
        boolean updated = userService.setLocalPassword(jwt.getSubject(), dto.newPassword());
        return updated ? ResponseEntity.noContent().build() : ResponseEntity.badRequest().build();
    }

    /**
     * Allows the currently authenticated user to update their avatar URL.
     * Non-empty values must point to a stored profile picture owned by the current user.
     *
     * @param jwt of the authenticated user
     * @param dto contains the new avatar URL (or null/blank to remove)
     * @return 204 No Content if updated successfully
     */
    @Authenticated
    @PutMapping("/avatar")
    public ResponseEntity<Void> updateAvatar(@AuthenticationPrincipal Jwt jwt, @RequestBody UpdateAvatarDTO dto) {
        String normalizedAvatarUrl = StringUtil.normalize(dto.avatarUrl(), false);
        log.info(
            "PUT /api/users/avatar - {} avatar for subject={}",
            normalizedAvatarUrl == null || normalizedAvatarUrl.isBlank() ? "Removing" : "Updating",
            jwt.getSubject()
        );
        if (normalizedAvatarUrl == null || normalizedAvatarUrl.isBlank()) {
            imageService.deleteCurrentUserProfilePicture();
        } else {
            imageService.assertCurrentUserOwnsProfilePictureUrl(normalizedAvatarUrl);
            userService.updateAvatar(jwt.getSubject(), normalizedAvatarUrl);
        }
        return ResponseEntity.noContent().build();
    }

    /**
     * Returns the AI consent status of the currently authenticated user.
     *
     * @param jwt of the authenticated user
     * @return the AI consent status
     */
    @Authenticated
    @GetMapping("/ai-consent")
    public ResponseEntity<Boolean> getAiConsent(@AuthenticationPrincipal Jwt jwt) {
        log.info("GET /api/users/ai-consent - Retrieving AI consent for subject={}", jwt.getSubject());
        User user = userService.findById(jwt.getSubject());
        return ResponseEntity.ok(user.isAiFeaturesEnabled());
    }

    /**
     * Updates the AI consent setting of the currently authenticated user.
     *
     * @param jwt of the authenticated user
     * @param aiFeaturesEnabled contains the new AI consent value
     * @return 204 No Content if updated successfully
     */
    @Authenticated
    @PutMapping("/ai-consent")
    public ResponseEntity<Void> updateAiConsent(@AuthenticationPrincipal Jwt jwt, @RequestBody Boolean aiFeaturesEnabled) {
        log.info("PUT /api/users/ai-consent - Updating AI features for subject={} to {}", jwt.getSubject(), aiFeaturesEnabled);
        userService.updateAiConsent(jwt.getSubject(), aiFeaturesEnabled);
        return ResponseEntity.noContent().build();
    }

    /**
     * Returns every professor in the system, for admin filter dropdowns.
     *
     * @return list of professors
     */
    @Admin
    @GetMapping("/professors")
    public ResponseEntity<List<UserShortDTO>> getAllProfessors() {
        log.info("GET /api/users/professors");
        return ResponseEntity.ok(userService.getAllProfessors());
    }

    /**
     * Retrieves a paginated list of users eligible to be added to a research group.
     *
     * @param pageDTO         pagination parameters
     * @param searchQuery     optional search query to filter users by name or email
     * @param researchGroupId optional target group id; when provided, users already holding
     *                        PROFESSOR/EMPLOYEE in that group are excluded so they can't be
     *                        re-added. Omit (or pass {@code null}) for admin flows that create
     *                        a new group and therefore have no target group yet.
     * @return paginated list of available users as {@link KeycloakUserDTO}
     */
    @ProfessorOrEmployeeOrAdmin
    @GetMapping("/available-for-research-group")
    public ResponseEntity<PageResponseDTO<KeycloakUserDTO>> getAvailableUsersForResearchGroup(
        @ParameterObject @Valid @ModelAttribute PageDTO pageDTO,
        @RequestParam(required = false) String searchQuery,
        @RequestParam(required = false) UUID researchGroupId
    ) {
        log.info("GET /api/users/available-for-research-group - searchQuery={}, researchGroupId={}", searchQuery, researchGroupId);
        PagedResult<KeycloakUserDTO> usersPage = keycloakUserService.getAvailableUsersForResearchGroup(
            searchQuery,
            pageDTO,
            researchGroupId
        );
        return ResponseEntity.ok(new PageResponseDTO<>(usersPage.content(), usersPage.total()));
    }
}
