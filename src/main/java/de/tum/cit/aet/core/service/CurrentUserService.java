package de.tum.cit.aet.core.service;

import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.core.domain.CurrentUser;
import de.tum.cit.aet.core.domain.ResearchGroupRole;
import de.tum.cit.aet.core.exception.AccessDeniedException;
import de.tum.cit.aet.core.security.ActiveResearchGroupHeaderFilter;
import de.tum.cit.aet.evaluation.domain.ApplicationReview;
import de.tum.cit.aet.evaluation.domain.InternalComment;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.notification.domain.EmailTemplate;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.repository.ResearchGroupRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import de.tum.cit.aet.usermanagement.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Scope;
import org.springframework.context.annotation.ScopedProxyMode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Service
@Scope(value = WebApplicationContext.SCOPE_REQUEST, proxyMode = ScopedProxyMode.TARGET_CLASS)
@RequiredArgsConstructor
public class CurrentUserService {

    // UserRepository is kept here for the bootstrap user-lookup only. Domain operations on the
    // user (e.g. recording AI consent) are delegated to UserService, while research-group lookups
    // go directly through ResearchGroupRepository — depending on ResearchGroupService here would
    // create a construction-time cycle, as it injects CurrentUserService.
    private final UserRepository userRepository;
    private final UserService userService;
    private final ResearchGroupRepository researchGroupRepository;

    private User user;

    private CurrentUser currentUser;

    private UUID resolvedActiveResearchGroupId;
    private boolean activeResearchGroupResolved;

    /**
     * Returns the current authenticated user as a DTO.
     * Loads the user from the security context if not already loaded.
     *
     * @return the current user as a {@link CurrentUser} object
     */
    public CurrentUser getCurrentUser() {
        if (currentUser == null) {
            loadCurrentUser();
        }
        return currentUser;
    }

    /**
     * Returns the current authenticated user as an entity.
     * Loads the user from the security context if not already loaded.
     *
     * @return the current user as a {@link User} entity
     */
    public User getUser() {
        if (user == null) {
            loadCurrentUser();
        }
        return user;
    }

    /**
     * Loads the current authenticated user from the security context.
     * Initializes the {@link User} entity and the {@link CurrentUser} DTO.
     *
     * @throws AccessDeniedException if the user cannot be resolved from the
     *                               security context
     */
    private void loadCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken jwtToken)) {
            throw new AccessDeniedException("Cannot extract user ID from authentication.");
        }
        UUID userId = UUID.fromString(jwtToken.getToken().getSubject());

        User user = userRepository
            .findWithResearchGroupRolesByUserId(userId)
            .orElseThrow(() -> new AccessDeniedException("User not found"));

        List<ResearchGroupRole> roles = user
            .getResearchGroupRoles()
            .stream()
            .map(r -> new ResearchGroupRole(r.getRole(), r.getResearchGroup() != null ? r.getResearchGroup().getResearchGroupId() : null))
            .toList();

        this.user = user;
        this.currentUser = new CurrentUser(user.getUserId(), user.getEmail(), user.getFirstName(), user.getLastName(), roles);
    }

    /**
     * Returns the ID of the current authenticated user.
     *
     * @return UUID of the user
     */
    public UUID getUserId() {
        return getCurrentUser().userId();
    }

    /**
     * Returns the current user's ID if available.
     *
     * @return an {@link Optional} containing the user ID, or empty if access is
     *         denied
     */
    public Optional<UUID> getUserIdIfAvailable() {
        try {
            return Optional.of(getUserId());
        } catch (AccessDeniedException e) {
            return Optional.empty();
        }
    }

    /**
     * Returns the full name of the current authenticated user.
     *
     * @return "FirstName LastName"
     */
    public String getCurrentUserFullName() {
        User user = getUser();
        return user.getFirstName() + " " + user.getLastName();
    }

    /**
     * Returns the full name of the current user if available.
     *
     * @return an {@link Optional} containing the full name, or empty if access is
     *         denied
     */
    public Optional<String> getCurrentUserFullNameIfAvailable() {
        try {
            return Optional.of(getCurrentUserFullName());
        } catch (AccessDeniedException e) {
            return Optional.empty();
        }
    }

    /**
     * Resolves the active research group for the current request. The active group is picked
     * first from the {@code X-Active-Research-Group-Id} header parsed by
     * {@link ActiveResearchGroupHeaderFilter} when the current user holds a PROFESSOR or
     * EMPLOYEE membership in that group; if the header points to a group the user is not a
     * member of, an {@link AccessDeniedException} is thrown. Without a valid header, falls back
     * to the first PROFESSOR/EMPLOYEE membership the user holds. The result is cached for the
     * duration of the request and subsequent calls do not re-read the header or re-validate.
     *
     * @return the resolved active research group id, never null
     * @throws AccessDeniedException if the user is not a member of any research group
     *                               or if the header points to a non-member group
     */
    public UUID getActiveResearchGroupId() {
        if (activeResearchGroupResolved) {
            if (resolvedActiveResearchGroupId == null) {
                throw new AccessDeniedException("Current User does not have a research group");
            }
            return resolvedActiveResearchGroupId;
        }
        activeResearchGroupResolved = true;

        UUID requested = readActiveResearchGroupIdHeader();
        CurrentUser current = getCurrentUser();

        if (requested != null) {
            if (!current.isMemberOf(requested)) {
                throw new AccessDeniedException("Active research group does not match a user membership");
            }
            resolvedActiveResearchGroupId = requested;
            return resolvedActiveResearchGroupId;
        }

        resolvedActiveResearchGroupId = current
            .getResearchGroupIdIfMember()
            .orElseThrow(() -> new AccessDeniedException("Current User does not have a research group"));
        return resolvedActiveResearchGroupId;
    }

    /**
     * Returns the research group ID if the current user is a professor of the active group.
     *
     * @return the active research group ID
     * @throws AccessDeniedException if the user is not a professor of the active group
     */
    public UUID getResearchGroupIdIfProfessor() {
        UUID activeId = getActiveResearchGroupId();
        if (!getCurrentUser().isProfessorOf(activeId)) {
            throw new AccessDeniedException("Current User is not a professor of the active research group");
        }
        return activeId;
    }

    /**
     * Returns the research group ID if the current user is a professor or employee
     * of the active group.
     *
     * @return the active research group ID
     * @throws AccessDeniedException if the user is not a member of any research group
     */
    public UUID getResearchGroupIdIfMember() {
        return getActiveResearchGroupId();
    }

    /**
     * Returns the active research group entity if the current user is a professor of it.
     *
     * @return the active research group
     * @throws AccessDeniedException if the user is not a professor of the active group
     */
    public ResearchGroup getResearchGroupIfProfessor() {
        UUID activeId = getResearchGroupIdIfProfessor();
        return researchGroupRepository.findById(activeId).orElseThrow(() -> new AccessDeniedException("Active research group not found"));
    }

    /**
     * Returns the active research group entity if the current user holds either PROFESSOR or
     * EMPLOYEE role in it. Used by endpoints that accept both roles (e.g. email templates).
     *
     * @return the active research group
     * @throws AccessDeniedException if the user has no membership in the active group
     */
    public ResearchGroup getResearchGroupIfMember() {
        UUID activeId = getResearchGroupIdIfMember();
        return researchGroupRepository.findById(activeId).orElseThrow(() -> new AccessDeniedException("Active research group not found"));
    }

    private UUID readActiveResearchGroupIdHeader() {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes == null) {
            return null;
        }
        HttpServletRequest request = attributes.getRequest();
        Object value = request.getAttribute(ActiveResearchGroupHeaderFilter.ACTIVE_RESEARCH_GROUP_ID_ATTRIBUTE);
        return value instanceof UUID uuid ? uuid : null;
    }

    /**
     * Checks whether the given userId matches the current user.
     *
     * @param userId the user ID to check
     * @return true if the current user is the given user
     */
    public boolean isCurrentUser(UUID userId) {
        return getUserId().equals(userId);
    }

    /**
     * Checks if the current user has admin privileges.
     *
     * @return true if the user is an admin, false otherwise
     */
    public boolean isAdmin() {
        return getCurrentUser().isAdmin();
    }

    /**
     * Checks if the current user has a professor role.
     *
     * @return true if the user is a professor, false otherwise
     */
    public boolean isProfessor() {
        return getCurrentUser().isProfessor();
    }

    /**
     * Checks if the current user has a employee role.
     *
     * @return true if the user is a employee, false otherwise
     */
    public boolean isEmployee() {
        return getCurrentUser().isEmployee();
    }

    /**
     * Checks if the current user is the supervising professor of the given job.
     *
     * @param job the job to check
     * @return true if the user is the supervising professor, false otherwise
     */
    public boolean isSupervisingProfessorOf(Job job) {
        if (job == null || job.getSupervisingProfessor() == null) {
            return false;
        }
        return job.getSupervisingProfessor().getUserId().equals(getUserId());
    }

    /**
     * Verifies that the current user has access to the given job.
     * Access is granted if the user is:
     * - The supervising professor of the job, OR
     * - A member (professor/employee) of the job's research group
     *
     * @param job the job to check access for
     * @throws AccessDeniedException if the user has no access
     */
    public void verifyJobAccess(Job job) {
        if (isSupervisingProfessorOf(job)) {
            return;
        }
        isAdminOrMemberOf(job.getResearchGroup());
    }

    /**
     * Checks whether the current user is either an admin or professor of the
     * specified research group.
     *
     * @param researchGroupId the ID of the research group
     * @throws AccessDeniedException if the current user does not belong to the
     *                               research group
     */
    public void isAdminOrMemberOf(UUID researchGroupId) {
        if (isAdmin() || getCurrentUser().isMemberOf(researchGroupId)) {
            return;
        }
        throw new AccessDeniedException("User has no access to the research group");
    }

    /**
     * Checks whether the current user is either an admin or is a professor of the
     * given research group.
     *
     * @param researchGroup the research group to check
     */
    public void isAdminOrMemberOf(ResearchGroup researchGroup) {
        if (researchGroup == null) {
            return;
        }
        isAdminOrMemberOf(researchGroup.getResearchGroupId());
    }

    /**
     * Checks whether the current user is either an admin or is a professor of the
     * same research group
     * as the given professor identified by their user ID.
     *
     * @param professor the professor of whom the research group is to be checked
     * @throws AccessDeniedException if the professor cannot be found or has no
     *                               research group
     */
    public void isAdminOrMemberOfResearchGroupOfProfessor(User professor) {
        if (professor == null) {
            throw new AccessDeniedException("Professor not found");
        }
        if (isAdmin()) {
            return;
        }
        boolean sharesGroup = professor
            .getResearchGroupRoles()
            .stream()
            .map(r -> r.getResearchGroup())
            .filter(rg -> rg != null)
            .anyMatch(rg -> getCurrentUser().isMemberOf(rg.getResearchGroupId()));
        if (!sharesGroup) {
            throw new AccessDeniedException("Professor does not share a research group with the current user");
        }
    }

    /**
     * Checks whether the given userId matches the current user or the current user
     * is an admin.
     *
     * @param userId the user ID to check
     */
    public void isCurrentUserOrAdmin(UUID userId) {
        boolean success = isAdmin() || getUserId().equals(userId);
        if (!success) {
            throw new AccessDeniedException("User is neither the owner nor an admin");
        }
    }

    /**
     * Asserts that the current user has access to the given entity.
     * Throws AccessDeniedException if access is denied.
     *
     * @param entity the entity to check
     */
    public void assertAccessTo(Object entity) {
        switch (entity) {
            case Application app -> hasAccessTo(app);
            case ApplicationReview review -> hasAccessTo(review);
            case ResearchGroup group -> hasAccessTo(group);
            case Job job -> hasAccessTo(job);
            case InternalComment comment -> hasAccessTo(comment);
            case EmailTemplate emailTemplate -> hasAccessTo(emailTemplate);
            default -> throw new AccessDeniedException("Access denied to entity: " + entity.getClass().getSimpleName());
        }
    }

    /**
     * Checks if the current user has access to the given application.
     * The user must either be the applicant or an admin.
     *
     * @param application the application to check
     * @throws AccessDeniedException if access is denied
     */
    private void hasAccessTo(Application application) {
        isCurrentUserOrAdmin(application.getApplicant().getUserId());
    }

    /**
     * Checks if the current user has access to the given application review.
     * The user must be an admin or professor of the associated research group.
     *
     * @param review the application review to check
     * @throws AccessDeniedException if access is denied
     */
    private void hasAccessTo(ApplicationReview review) {
        isAdminOrMemberOf(review.getApplication().getJob().getResearchGroup().getResearchGroupId());
    }

    /**
     * Checks if the current user has access to the given research group.
     * The user must be an admin or professor of the group.
     *
     * @param researchGroup the research group to check
     * @throws AccessDeniedException if access is denied
     */
    private void hasAccessTo(ResearchGroup researchGroup) {
        isAdminOrMemberOf(researchGroup.getResearchGroupId());
    }

    /**
     * Checks if the current user has access to the given job posting.
     * The user must be an admin or professor of the associated research group.
     *
     * @param job the job posting to check
     * @throws AccessDeniedException if access is denied
     */
    private void hasAccessTo(Job job) {
        isAdminOrMemberOf(job.getResearchGroup().getResearchGroupId());
    }

    /**
     * Checks if the current user has access to the given internal comment.
     * The user must be an admin or professor of the associated research group.
     *
     * @param comment the internal comment to check
     * @throws AccessDeniedException if access is denied
     */
    private void hasAccessTo(InternalComment comment) {
        isAdminOrMemberOf(comment.getApplication().getJob().getResearchGroup().getResearchGroupId());
    }

    /**
     * Checks if the current user has access to the given internal email template.
     * The user must be an admin or professor of the associated research group.
     *
     * @param emailTemplate the email template to check
     * @throws AccessDeniedException if access is denied
     */
    private void hasAccessTo(EmailTemplate emailTemplate) {
        isAdminOrMemberOf(emailTemplate.getResearchGroup().getResearchGroupId());
    }

    /**
     * Records the AI consent timestamp for the current user on first AI usage.
     * Only sets aiConsentedAt if not already set.
     */
    public void markAiConsentForCurrentUser() {
        userService.markAiConsentIfMissing(getUser());
    }
}
