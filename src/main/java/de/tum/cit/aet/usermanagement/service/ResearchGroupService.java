package de.tum.cit.aet.usermanagement.service;

import de.tum.cit.aet.core.constants.Language;
import de.tum.cit.aet.core.dto.PageDTO;
import de.tum.cit.aet.core.dto.PageResponseDTO;
import de.tum.cit.aet.core.dto.SortDTO;
import de.tum.cit.aet.core.exception.AccessDeniedException;
import de.tum.cit.aet.core.exception.AlreadyMemberOfResearchGroupException;
import de.tum.cit.aet.core.exception.BadRequestException;
import de.tum.cit.aet.core.exception.EntityNotFoundException;
import de.tum.cit.aet.core.exception.ResourceAlreadyExistsException;
import de.tum.cit.aet.core.service.CurrentUserService;
import de.tum.cit.aet.core.util.HtmlSanitizer;
import de.tum.cit.aet.core.util.PageUtil;
import de.tum.cit.aet.core.util.StringUtil;
import de.tum.cit.aet.notification.constants.EmailType;
import de.tum.cit.aet.notification.dto.ResearchGroupEmailContextDTO;
import de.tum.cit.aet.notification.service.AsyncEmailSender;
import de.tum.cit.aet.notification.service.mail.Email;
import de.tum.cit.aet.usermanagement.constants.ResearchGroupState;
import de.tum.cit.aet.usermanagement.constants.UserRole;
import de.tum.cit.aet.usermanagement.domain.Department;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.domain.UserResearchGroupRole;
import de.tum.cit.aet.usermanagement.dto.*;
import de.tum.cit.aet.usermanagement.repository.DepartmentRepository;
import de.tum.cit.aet.usermanagement.repository.ResearchGroupRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import de.tum.cit.aet.usermanagement.repository.UserResearchGroupRoleRepository;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service for managing research groups.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResearchGroupService {

    private final UserRepository userRepository;
    private final CurrentUserService currentUserService;
    private final ResearchGroupRepository researchGroupRepository;
    private final DepartmentRepository departmentRepository;

    private final UserResearchGroupRoleRepository userResearchGroupRoleRepository;
    private final KeycloakUserService keycloakUserService;
    private final AsyncEmailSender emailSender;

    @Value("${aet.contact-email:docapply.aet@xcit.tum.de}")
    private String supportEmail;

    @Value("${aet.environment:}")
    private String environmentName;

    /**
     * Get all members of the current user's research group.
     *
     * @param pageDTO pagination information
     * @return paginated list of research group members
     */
    public PageResponseDTO<UserShortDTO> getResearchGroupMembers(PageDTO pageDTO) {
        // Get the current user's research group ID
        UUID researchGroupId = currentUserService.getResearchGroupIdIfMember();

        Pageable pageable = PageRequest.of(pageDTO.pageNumber(), pageDTO.pageSize());

        // First query: Get paginated user IDs to avoid N+1 query problem
        Page<UUID> userIdsPage = userRepository.findUserIdsByResearchGroupId(researchGroupId, pageable);

        if (userIdsPage.isEmpty()) {
            return new PageResponseDTO<>(List.of(), 0L);
        }

        // Second query: Fetch full user data with collections for the paginated IDs
        UUID currentUserId = currentUserService.getUserId();
        List<User> members = userRepository.findUsersWithRolesByIdsForResearchGroup(userIdsPage.getContent(), currentUserId);

        return new PageResponseDTO<>(members.stream().map(UserShortDTO::new).toList(), userIdsPage.getTotalElements());
    }

    /**
     * Get all professors of the current user's research group.
     *
     * @return list of professors in the current research group
     */
    public List<UserShortDTO> getResearchGroupProfessors() {
        UUID researchGroupId = currentUserService.getResearchGroupIdIfMember();
        List<UUID> userIds = userRepository.findUserIdsByResearchGroupId(researchGroupId);
        if (userIds.isEmpty()) {
            return List.of();
        }

        UUID currentUserId = currentUserService.getUserId();
        List<User> members = userRepository.findUsersWithRolesByIdsForResearchGroup(userIds, currentUserId);
        return members
            .stream()
            .map(UserShortDTO::new)
            .filter(dto -> dto.getRoles() != null && dto.getRoles().contains(UserRole.PROFESSOR))
            .toList();
    }

    /**
     * Get every professor across all research groups. Intended for admin views that need a global
     * professor picker (e.g. the All Applications filter dropdown).
     *
     * @return list of all users with the PROFESSOR role
     */
    public List<UserShortDTO> getAllProfessorsForAdmin() {
        return userRepository.findAllProfessors().stream().map(UserShortDTO::new).toList();
    }

    /**
     * Get all members of the research group by id.
     *
     * @param researchGroupId the ID of the research group
     * @param pageDTO pagination information
     * @return paginated list of research group members
     */
    public PageResponseDTO<UserShortDTO> getResearchGroupMembersById(UUID researchGroupId, PageDTO pageDTO) {
        Pageable pageable = PageRequest.of(pageDTO.pageNumber(), pageDTO.pageSize());

        // First query: Get paginated user IDs to avoid N+1 query problem
        Page<UUID> userIdsPage = userRepository.findUserIdsByResearchGroupId(researchGroupId, pageable);

        if (userIdsPage.isEmpty()) {
            return new PageResponseDTO<>(List.of(), 0L);
        }

        // Second query: Fetch full user data with collections for the paginated IDs
        // We pass null for currentUserId to request alphabetical ordering without pinning any user first
        List<User> members = userRepository.findUsersWithRolesByIdsForResearchGroup(userIdsPage.getContent(), null);

        return new PageResponseDTO<>(members.stream().map(UserShortDTO::new).toList(), userIdsPage.getTotalElements());
    }

    /**
     * Removes a member from the current user's research group.
     * This operation removes both associated roles and direct research group membership.
     * @param userId the ID of the user to remove from the research group
     * @throws EntityNotFoundException if the user is not found or not in the same research group
     */
    @Transactional
    public void removeMemberFromResearchGroup(UUID userId) {
        // Verify that the user exists
        User userToRemove = userRepository
            .findWithResearchGroupRolesByUserId(userId)
            .orElseThrow(() -> EntityNotFoundException.forId("User", userId));

        // Resolve the active research group for the current request. Non-admins must
        // also be acting in the same group as the target user.
        UUID activeGroupId = currentUserService.isAdmin() ? null : currentUserService.getResearchGroupIdIfMember();

        // Ensure the user belongs to the active research group (or the caller is admin)
        if (!currentUserService.isAdmin()) {
            boolean sharesGroup = userToRemove
                .getResearchGroupRoles()
                .stream()
                .anyMatch(
                    role ->
                        role.getResearchGroup() != null &&
                        activeGroupId != null &&
                        activeGroupId.equals(role.getResearchGroup().getResearchGroupId())
                );
            if (!sharesGroup) {
                throw new AccessDeniedException("User is not a member of your research group");
            }
        }

        // Prevent removing oneself (for now)
        UUID currentUserId = currentUserService.getUserId();
        if (userId.equals(currentUserId)) {
            throw new BadRequestException("Cannot remove yourself from the research group");
        }

        // Determine which group to detach from: for non-admins it's the active group,
        // for admins we fall back to the user's first PROFESSOR/EMPLOYEE membership.
        ResearchGroup groupToRemoveFrom = null;
        if (activeGroupId != null) {
            groupToRemoveFrom = userToRemove
                .getResearchGroupRoles()
                .stream()
                .map(UserResearchGroupRole::getResearchGroup)
                .filter(rg -> rg != null && activeGroupId.equals(rg.getResearchGroupId()))
                .findFirst()
                .orElse(null);
        } else {
            groupToRemoveFrom = userToRemove
                .getResearchGroupRoles()
                .stream()
                .filter(role -> role.getRole() == UserRole.PROFESSOR || role.getRole() == UserRole.EMPLOYEE)
                .map(UserResearchGroupRole::getResearchGroup)
                .filter(rg -> rg != null)
                .findFirst()
                .orElse(null);
        }

        if (groupToRemoveFrom != null) {
            ResearchGroup target = groupToRemoveFrom;
            userResearchGroupRoleRepository
                .findByUserAndResearchGroup(userToRemove, target)
                .ifPresent(role -> {
                    role.setRole(UserRole.APPLICANT);
                    role.setResearchGroup(null);
                    userResearchGroupRoleRepository.save(role);
                });
        }
    }

    /**
     * Retrieves a research group by its ID.
     *
     * @param researchGroupId the ID of the research group to retrieve
     * @return the research group DTO
     */
    public ResearchGroupDTO getResearchGroup(UUID researchGroupId) {
        ResearchGroup researchGroup = researchGroupRepository.findByIdElseThrow(researchGroupId);
        return ResearchGroupDTO.getFromEntity(researchGroup);
    }

    /**
     * Retrieves the details of a research group by its ID.
     * Only users belonging to the research group can access its details.
     * @param researchGroupId the unique identifier of the research group
     * @return a {@link ResearchGroupLargeDTO} containing detailed information about
     *         the research group
     * @throws EntityNotFoundException if the research group is not found or user
     *                                 doesn't have access
     */

    public ResearchGroupLargeDTO getResearchGroupDetails(UUID researchGroupId) {
        currentUserService.isAdminOrMemberOf(researchGroupId);
        ResearchGroup researchGroup = researchGroupRepository
            .findById(researchGroupId)
            .orElseThrow(() -> EntityNotFoundException.forId("ResearchGroup", researchGroupId));

        return new ResearchGroupLargeDTO(
            HtmlSanitizer.sanitize(researchGroup.getDescription()),
            researchGroup.getEmail(),
            researchGroup.getWebsite(),
            researchGroup.getStreet(),
            researchGroup.getPostalCode(),
            researchGroup.getCity()
        );
    }

    /**
     * Retrieves all research groups.
     *
     * @param pageDTO the pagination parameters
     * @return list of all research group DTOs
     */
    public PageResponseDTO<ResearchGroupDTO> getAllResearchGroups(PageDTO pageDTO) {
        Pageable pageable = PageRequest.of(pageDTO.pageNumber(), pageDTO.pageSize(), Sort.by(Sort.Direction.ASC, "name"));
        Page<ResearchGroup> page = researchGroupRepository.findAll(pageable);
        return new PageResponseDTO<>(page.get().map(ResearchGroupDTO::getFromEntity).toList(), page.getTotalElements());
    }

    /**
     * Updates an existing research group.
     *
     * @param researchGroupId the ID of the research group to update
     * @param researchGroupDTO the research group data to apply
     * @return the updated research group DTO
     */
    public ResearchGroupDTO updateResearchGroup(UUID researchGroupId, ResearchGroupDTO researchGroupDTO) {
        currentUserService.isAdminOrMemberOf(researchGroupId);
        ResearchGroup researchGroup = researchGroupRepository.findByIdElseThrow(researchGroupId);
        updateEntityFromDTO(researchGroup, researchGroupDTO);
        ResearchGroup updatedResearchGroup = researchGroupRepository.save(researchGroup);
        return ResearchGroupDTO.getFromEntity(updatedResearchGroup);
    }

    /**
     * Updates a ResearchGroup entity with values from the provided DTO.
     * Includes department updates when departmentId is provided.
     */
    private void updateEntityFromDTO(ResearchGroup entity, ResearchGroupDTO dto) {
        entity.setName(dto.name());
        entity.setAbbreviation(dto.abbreviation());
        entity.setHead(dto.head());
        entity.setEmail(dto.email());
        entity.setWebsite(dto.website());
        entity.setDescription(HtmlSanitizer.sanitize(dto.description()));
        entity.setStreet(dto.street());
        entity.setPostalCode(dto.postalCode());
        entity.setCity(dto.city());

        // Update department if departmentId is provided
        if (dto.departmentId() != null) {
            Department department = departmentRepository.findByIdElseThrow(dto.departmentId());
            entity.setDepartment(department);
        }
    }

    /**
     * Populates a ResearchGroup entity with values from a ResearchGroupRequestDTO.
     * Normalizes name, abbreviation, and universityId fields.
     * Fetches and sets the department from the provided departmentId.
     *
     * @param entity the research group entity to populate
     * @param request the request DTO containing the data
     * @throws EntityNotFoundException if the department does not exist
     */
    private void populateResearchGroupFromRequest(ResearchGroup entity, ResearchGroupRequestDTO request) {
        entity.setName(StringUtil.normalize(request.researchGroupName(), false));
        entity.setUniversityId(StringUtil.normalize(request.universityId(), false));
        entity.setHead(request.researchGroupHead());
        entity.setAbbreviation(StringUtil.normalize(request.abbreviation(), false));
        entity.setEmail(request.contactEmail());
        entity.setWebsite(request.website());

        // Fetch and set department
        Department department = departmentRepository.findByIdElseThrow(request.departmentId());
        entity.setDepartment(department);

        entity.setDescription(HtmlSanitizer.sanitize(request.description()));
        entity.setStreet(request.street());
        entity.setPostalCode(request.postalCode());
        entity.setCity(request.city());
    }

    /**
     * Activates a DRAFT research group (admin only).
     * Changes the state from DRAFT to ACTIVE, allowing the research group to be used.
     * This operation can only be performed on research groups in DRAFT state.
     *
     * @param researchGroupId the unique identifier of the research group to activate
     * @return the activated research group with updated state
     * @throws EntityNotFoundException if the research group does not exist
     * @throws IllegalStateException if the research group is not in DRAFT state
     */
    @Transactional
    public ResearchGroup activateResearchGroup(UUID researchGroupId) {
        ResearchGroup group = researchGroupRepository.findByIdElseThrow(researchGroupId);
        if (group.getState() != ResearchGroupState.DRAFT && group.getState() != ResearchGroupState.DENIED) {
            throw new IllegalStateException("Only DRAFT or DENIED groups can be activated");
        }
        group.setState(ResearchGroupState.ACTIVE);
        ResearchGroup saved = researchGroupRepository.save(group);

        Set<UserResearchGroupRole> roles = userResearchGroupRoleRepository.findAllByResearchGroup(group);

        if (roles.isEmpty()) {
            log.warn("Expected at least 1 user for draft research group {}, found none", researchGroupId);
        }

        roles
            .stream()
            .filter(role -> role.getRole() == UserRole.APPLICANT)
            .forEach(role -> {
                role.setRole(UserRole.PROFESSOR);
                userResearchGroupRoleRepository.save(role);
            });

        userRepository.findByUniversityIdIgnoreCase(saved.getUniversityId()).ifPresent(prof -> sendApprovedResearchGroupEmail(prof, group));

        return saved;
    }

    /**
     * Denies a DRAFT research group (admin only).
     * Changes the state from DRAFT to DENIED, preventing the research group from being used.
     * This operation can only be performed on research groups in DRAFT state.
     *
     * @param researchGroupId the unique identifier of the research group to deny
     * @return the denied research group with updated state
     * @throws EntityNotFoundException if the research group does not exist
     * @throws IllegalStateException if the research group is not in DRAFT state
     */
    @Transactional
    public ResearchGroup denyResearchGroup(UUID researchGroupId) {
        ResearchGroup group = researchGroupRepository.findByIdElseThrow(researchGroupId);
        if (group.getState() != ResearchGroupState.DRAFT) {
            throw new IllegalStateException("Only DRAFT groups can be denied");
        }
        group.setState(ResearchGroupState.DENIED);
        return researchGroupRepository.save(group);
    }

    /**
     * Withdraws an ACTIVE research group back to DRAFT state (admin only).
     * Changes the state from ACTIVE to DRAFT, allowing the research group to be reviewed again.
     * This operation can only be performed on research groups in ACTIVE state.
     *
     * @param researchGroupId the unique identifier of the research group to withdraw
     * @return the withdrawn research group with updated state
     * @throws EntityNotFoundException if the research group does not exist
     * @throws IllegalStateException if the research group is not in ACTIVE state
     */
    @Transactional
    public ResearchGroup withdrawResearchGroup(UUID researchGroupId) {
        ResearchGroup group = researchGroupRepository.findByIdElseThrow(researchGroupId);
        if (group.getState() != ResearchGroupState.ACTIVE) {
            throw new IllegalStateException("Only ACTIVE groups can be withdrawn");
        }
        group.setState(ResearchGroupState.DRAFT);
        return researchGroupRepository.save(group);
    }

    /**
     * Retrieves research groups for admin view with filtering, sorting, and pagination.
     *
     * @param pageDTO the pagination parameters
     * @param filterDTO the filter parameters including status and search query
     * @param sortDTO the sorting parameters
     *
     * @return a paginated response containing research groups matching the criteria
     */
    public PageResponseDTO<ResearchGroupAdminDTO> getResearchGroupsForAdmin(
        PageDTO pageDTO,
        AdminResearchGroupFilterDTO filterDTO,
        SortDTO sortDTO
    ) {
        Pageable pageable = PageUtil.createPageRequest(pageDTO, sortDTO, PageUtil.ColumnMapping.RESEARCH_GROUPS_ADMIN, true);
        String normalizedSearchQuery = StringUtil.normalizeSearchQuery(filterDTO.getSearchQuery());

        Page<ResearchGroupAdminDTO> pageResult = researchGroupRepository.findAllForAdmin(
            filterDTO.getStatus(),
            normalizedSearchQuery,
            pageable
        );
        return new PageResponseDTO<>(pageResult.getContent(), pageResult.getTotalElements());
    }

    /**
     * Gets all DRAFT research groups for admin review.
     * Returns a paginated list of research groups that are waiting for admin approval.
     * Research groups are sorted by name in ascending order.
     *
     * @param pageDTO pagination information including page number and page size
     * @return paginated response containing DRAFT research groups and total count
     */
    public PageResponseDTO<ResearchGroupDTO> getDraftResearchGroups(PageDTO pageDTO) {
        Pageable pageable = PageRequest.of(pageDTO.pageNumber(), pageDTO.pageSize(), Sort.by(Sort.Direction.ASC, "name"));
        Page<ResearchGroup> page = researchGroupRepository.findByState(ResearchGroupState.DRAFT, pageable);
        return new PageResponseDTO<>(page.get().map(ResearchGroupDTO::getFromEntity).toList(), page.getTotalElements());
    }

    /**
     * Creates a research group request from a professor during onboarding.
     * The research group starts in DRAFT state and needs admin approval.
     * The professor is associated with the research group using the provided universityId and assigned the APPLICANT role.
     * An email notification is sent to support/administrators to review the new research group request.
     *
     * @param request the professor's research group request
     * @return the created research group in DRAFT state
     */
    @Transactional
    public ResearchGroup createProfessorResearchGroupRequest(ResearchGroupRequestDTO request) {
        User currentUser = currentUserService.getUser();

        // A user requesting a brand-new research group must not already be a PROFESSOR
        // or EMPLOYEE of any existing group.
        boolean alreadyMember = currentUser
            .getResearchGroupRoles()
            .stream()
            .anyMatch(
                role -> role.getResearchGroup() != null && (role.getRole() == UserRole.PROFESSOR || role.getRole() == UserRole.EMPLOYEE)
            );
        if (alreadyMember) {
            throw new AlreadyMemberOfResearchGroupException("User already belongs to a research group");
        }

        if (researchGroupRepository.existsByNameIgnoreCase(request.researchGroupName())) {
            throw new ResourceAlreadyExistsException("Research group with name '" + request.researchGroupName() + "' already exists");
        }

        ResearchGroup researchGroup = new ResearchGroup();
        populateResearchGroupFromRequest(researchGroup, request);
        researchGroup.setState(ResearchGroupState.DRAFT);

        ResearchGroup saved = researchGroupRepository.save(researchGroup);

        currentUser.setUniversityId(request.universityId());
        userRepository.save(currentUser);

        ensureUserRoleInGroup(currentUser, saved, UserRole.APPLICANT);

        notifySupportOfNewResearchGroupRequest(saved);

        return saved;
    }

    /**
     * Creates a research group directly as ACTIVE state (admin only).
     * Associated with professor submitted in the request using universityId.
     *
     * @param request the research group creation request
     * @return the created research group in ACTIVE state
     */
    @Transactional
    public ResearchGroup createResearchGroupAsAdmin(ResearchGroupRequestDTO request) {
        if (researchGroupRepository.existsByNameIgnoreCase(request.researchGroupName())) {
            throw new ResourceAlreadyExistsException("Research group with name '" + request.researchGroupName() + "' already exists");
        }

        // Resolve the professor by universityId, creating a local user from Keycloak data if needed
        User professor = resolveProfessorForAdminCreate(request.universityId());

        // Check if the professor is already a PROFESSOR or EMPLOYEE of any group; admin
        // create-flow is for users who are not yet running a group.
        ResearchGroup existingMembership = professor
            .getResearchGroupRoles()
            .stream()
            .filter(
                role -> role.getResearchGroup() != null && (role.getRole() == UserRole.PROFESSOR || role.getRole() == UserRole.EMPLOYEE)
            )
            .map(UserResearchGroupRole::getResearchGroup)
            .findFirst()
            .orElse(null);
        if (existingMembership != null) {
            throw new AlreadyMemberOfResearchGroupException(
                "User with universityId '%s' is already a member of research group '%s'".formatted(
                    request.universityId(),
                    existingMembership.getName()
                )
            );
        }

        ResearchGroup researchGroup = new ResearchGroup();
        populateResearchGroupFromRequest(researchGroup, request);
        researchGroup.setState(ResearchGroupState.ACTIVE);

        ResearchGroup saved;
        try {
            saved = researchGroupRepository.save(researchGroup);
        } catch (DataIntegrityViolationException e) {
            throw new ResourceAlreadyExistsException("Research group with name '" + request.researchGroupName() + "' already exists");
        }

        // Update or create the PROFESSOR role
        ensureUserRoleInGroup(professor, saved, UserRole.PROFESSOR);

        return saved;
    }

    private User resolveProfessorForAdminCreate(String universityId) {
        String normalizedUniversityId = StringUtil.normalize(universityId, false);

        return userRepository
            .findByUniversityIdIgnoreCase(normalizedUniversityId)
            .orElseGet(() -> {
                KeycloakUserDTO resolvedUser = keycloakUserService
                    .findUserByUniversityId(normalizedUniversityId)
                    .orElseThrow(() ->
                        new EntityNotFoundException("User with universityId '%s' not found".formatted(normalizedUniversityId))
                    );
                return createLocalUserFromKeycloak(resolvedUser);
            });
    }

    private User createLocalUserFromKeycloak(KeycloakUserDTO keycloakUser) {
        User user = new User();
        user.setUserId(keycloakUser.id());
        user.setEmail(StringUtil.normalize(keycloakUser.email(), true));
        user.setFirstName(StringUtil.normalize(keycloakUser.firstName(), false));
        user.setLastName(StringUtil.normalize(keycloakUser.lastName(), false));
        user.setUniversityId(StringUtil.normalize(keycloakUser.universityId(), false));
        if (user.getSelectedLanguage() == null) {
            user.setSelectedLanguage("en");
        }
        return userRepository.save(user);
    }

    /**
     * Creates an employee research group access request during onboarding.
     * Sends an email to support/administrators with user information and professor name.
     * This is a temporary solution until the employee role is implemented.
     *
     * @param request the employee's research group request containing professor name
     */
    @Transactional
    public void createEmployeeResearchGroupRequest(EmployeeResearchGroupRequestDTO request) {
        User currentUser = currentUserService.getUser();

        String emailBody = String.format(
            """
            <html>
            <body>
                <h2>Employee Research Group Access Request</h2>
                <p>A user has requested access to a research group as an employee.</p>

                <h3>User Information:</h3>
                <ul>
                    <li><strong>Name:</strong> %s %s</li>
                    <li><strong>Email:</strong> %s</li>
                    <li><strong>User ID:</strong> %s</li>
                    <li><strong>University ID:</strong> %s</li>
                </ul>

                <h3>Professor Information:</h3>
                <ul>
                    <li><strong>Professor Name:</strong> %s</li>
                </ul>

                <p>Please assign this user to the appropriate research group.</p>
            </body>
            </html>
            """,
            currentUser.getFirstName() != null ? currentUser.getFirstName() : "N/A",
            currentUser.getLastName() != null ? currentUser.getLastName() : "N/A",
            currentUser.getEmail(),
            currentUser.getUserId(),
            currentUser.getUniversityId() != null ? currentUser.getUniversityId() : "Not provided",
            request.professorName()
        );

        User support = new User();
        support.setEmail(supportEmail);
        support.setSelectedLanguage(Language.ENGLISH.getCode());

        Email email = Email.builder()
            .to(support)
            .customSubject(buildSubjectWithEnvironment("Employee Research Group Access Request - " + currentUser.getEmail()))
            .customBody(emailBody)
            .sendAlways(true)
            .language(Language.ENGLISH)
            .content(currentUser)
            .build();

        emailSender.sendAsync(email);
    }

    /**
     * Adds multiple members to a research group. Verifies that the current user is an admin or a
     * member of the target research group before proceeding. For each provided Keycloak user,
     * ensures a matching local user exists (creating one if necessary) and assigns them to the
     * target group; an email notification is sent only when the user was newly created or their
     * research-group assignment changed.
     *
     * @param keycloakUsers   list of {@link KeycloakUserDTO} representing the users to add
     * @param researchGroupId target research group; when null the current user's group is used
     *                        (only valid for a professor)
     * @throws AccessDeniedException if the current user is not a member of the target group
     */
    @Transactional
    public void addMembersToResearchGroup(List<KeycloakUserDTO> keycloakUsers, UUID researchGroupId) {
        UUID targetGroupId = researchGroupId != null ? researchGroupId : currentUserService.getResearchGroupIdIfMember();
        // Throws AccessDeniedException if the current user is neither an admin nor a member of the target group
        currentUserService.isAdminOrMemberOf(targetGroupId);
        ResearchGroup researchGroup = researchGroupRepository.findByIdElseThrow(targetGroupId);

        for (KeycloakUserDTO keycloakUser : keycloakUsers) {
            User user;
            if (keycloakUser.universityId() != null && !keycloakUser.universityId().isBlank()) {
                user = userRepository.findByUniversityIdIgnoreCase(keycloakUser.universityId()).orElse(null);
            } else {
                user = userRepository.findById(keycloakUser.id()).orElse(null);
            }

            if (user != null) {
                if (userResearchGroupRoleRepository.existsByUserAndResearchGroup(user, researchGroup)) {
                    throw new AlreadyMemberOfResearchGroupException(
                        "User '%s %s' is already a member of this research group.".formatted(
                            keycloakUser.firstName(),
                            keycloakUser.lastName()
                        )
                    );
                }
            } else {
                user = new User();
                user.setUserId(keycloakUser.id());
                user.setEmail(keycloakUser.email());
                user.setFirstName(keycloakUser.firstName());
                user.setLastName(keycloakUser.lastName());
                user.setUniversityId(keycloakUser.universityId());
            }
            if (user.getSelectedLanguage() == null) {
                user.setSelectedLanguage("en");
            }
            userRepository.save(user);

            // Ensure the user has a role in the research group
            ensureUserRoleInGroup(user, researchGroup, UserRole.EMPLOYEE);

            // Send notification email because the group was newly assigned or changed
            sendWelcomeToResearchGroupEmail(user, researchGroup);
        }
    }

    /**
     * Ensures a user has a specific role within a research group.
     * If the user already has a role in the group, it will be updated to the new role if different.
     * If the user has no role in the group, a new role mapping is created.
     *
     * @param user          The user to assign the role to.
     * @param researchGroup The research group for the role.
     * @param targetRole    The role to assign (e.g., PROFESSOR, APPLICANT).
     */
    private void ensureUserRoleInGroup(User user, ResearchGroup researchGroup, UserRole targetRole) {
        Optional<UserResearchGroupRole> existingRole = userResearchGroupRoleRepository.findByUserAndResearchGroup(user, researchGroup);

        if (existingRole.isPresent()) {
            UserResearchGroupRole role = existingRole.get();
            boolean changed = false;
            if (role.getRole() != targetRole) {
                role.setRole(targetRole);
                changed = true;
            }
            if (
                role.getResearchGroup() == null || !role.getResearchGroup().getResearchGroupId().equals(researchGroup.getResearchGroupId())
            ) {
                role.setResearchGroup(researchGroup);
                changed = true;
            }
            if (role.getUser() == null || !role.getUser().getUserId().equals(user.getUserId())) {
                role.setUser(user);
                changed = true;
            }
            if (changed) {
                userResearchGroupRoleRepository.save(role);
            }
        } else {
            // Check if the user has a role without a research group (e.g. Applicant) and update it
            Optional<UserResearchGroupRole> roleWithoutGroup = userResearchGroupRoleRepository
                .findAllByUser(user)
                .stream()
                .filter(role -> role.getResearchGroup() == null)
                .findFirst();

            if (roleWithoutGroup.isPresent()) {
                UserResearchGroupRole role = roleWithoutGroup.get();
                role.setUser(user);
                role.setResearchGroup(researchGroup);
                role.setRole(targetRole);
                userResearchGroupRoleRepository.save(role);
            } else {
                UserResearchGroupRole newRole = new UserResearchGroupRole();
                newRole.setUser(user);
                newRole.setResearchGroup(researchGroup);
                newRole.setRole(targetRole);
                userResearchGroupRoleRepository.save(newRole);
            }
        }
    }

    private void notifySupportOfNewResearchGroupRequest(ResearchGroup rg) {
        String emailBody = String.format(
            """
            <html>
            <body>
                <h2>New Research Group Request</h2>
                <p>A new research group has been requested and is awaiting approval.</p>

                <p>Please review and approve or deny this research group request in the admin panel.</p>
            </body>
            </html>
            """
        );

        User support = new User();
        support.setEmail(supportEmail);
        support.setSelectedLanguage(Language.ENGLISH.getCode());

        Email email = Email.builder()
            .to(support)
            .customSubject(buildSubjectWithEnvironment("New Research Group Request - " + rg.getName()))
            .customBody(emailBody)
            .sendAlways(true)
            .language(Language.ENGLISH)
            .build();

        emailSender.sendAsync(email);
    }

    /**
     * Sends a welcome email to a user who has been added to a new research group.
     *
     * @param user          The user who was added.
     * @param researchGroup The research group they were added to.
     */
    private void sendWelcomeToResearchGroupEmail(User user, ResearchGroup researchGroup) {
        Language language = user.getSelectedLanguage() != null ? Language.fromCode(user.getSelectedLanguage()) : Language.ENGLISH;

        Email email = Email.builder()
            .to(user)
            .language(language)
            .emailType(EmailType.RESEARCH_GROUP_MEMBER_ADDED)
            .content(ResearchGroupEmailContextDTO.fromEntities(user, researchGroup))
            .researchGroup(researchGroup)
            .build();

        emailSender.sendAsync(email);
    }

    /**
     * Sends a welcome email to the professor whose research group was approved.
     *
     * @param prof          The professor who was approved.
     * @param researchGroup The research group that was approved.
     */
    private void sendApprovedResearchGroupEmail(User prof, ResearchGroup researchGroup) {
        Language language = prof.getSelectedLanguage() != null ? Language.fromCode(prof.getSelectedLanguage()) : Language.ENGLISH;

        Email email = Email.builder()
            .to(prof)
            .language(language)
            .emailType(EmailType.RESEARCH_GROUP_APPROVED)
            .content(ResearchGroupEmailContextDTO.fromEntities(prof, researchGroup))
            .researchGroup(researchGroup)
            .build();

        emailSender.sendAsync(email);
    }

    private String buildSubjectWithEnvironment(String subject) {
        if (environmentName == null || environmentName.isBlank()) {
            return subject;
        }
        return "[" + environmentName.toUpperCase() + "] " + subject;
    }
}
