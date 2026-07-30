package de.tum.cit.aet.usermanagement.service;

import de.tum.cit.aet.core.dto.PageDTO;
import de.tum.cit.aet.core.dto.SortDTO;
import de.tum.cit.aet.core.exception.EntityNotFoundException;
import de.tum.cit.aet.core.exception.OperationNotAllowedException;
import de.tum.cit.aet.core.retention.UserRetentionService;
import de.tum.cit.aet.core.service.CurrentUserService;
import de.tum.cit.aet.core.util.PageUtil;
import de.tum.cit.aet.core.util.StringUtil;
import de.tum.cit.aet.usermanagement.constants.UserRole;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.domain.UserResearchGroupRole;
import de.tum.cit.aet.usermanagement.dto.AdminUserDetailDTO;
import de.tum.cit.aet.usermanagement.dto.AdminUserOverviewDTO;
import de.tum.cit.aet.usermanagement.dto.CreateUserDTO;
import de.tum.cit.aet.usermanagement.dto.ImportUserDTO;
import de.tum.cit.aet.usermanagement.dto.KeycloakUserDTO;
import de.tum.cit.aet.usermanagement.dto.UpdateUserDTO;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Orchestrates Keycloak and local-DB user management for admins.
 * Provides list, detail, create, import, update, and delete operations
 * used by the "Manage Users" admin page.
 */
@Service
@RequiredArgsConstructor
public class UserAdminService {

    private final UserRepository userRepository;
    private final KeycloakUserService keycloakUserService;
    private final UserService userService;
    private final UserRetentionService userRetentionService;
    private final CurrentUserService currentUserService;

    /**
     * Returns a paginated, filterable, searchable list of users for the admin "Manage Users" view.
     *
     * @param pageDTO          pagination configuration
     * @param sortDTO          sorting configuration
     * @param roles            optional filter on roles; null/empty means no filter
     * @param researchGroupIds optional filter on research groups; null/empty means no filter
     * @param searchQuery      optional free-text search query (matched against name, email, universityId)
     * @return a page of admin user overview rows
     */
    public Page<AdminUserOverviewDTO> getAllUsersForAdmin(
        PageDTO pageDTO,
        SortDTO sortDTO,
        List<UserRole> roles,
        List<UUID> researchGroupIds,
        String searchQuery
    ) {
        Pageable pageable = PageUtil.createPageRequest(pageDTO, sortDTO, PageUtil.ColumnMapping.USERS_ADMIN, true);

        // 1) Page the matching user ids (sorting is on User columns only, so it can be applied here).
        Page<UUID> idPage = userRepository.findUserIdsForAdmin(
            (roles == null || roles.isEmpty()) ? null : roles,
            (researchGroupIds == null || researchGroupIds.isEmpty()) ? null : researchGroupIds,
            StringUtil.normalizeSearchQuery(searchQuery),
            pageable
        );
        List<UUID> ids = idPage.getContent();
        if (ids.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, idPage.getTotalElements());
        }

        // 2) Fetch the full role/group graph, then build each row in the paged order (the fetch query
        //    does not preserve it) — a user may belong to several groups, hence the two-query approach.
        Map<UUID, User> usersById = userRepository
            .findUsersWithRolesAndGroupsByIds(ids)
            .stream()
            .collect(Collectors.toMap(User::getUserId, Function.identity(), (first, second) -> first));
        List<AdminUserOverviewDTO> content = ids
            .stream()
            .map(usersById::get)
            .filter(Objects::nonNull)
            .map(UserAdminService::toOverviewDTO)
            .toList();
        return new PageImpl<>(content, pageable, idPage.getTotalElements());
    }

    /**
     * Maps a user (with roles and groups initialised) to an {@link AdminUserOverviewDTO}, deriving the
     * highest-privilege role and the primary (first PROFESSOR/EMPLOYEE) research group.
     *
     * @param user the user to map; its research-group roles and groups must be initialised
     * @return the overview row
     */
    private static AdminUserOverviewDTO toOverviewDTO(User user) {
        List<UserResearchGroupRole> roles = user.getResearchGroupRoles() == null ? List.of() : List.copyOf(user.getResearchGroupRoles());
        UserRole primaryRole = roles
            .stream()
            .map(UserResearchGroupRole::getRole)
            .max(Comparator.comparingInt(UserAdminService::priority))
            .orElse(null);
        ResearchGroup researchGroup = roles
            .stream()
            .filter(r -> r.getRole() == UserRole.PROFESSOR || r.getRole() == UserRole.EMPLOYEE)
            .map(UserResearchGroupRole::getResearchGroup)
            .filter(Objects::nonNull)
            .findFirst()
            .orElse(null);
        return new AdminUserOverviewDTO(
            user.getUserId(),
            user.getFirstName(),
            user.getLastName(),
            user.getEmail(),
            user.getAvatar(),
            user.getUniversityId(),
            primaryRole,
            researchGroup == null ? null : researchGroup.getResearchGroupId(),
            researchGroup == null ? null : researchGroup.getName(),
            user.getLastActivityAt()
        );
    }

    /**
     * Returns the full admin-scoped detail view for a single user.
     *
     * @param userId the user ID to look up
     * @return the populated detail DTO
     * @throws EntityNotFoundException if no user exists with the given ID
     */
    public AdminUserDetailDTO getUserDetail(UUID userId) {
        User user = userRepository
            .findWithResearchGroupRolesByUserId(userId)
            .orElseThrow(() -> EntityNotFoundException.forId("User", userId));
        UserRole primaryRole =
            user.getResearchGroupRoles() == null
                ? null
                : user
                      .getResearchGroupRoles()
                      .stream()
                      .map(r -> r.getRole())
                      .max(Comparator.comparingInt(UserAdminService::priority))
                      .orElse(null);
        // Derive the primary research group from the group-bound (PROFESSOR/EMPLOYEE) roles; the legacy
        // User.researchGroup column was replaced by the user_research_group_roles join table.
        ResearchGroup researchGroup =
            user.getResearchGroupRoles() == null
                ? null
                : user
                      .getResearchGroupRoles()
                      .stream()
                      .filter(r -> r.getRole() == UserRole.PROFESSOR || r.getRole() == UserRole.EMPLOYEE)
                      .map(r -> r.getResearchGroup())
                      .filter(rg -> rg != null)
                      .findFirst()
                      .orElse(null);
        UUID rgId = researchGroup == null ? null : researchGroup.getResearchGroupId();
        String rgName = researchGroup == null ? null : researchGroup.getName();
        return new AdminUserDetailDTO(
            user.getUserId(),
            user.getFirstName(),
            user.getLastName(),
            user.getEmail(),
            user.getAvatar(),
            user.getUniversityId(),
            primaryRole,
            rgId,
            rgName,
            user.getPhoneNumber(),
            user.getGender(),
            user.getNationality(),
            user.getBirthday(),
            user.getWebsite(),
            user.getLinkedinUrl(),
            user.getSelectedLanguage(),
            user.isAiFeaturesEnabled(),
            user.getCreatedAt(),
            user.getLastActivityAt()
        );
    }

    /**
     * Creates a new internally managed user with a local password, then applies any optional
     * DB-only fields. Admin-created users are always internal: TUM members authenticate through
     * Keycloak and are never written to it from here.
     *
     * @param dto the create-user payload
     * @return the new user's UUID
     * @throws OperationNotAllowedException if the email already belongs to an existing account
     */
    @Transactional
    public UUID create(CreateUserDTO dto) {
        // 1) Refuse to take over an existing account. provisionExternalUser resolves by email, so
        //    without this an admin could set a password on (and verify the email of) somebody else's
        //    account — including a TUM member, who must never gain password login.
        String normalizedEmail = StringUtil.normalize(dto.email(), true);
        if (userService.findByEmail(normalizedEmail).isPresent()) {
            throw new OperationNotAllowedException("A user with email " + normalizedEmail + " already exists.");
        }
        // 2) Provision the local user (fresh app-owned id, email marked verified).
        User user = userService.provisionExternalUser(normalizedEmail, dto.firstName(), dto.lastName());
        UUID userId = user.getUserId();
        // 3) Apply DB-only optional fields first, so a supplied universityId is visible to the
        //    password guard below rather than being written after it.
        applyOptionalCreateFields(userId, dto);
        // 4) Store the initial password as a BCrypt hash. Rejected for TUM members, who must be
        //    imported from Keycloak instead of created with a local password.
        if (!userService.setLocalPassword(userId.toString(), dto.password())) {
            throw new OperationNotAllowedException("Cannot set a local password for a TUM member. Import the user from Keycloak instead.");
        }
        // 5) Apply primary role assignment when supplied.
        if (dto.primaryRole() != null) {
            userService.setPrimaryRole(userId, dto.primaryRole(), dto.researchGroupId());
        }
        return userId;
    }

    /**
     * Imports an existing TUM member from Keycloak into the local DB by their university ID.
     * The identity is re-resolved from Keycloak rather than taken from the request, so a picked
     * entry cannot be used to fabricate a user. Nothing is written back to Keycloak.
     *
     * @param dto the import payload containing the university ID of the user to import
     * @return the imported user's UUID
     * @throws EntityNotFoundException if no Keycloak user exists with the given university ID
     */
    public UUID importFromKeycloak(ImportUserDTO dto) {
        KeycloakUserDTO kcUser = keycloakUserService
            .findUserByUniversityId(dto.universityId())
            .orElseThrow(() -> EntityNotFoundException.forId("KeycloakUser", dto.universityId()));
        User user = userService.upsertUser(kcUser.id().toString(), kcUser.email(), kcUser.firstName(), kcUser.lastName());
        // Carry the university id over so the imported row is recognisable as a TUM member.
        if (user.getUniversityId() == null && kcUser.universityId() != null) {
            user.setUniversityId(kcUser.universityId());
            userRepository.save(user);
        }
        return user.getUserId();
    }

    /**
     * Updates DB-only fields of an existing user. Email and userId are not mutable here;
     * password updates go through a separate endpoint.
     *
     * @param userId the user ID to update
     * @param dto    the update payload (any null field is left untouched)
     * @throws EntityNotFoundException if no user exists with the given ID
     */
    public void update(UUID userId, UpdateUserDTO dto) {
        if (dto.primaryRole() != null && userId.equals(currentUserService.getUserId())) {
            throw new OperationNotAllowedException("Admins cannot change their own role.");
        }
        User user = userRepository.findById(userId).orElseThrow(() -> EntityNotFoundException.forId("User", userId));
        if (dto.firstName() != null) {
            user.setFirstName(dto.firstName());
        }
        if (dto.lastName() != null) {
            user.setLastName(dto.lastName());
        }
        if (dto.universityId() != null) {
            user.setUniversityId(dto.universityId());
        }
        if (dto.phoneNumber() != null) {
            user.setPhoneNumber(dto.phoneNumber());
        }
        if (dto.gender() != null) {
            user.setGender(dto.gender());
        }
        if (dto.nationality() != null) {
            user.setNationality(dto.nationality());
        }
        if (dto.birthday() != null) {
            user.setBirthday(dto.birthday());
        }
        if (dto.website() != null) {
            user.setWebsite(dto.website());
        }
        if (dto.linkedinUrl() != null) {
            user.setLinkedinUrl(dto.linkedinUrl());
        }
        if (dto.selectedLanguage() != null) {
            user.setSelectedLanguage(dto.selectedLanguage());
        }
        if (dto.aiFeaturesEnabled() != null) {
            user.setAiFeaturesEnabled(dto.aiFeaturesEnabled());
        }
        if (dto.avatar() != null) {
            user.setAvatar(dto.avatar());
        }
        userRepository.save(user);
        if (dto.primaryRole() != null) {
            userService.setPrimaryRole(userId, dto.primaryRole(), dto.researchGroupId());
        }
    }

    /**
     * Deletes a user by anonymising their local-DB references. An admin cannot delete their own
     * account. TUM members are not removed from Keycloak: their identity is owned there and only
     * the local record is dropped, so a subsequent login re-provisions a fresh row.
     *
     * @param userId the user ID to delete
     * @throws OperationNotAllowedException if the caller targets their own account
     */
    public void delete(UUID userId) {
        UUID currentUserId = currentUserService.getUserId();
        if (userId.equals(currentUserId)) {
            throw new OperationNotAllowedException("Admins cannot delete their own account.");
        }
        userRetentionService.deleteUserByAdmin(userId);
    }

    /**
     * Applies the optional DB-only fields supplied during user creation.
     * Loads the freshly upserted user and writes only non-null values.
     *
     * @param userId the newly created user's ID
     * @param dto    the create payload (optional fields read here)
     */
    private void applyOptionalCreateFields(UUID userId, CreateUserDTO dto) {
        User user = userRepository.findById(userId).orElseThrow(() -> EntityNotFoundException.forId("User", userId));
        boolean changed = false;
        if (dto.universityId() != null) {
            user.setUniversityId(dto.universityId());
            changed = true;
        }
        if (dto.phoneNumber() != null) {
            user.setPhoneNumber(dto.phoneNumber());
            changed = true;
        }
        if (dto.gender() != null) {
            user.setGender(dto.gender());
            changed = true;
        }
        if (dto.nationality() != null) {
            user.setNationality(dto.nationality());
            changed = true;
        }
        if (dto.birthday() != null) {
            user.setBirthday(dto.birthday());
            changed = true;
        }
        if (dto.website() != null) {
            user.setWebsite(dto.website());
            changed = true;
        }
        if (dto.linkedinUrl() != null) {
            user.setLinkedinUrl(dto.linkedinUrl());
            changed = true;
        }
        if (dto.selectedLanguage() != null) {
            user.setSelectedLanguage(dto.selectedLanguage());
            changed = true;
        }
        if (changed) {
            userRepository.save(user);
        }
    }

    /**
     * Ranks roles so the highest-privilege role is selected as the user's primary role.
     *
     * @param role the role to rank
     * @return integer priority (higher means more privileged)
     */
    private static int priority(UserRole role) {
        return switch (role) {
            case ADMIN -> 3;
            case PROFESSOR -> 2;
            case EMPLOYEE -> 1;
            case APPLICANT -> 0;
        };
    }
}
