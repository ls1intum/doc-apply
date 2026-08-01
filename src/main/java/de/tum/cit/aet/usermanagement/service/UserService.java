package de.tum.cit.aet.usermanagement.service;

import de.tum.cit.aet.core.dto.PageDTO;
import de.tum.cit.aet.core.dto.PageResponseDTO;
import de.tum.cit.aet.core.exception.EntityNotFoundException;
import de.tum.cit.aet.core.service.ImageService;
import de.tum.cit.aet.core.util.StringUtil;
import de.tum.cit.aet.usermanagement.constants.UserRole;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.domain.UserResearchGroupRole;
import de.tum.cit.aet.usermanagement.dto.UserShortDTO;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import de.tum.cit.aet.usermanagement.repository.UserResearchGroupRoleRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Supplier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final UserResearchGroupRoleRepository userResearchGroupRoleRepository;
    private final ImageService imageService;
    private final PasswordEncoder passwordEncoder;
    private static final Duration LAST_ACTIVITY_UPDATE_THRESHOLD = Duration.ofHours(24);

    public UserService(
        UserRepository userRepository,
        UserResearchGroupRoleRepository userResearchGroupRoleRepository,
        ImageService imageService,
        PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.userResearchGroupRoleRepository = userResearchGroupRoleRepository;
        this.imageService = imageService;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Provisions a local (applicant) user identified by email, generating a fresh app-owned {@code userId}
     * for new users and reusing the existing id otherwise. Marks the email as verified, since this is only
     * called after an out-of-band proof of email ownership (OTP or a federated provider asserting a verified
     * email). Assigns the APPLICANT role when the user has no roles.
     *
     * @param email     the verified email address
     * @param firstName optional first name (only applied when creating the user)
     * @param lastName  optional last name (only applied when creating the user)
     * @return the managed {@link User}
     */
    @Transactional
    public User provisionExternalUser(String email, String firstName, String lastName) {
        Optional<User> existing = findByEmail(email);
        String userId = existing.map(user -> user.getUserId().toString()).orElseGet(() -> UUID.randomUUID().toString());
        User user = upsertUser(userId, email, firstName, lastName);
        if (!user.isEmailVerified()) {
            user.setEmailVerified(true);
            user = userRepository.save(user);
        }
        return user;
    }

    /**
     * Sets (or replaces) the local password for the given user, storing only a BCrypt hash.
     *
     * @param userId      the user id (UUID string)
     * @param rawPassword the new plaintext password
     * @return {@code true} if the password was updated, {@code false} if the input was blank
     */
    public boolean setLocalPassword(String userId, String rawPassword) {
        if (rawPassword == null || rawPassword.isBlank()) {
            return false;
        }
        User user = userRepository.findById(UUID.fromString(userId)).orElseThrow(() -> EntityNotFoundException.forId("User", userId));
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        userRepository.save(user);
        return true;
    }

    /**
     * Finds a user by their user ID.
     *
     * @param userId the user ID
     * @return the user entity
     * @throws EntityNotFoundException if no user is found
     */
    public User findById(String userId) {
        return userRepository.findById(UUID.fromString(userId)).orElseThrow(() -> EntityNotFoundException.forId("User", userId));
    }

    /**
     * Finds a user by email in a case-insensitive manner.
     * Returns an empty Optional on null/blank input or when no user exists.
     *
     * @param email raw email input
     * @return optional user
     */
    public Optional<User> findByEmail(String email) {
        String normalizedEmail = StringUtil.normalize(email, true);
        if (normalizedEmail.isBlank()) {
            return Optional.empty();
        }
        // Email is not globally unique (a TUM staff account and an applicant account may share one); return a
        // single deterministic match so a duplicate never turns a lookup into an IncorrectResultSize error.
        return userRepository.findTopByEmailIgnoreCaseOrderByCreatedAtAsc(normalizedEmail);
    }

    /**
     * Upserts a user in the database and assigns the APPLICANT role. Input values are normalized
     * (never null, may be blank); a missing user is created, otherwise only changed fields are
     * updated. firstName and lastName are set once during the initial Keycloak-driven creation
     * and then managed in the database independently of Keycloak. lastActivityAt is refreshed
     * when older than 24 hours, and the APPLICANT role is assigned when no roles are present.
     * Does not throw for blank names/emails — callers may validate earlier.
     *
     * @param keycloakUserId the Keycloak user ID to associate with the user
     * @param email          the user's email (can be null/blank)
     * @param firstName      optional first name from Keycloak (only used for new users)
     * @param lastName       optional last name from Keycloak (only used for new users)
     * @return the managed User entity
     */
    @Transactional
    public User upsertUser(String keycloakUserId, String email, String firstName, String lastName) {
        UUID userId = UUID.fromString(keycloakUserId);
        final String normalizedEmail = StringUtil.normalize(email, true);
        final String normalizedFirstName = StringUtil.normalize(firstName, false);
        final String normalizedLastName = StringUtil.normalize(lastName, false);

        Optional<User> existingUser = userRepository.findWithResearchGroupRolesByUserId(userId);
        final boolean isNewUser = existingUser.isEmpty();

        User user = existingUser.orElseGet(() -> createNewUser(userId, normalizedEmail, normalizedFirstName, normalizedLastName));

        boolean updated = isNewUser;
        updated |= setIfPresentAndChanged(user::getEmail, user::setEmail, normalizedEmail);
        // firstName and lastName are only set on user creation (from Keycloak initial values)
        // After that, they are managed independently in the database and not synced with Keycloak

        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        LocalDateTime cutoff = now.minus(LAST_ACTIVITY_UPDATE_THRESHOLD);

        if (user.getLastActivityAt() == null || user.getLastActivityAt().isBefore(cutoff)) {
            user.setLastActivityAt(now);
            updated = true;
        }

        if (updated) {
            user = userRepository.save(user);
        }

        assignApplicantRoleIfEmpty(user);
        return user;
    }

    /**
     * Updates the user's first and last name in the local database only.
     * Names are stored independently from Keycloak and can be changed by the user.
     *
     * @param userId    the Keycloak user ID
     * @param firstName the new first name
     * @param lastName  the new last name
     */
    @Transactional
    public void updateNames(String userId, String firstName, String lastName) {
        User user = userRepository.findById(UUID.fromString(userId)).orElseThrow(() -> EntityNotFoundException.forId("User", userId));

        String normalizedFirstName = StringUtil.normalize(firstName, false);
        String normalizedLastName = StringUtil.normalize(lastName, false);

        if (normalizedFirstName != null && !normalizedFirstName.isBlank()) {
            user.setFirstName(normalizedFirstName);
        }
        if (normalizedLastName != null && !normalizedLastName.isBlank()) {
            user.setLastName(normalizedLastName);
        }

        userRepository.save(user);
    }

    /**
     * Updates the user's avatar URL in the local database.
     *
     * @param userId    the Keycloak user ID
     * @param avatarUrl the new avatar URL (can be null/blank to remove avatar)
     */
    public void updateAvatar(String userId, String avatarUrl) {
        User user = userRepository.findById(UUID.fromString(userId)).orElseThrow(() -> EntityNotFoundException.forId("User", userId));
        String normalizedAvatarUrl = StringUtil.normalize(avatarUrl, false);
        if (normalizedAvatarUrl == null || normalizedAvatarUrl.isBlank()) {
            user.setAvatar(null);
        } else {
            imageService.assertUserOwnsProfilePictureUrl(user.getUserId(), normalizedAvatarUrl);
            user.setAvatar(normalizedAvatarUrl);
        }
        userRepository.save(user);
    }

    /**
     * Get every professor in the system, regardless of research group. Admin-only.
     *
     * @return list of all professors as {@link UserShortDTO}
     */
    public List<UserShortDTO> getAllProfessors() {
        List<UUID> userIds = userRepository.findAllProfessorUserIds();
        if (userIds.isEmpty()) {
            return List.of();
        }

        // Pass null for currentUserId so the result is alphabetically ordered without pinning the admin first.
        List<User> users = userRepository.findUsersWithRolesByIdsForResearchGroup(userIds, null);
        return users
            .stream()
            .map(UserShortDTO::new)
            .filter(dto -> dto.getRoles() != null && dto.getRoles().contains(UserRole.PROFESSOR))
            .toList();
    }

    /**
     * Retrieves all users eligible to be added to a research group. Excludes users already
     * associated with a research group and those with administrative privileges; each result
     * is mapped to {@link UserShortDTO} for selection or display. Uses a two-query approach to
     * avoid JOIN FETCH pagination issues: a first query pages user ids, a second fetches the
     * full user graph with eagerly loaded collections.
     *
     * @param pageDTO     pagination parameters including page number and size
     * @param searchQuery an optional search query to filter users by name or email
     * @return paginated response of non-admin users who are not currently assigned to any
     *         research group
     */
    public PageResponseDTO<UserShortDTO> getAvailableUsersForResearchGroup(PageDTO pageDTO, String searchQuery) {
        Pageable pageable = PageRequest.of(pageDTO.pageNumber(), pageDTO.pageSize());
        String normalizedSearchQuery = StringUtil.normalizeSearchQuery(searchQuery);

        Page<UUID> userIdsPage = userRepository.findAvailableUserIdsForResearchGroup(normalizedSearchQuery, pageable);

        if (userIdsPage.isEmpty()) {
            return new PageResponseDTO<>(List.of(), 0L);
        }

        List<User> users = userRepository.findUsersWithRolesByIds(userIdsPage.getContent());
        List<UserShortDTO> userDTOs = users.stream().map(UserShortDTO::new).toList();

        return new PageResponseDTO<>(userDTOs, userIdsPage.getTotalElements());
    }

    /**
     * Ensures the user has at least one role by assigning {@link UserRole APPLICANT} when none are present.
     *
     * @param user the managed user entity to update; must not be {@code null}
     */
    private void assignApplicantRoleIfEmpty(User user) {
        if (user.getResearchGroupRoles() == null || user.getResearchGroupRoles().isEmpty()) {
            UserResearchGroupRole defaultRole = new UserResearchGroupRole();
            defaultRole.setUser(user);
            defaultRole.setRole(UserRole.APPLICANT);
            userResearchGroupRoleRepository.save(defaultRole);
            user.getResearchGroupRoles().add(defaultRole);
        }
    }

    /**
     * Updates the AI consent setting for the given user.
     * Sets aiConsentedAt on first opt-in; preserves existing timestamp on subsequent toggles.
     *
     * @param userId    the user ID
     * @param aiFeaturesEnabled the new consent value
     */
    public void updateAiConsent(String userId, boolean aiFeaturesEnabled) {
        User user = findById(userId);
        user.setAiFeaturesEnabled(aiFeaturesEnabled);
        userRepository.save(user);
    }

    /**
     * Finds a user by id with their research-group roles eager-fetched, used by
     * request-scoped callers (e.g. CurrentUserService) that need the full role graph.
     *
     * @param userId the user id
     * @return the user with roles loaded, if present
     */
    public Optional<User> findWithRolesByUserId(UUID userId) {
        return userRepository.findWithResearchGroupRolesByUserId(userId);
    }

    /**
     * Sets {@code aiConsentedAt} to now on first AI usage. No-op when already recorded.
     *
     * @param user the managed user entity
     */
    public void markAiConsentIfMissing(User user) {
        if (user.getAiConsentedAt() != null) {
            return;
        }
        user.setAiConsentedAt(LocalDateTime.now());
        userRepository.save(user);
    }

    /**
     * Factory for a new {@link User} with normalized values.
     *
     * @param userId    the persistent user identifier (Keycloak UUID)
     * @param email     normalized email
     * @param firstName normalized first name
     * @param lastName  normalized last name
     * @return a new {@link User} instance
     */
    private User createNewUser(UUID userId, String email, String firstName, String lastName) {
        User newUser = new User();
        newUser.setUserId(userId);
        newUser.setEmail(email);
        newUser.setFirstName(firstName);
        newUser.setLastName(lastName);
        return newUser;
    }

    /**
     * Updates a string field if the proposed value is non-blank and different from the current value.     *
     *
     * @param getter   supplier of the current field value
     * @param setter   consumer used to set the new value
     * @param newValue the proposed new value; updates only when non-blank and not equal to the current value
     * @return {@code true} if the field was updated; {@code false} otherwise
     */
    private boolean setIfPresentAndChanged(Supplier<String> getter, Consumer<String> setter, String newValue) {
        if (newValue == null || newValue.isBlank()) {
            return false;
        }
        String current = getter.get();
        if (Objects.equals(current, newValue)) {
            return false;
        }
        setter.accept(newValue);
        return true;
    }
}
