package de.tum.cit.aet.usermanagement.service;

import de.tum.cit.aet.core.dto.PageDTO;
import de.tum.cit.aet.core.service.CurrentUserService;
import de.tum.cit.aet.core.util.StringUtil;
import de.tum.cit.aet.usermanagement.dto.KeycloakUserDTO;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.keycloak.OAuth2Constants;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.KeycloakBuilder;
import org.keycloak.representations.idm.CredentialRepresentation;
import org.keycloak.representations.idm.UserRepresentation;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Service for interacting with the Keycloak admin API and merging
 * Keycloak (LDAP/TUM) users with locally registered users.
 */
@Service
public class KeycloakUserService {

    public record PagedResult<T>(List<T> content, long total) {}

    private final CurrentUserService currentUserService;
    private final Keycloak tumKeycloak;
    private final String tumRealm;
    private final UserRepository userRepository;
    private static final int SAFETY_MAX = 1000;

    public KeycloakUserService(
        UserRepository userRepository,
        @Value("${keycloak.url}") String url,
        @Value("${keycloak.tum-login-realm}") String tumRealm,
        @Value("${keycloak.admin.tum.client-id}") String tumClientId,
        @Value("${keycloak.admin.tum.client-secret}") String tumClientSecret,
        CurrentUserService currentUserService
    ) {
        this.userRepository = userRepository;
        this.tumRealm = tumRealm;
        this.tumKeycloak = buildAdminClient(url, tumRealm, tumClientId, tumClientSecret);
        this.currentUserService = currentUserService;
    }

    /**
     * Retrieves users eligible to be added to a research group by merging
     * Keycloak LDAP users with locally registered (non-TUM) users.
     *
     * @param searchKey       search key for user query
     * @param pageDTO         pagination parameters
     * @param researchGroupId target research group; when {@code null}, the per-group exclusion is
     *                        skipped (admin flows that have no target group yet)
     * @return paginated list of available users and the total count before pagination
     */
    public PagedResult<KeycloakUserDTO> getAvailableUsersForResearchGroup(String searchKey, PageDTO pageDTO, UUID researchGroupId) {
        // 1) Search Keycloak for TUM/LDAP users
        List<KeycloakUserDTO> keycloakUsers = searchTumUsers(searchKey, true);

        // 2) Search local DB for available users (including non-TUM)
        List<KeycloakUserDTO> localUsers = userRepository
            .searchAvailableUsersForResearchGroup(searchKey, researchGroupId)
            .stream()
            .filter(user -> !currentUserService.isCurrentUser(user.getUserId()))
            .map(KeycloakUserDTO::fromUser)
            .toList();

        // 3) Merge and deduplicate (Keycloak results take priority)
        List<KeycloakUserDTO> merged = mergeAndDeduplicate(keycloakUsers, localUsers);

        // 4) Filter out users already assigned to the target research group (if any)
        List<KeycloakUserDTO> availableUsers = filterOutAssignedUsers(merged, researchGroupId);

        // 5) Paginate
        return new PagedResult<>(paginate(pageDTO, availableUsers), availableUsers.size());
    }

    /**
     * Finds a Keycloak user by university ID (LDAP_ID), case-insensitive.
     *
     * @param universityId university ID to search for
     * @return matching Keycloak user if present
     */
    public Optional<KeycloakUserDTO> findUserByUniversityId(String universityId) {
        String normalizedUniversityId = StringUtil.normalize(universityId, false);
        if (normalizedUniversityId.isBlank()) {
            return Optional.empty();
        }

        return searchTumUsers(normalizedUniversityId, false)
            .stream()
            .filter(user -> user.universityId() != null && user.universityId().equalsIgnoreCase(normalizedUniversityId))
            .findFirst();
    }

    /**
     * Searches Keycloak for LDAP-backed (TUM) users matching the given search key.
     */
    private List<KeycloakUserDTO> searchTumUsers(String searchKey, boolean excludeCurrentUser) {
        List<UserRepresentation> users = tumKeycloak.realm(tumRealm).users().search(searchKey, 0, SAFETY_MAX);
        if (users == null || users.isEmpty()) {
            return List.of();
        }

        return users
            .stream()
            .filter(KeycloakUserService::isLDAPUser)
            .filter(user -> !excludeCurrentUser || !isCurrentLdapUser(user))
            .map(KeycloakUserDTO::fromLdapUser)
            .toList();
    }

    /**
     * Checks whether the given LDAP user matches the currently authenticated user
     * by comparing the LDAP_ID attribute against the current user's universityId.
     */
    private boolean isCurrentLdapUser(UserRepresentation user) {
        String currentUniversityId = currentUserService.getUser().getUniversityId();
        if (currentUniversityId == null || currentUniversityId.isBlank()) {
            return false;
        }

        Map<String, List<String>> attributes = user.getAttributes();
        if (attributes == null) {
            return false;
        }
        List<String> ldapIds = attributes.get("LDAP_ID");
        if (ldapIds == null || ldapIds.isEmpty()) {
            return false;
        }

        return currentUniversityId.equalsIgnoreCase(ldapIds.getFirst());
    }

    /**
     * Merges Keycloak and local user lists, deduplicating by userId.
     * Keycloak entries take priority since they contain richer LDAP data.
     */
    private List<KeycloakUserDTO> mergeAndDeduplicate(List<KeycloakUserDTO> keycloakUsers, List<KeycloakUserDTO> localUsers) {
        Map<UUID, KeycloakUserDTO> merged = new LinkedHashMap<>();
        for (KeycloakUserDTO user : keycloakUsers) {
            merged.put(user.id(), user);
        }
        for (KeycloakUserDTO user : localUsers) {
            merged.putIfAbsent(user.id(), user);
        }
        return new ArrayList<>(merged.values());
    }

    /**
     * Filters out users that are already assigned to the given research group.
     * Uses universityId for TUM users and userId for non-TUM users.
     * When {@code researchGroupId} is {@code null}, no users are excluded (the repository
     * queries return empty sets so the lookup is effectively a no-op).
     */
    private List<KeycloakUserDTO> filterOutAssignedUsers(List<KeycloakUserDTO> users, UUID researchGroupId) {
        if (researchGroupId == null) {
            return users;
        }

        // 1) Collect and check universityId-based assignments (TUM users)
        List<String> candidateUniversityIds = users
            .stream()
            .map(KeycloakUserDTO::universityId)
            .filter(universityId -> universityId != null && !universityId.isBlank())
            .map(String::toLowerCase)
            .distinct()
            .toList();

        Set<String> assignedUniversityIds = candidateUniversityIds.isEmpty()
            ? Set.of()
            : new HashSet<>(userRepository.findAssignedUniversityIdsIn(candidateUniversityIds, researchGroupId));

        // 2) Collect and check userId-based assignments (non-TUM users)
        List<UUID> candidateUserIds = users
            .stream()
            .filter(user -> user.universityId() == null || user.universityId().isBlank())
            .map(KeycloakUserDTO::id)
            .distinct()
            .toList();

        Set<UUID> assignedUserIds = candidateUserIds.isEmpty()
            ? Set.of()
            : new HashSet<>(userRepository.findAssignedUserIdsIn(candidateUserIds, researchGroupId));

        // 3) Filter out assigned users
        return users
            .stream()
            .filter(user -> {
                if (user.universityId() != null && !user.universityId().isBlank()) {
                    return !assignedUniversityIds.contains(user.universityId().toLowerCase());
                }
                return !assignedUserIds.contains(user.id());
            })
            .toList();
    }

    private List<KeycloakUserDTO> paginate(PageDTO pageDTO, List<KeycloakUserDTO> users) {
        int start = pageDTO.pageNumber() * pageDTO.pageSize();
        if (start >= users.size()) {
            return List.of();
        }
        int end = Math.min(start + pageDTO.pageSize(), users.size());
        return users.subList(start, end);
    }

    private static boolean isLDAPUser(UserRepresentation user) {
        Map<String, List<String>> attributes = user.getAttributes();
        if (attributes == null) {
            return false;
        }
        List<String> values = attributes.get("LDAP_ID");
        return values != null && !values.isEmpty();
    }

    /**
     * Lists Keycloak credentials for the user in the TUM realm.
     *
     * @param userId the Keycloak user ID
     * @return credentials registered for the user, or an empty list when the user cannot be resolved
     */
    public List<CredentialRepresentation> getCredentials(String userId) {
        if (userId == null || userId.isBlank()) {
            return List.of();
        }
        RealmAdminContext adminContext = resolveAdminContext();
        List<CredentialRepresentation> credentials = adminContext.keycloak().realm(adminContext.realm()).users().get(userId).credentials();
        return credentials != null ? credentials : List.of();
    }

    /**
     * Removes one Keycloak credential for the user in the TUM realm.
     *
     * @param userId       the Keycloak user ID
     * @param credentialId the Keycloak credential ID to remove
     */
    public void removeCredential(String userId, String credentialId) {
        if (userId == null || userId.isBlank() || credentialId == null || credentialId.isBlank()) {
            return;
        }
        RealmAdminContext adminContext = resolveAdminContext();
        adminContext.keycloak().realm(adminContext.realm()).users().get(userId).removeCredential(credentialId);
    }

    private Keycloak buildAdminClient(String url, String realm, String clientId, String clientSecret) {
        return KeycloakBuilder.builder()
            .serverUrl(url)
            .realm(realm)
            .grantType(OAuth2Constants.CLIENT_CREDENTIALS)
            .clientId(clientId)
            .clientSecret(clientSecret)
            .build();
    }

    /**
     * All Keycloak credential operations target the TUM realm; applicant passkeys are handled in-app and no
     * longer use Keycloak.
     */
    private RealmAdminContext resolveAdminContext() {
        return new RealmAdminContext(tumKeycloak, tumRealm);
    }

    private record RealmAdminContext(Keycloak keycloak, String realm) {}
}
