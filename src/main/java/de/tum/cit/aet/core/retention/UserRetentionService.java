package de.tum.cit.aet.core.retention;

import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.application.repository.ApplicationRepository;
import de.tum.cit.aet.core.config.UserRetentionProperties;
import de.tum.cit.aet.core.constants.Language;
import de.tum.cit.aet.core.documents.service.DocumentService;
import de.tum.cit.aet.core.repository.ImageRepository;
import de.tum.cit.aet.core.service.ImageService;
import de.tum.cit.aet.evaluation.repository.ApplicationReviewRepository;
import de.tum.cit.aet.evaluation.repository.InternalCommentRepository;
import de.tum.cit.aet.evaluation.repository.RatingRepository;
import de.tum.cit.aet.interview.repository.InterviewSlotRepository;
import de.tum.cit.aet.interview.repository.IntervieweeRepository;
import de.tum.cit.aet.job.constants.JobState;
import de.tum.cit.aet.job.repository.JobRepository;
import de.tum.cit.aet.notification.constants.EmailType;
import de.tum.cit.aet.notification.repository.EmailSettingRepository;
import de.tum.cit.aet.notification.repository.EmailTemplateRepository;
import de.tum.cit.aet.notification.service.AsyncEmailSender;
import de.tum.cit.aet.notification.service.mail.Email;
import de.tum.cit.aet.usermanagement.constants.UserRole;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.domain.UserResearchGroupRole;
import de.tum.cit.aet.usermanagement.repository.ApplicantRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import de.tum.cit.aet.usermanagement.repository.UserResearchGroupRoleRepository;
import de.tum.cit.aet.usermanagement.repository.UserSettingRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserRetentionService {

    private final UserRetentionProperties userRetentionProperties;

    private final UserRepository userRepository;

    private final AsyncEmailSender sender;

    private final ApplicantRepository applicantRepository;
    private final ApplicationRepository applicationRepository;
    private final ApplicationReviewRepository applicationReviewRepository;
    private final DocumentService documentService;
    private final EmailSettingRepository emailSettingRepository;
    private final EmailTemplateRepository emailTemplateRepository;
    private final ImageRepository imageRepository;
    private final ImageService imageService;
    private final InternalCommentRepository internalCommentRepository;
    private final InterviewSlotRepository interviewSlotRepository;
    private final IntervieweeRepository intervieweeRepository;
    private final JobRepository jobRepository;
    private final RatingRepository ratingRepository;
    private final UserResearchGroupRoleRepository userResearchGroupRoleRepository;
    private final UserSettingRepository userSettingRepository;

    public enum RetentionCategory {
        SKIP_ADMIN,
        APPLICANT,
        PROFESSOR_OR_EMPLOYEE,
        UNKNOWN,
    }

    /**
     * Processes a list of candidate user IDs for retention handling.
     *
     * @param userIds list of candidate user IDs
     * @param cutoff inactivity cutoff timestamp used for logging
     * @param dryRun whether to only log without applying changes
     */
    @Transactional
    public void processUserIdsList(List<UUID> userIds, LocalDateTime cutoff, boolean dryRun) {
        for (UUID userId : userIds) {
            Optional<User> userOpt = userRepository.findWithResearchGroupRolesByUserId(userId);
            if (userOpt.isEmpty()) {
                log.debug("User retention: candidate userId={} no longer exists (cutoff={})", userId, cutoff);
                continue;
            }

            User user = userOpt.get();
            UUID resolvedUserId = user.getUserId();
            RetentionCategory category = classify(user);

            log.info(
                "User retention preview: userId={} category={} rolesCount={} dryRun={} cutoff={}",
                resolvedUserId,
                category,
                user.getResearchGroupRoles() == null ? 0 : user.getResearchGroupRoles().size(),
                dryRun,
                cutoff
            );

            if (category == RetentionCategory.SKIP_ADMIN) {
                // Safety-net; repository query already tries to exclude admins.
                log.warn("User retention preview: userId={} classified as ADMIN - skipping", resolvedUserId);
                continue;
            }

            if (category == RetentionCategory.PROFESSOR_OR_EMPLOYEE) {
                handleProfessorOrEmployee(user, dryRun);
            } else if (category == RetentionCategory.APPLICANT) {
                handleApplicant(user, dryRun);
            } else if (category == RetentionCategory.UNKNOWN) {
                log.info("User retention: processing UNKNOWN userId={}", resolvedUserId);
                log.info("No specific handling for UNKNOWN users.");
                continue;
            }
            handleGeneralData(user, dryRun);
        }
    }

    /**
     * Sends a one-time warning email to inactive non-admin users whose inactivity date matches the given warning day.
     * <p>
     * The repository compares only the calendar date (ignoring time) against {@code warningDate}, so users are warned
     * exactly on that day. Admins are still filtered out defensively.
     * </p>
     *
     * @param warningDate the day on which to send warnings (time component is ignored in the query)
     */
    public void warnUserOfDataDeletion(LocalDateTime warningDate) {
        List<UUID> userIds = userRepository.findInactiveNonAdminUserIdsForWarning(warningDate);

        for (UUID userId : userIds) {
            Optional<User> userOpt = userRepository.findById(userId);
            if (userOpt.isEmpty()) {
                log.error("User retention warning: candidate userId={} no longer exists (warningDate={})", userId, warningDate);
                continue;
            }

            User user = userOpt.get();
            RetentionCategory category = classify(user);

            if (category == RetentionCategory.SKIP_ADMIN) {
                // Safety-net; repository query already tries to exclude admins.
                continue;
            }

            Email email = Email.builder()
                .to(user)
                .language(Language.fromCode(user.getSelectedLanguage()))
                .emailType(EmailType.USER_DATA_DELETION_WARNING)
                .content(user)
                .build();

            sender.sendAsync(email);
        }
    }

    /**
     * Deletes a single user on demand from the admin "Manage Users" page. Reuses the
     * existing per-category anonymisation helpers and finally removes the user row.
     * Unlike {@link #processUserIdsList(List, LocalDateTime, boolean)}, this method
     * does not skip admins — the caller is responsible for preventing self-delete.
     *
     * @param userId the user UUID to delete
     */
    @Transactional
    public void deleteUserByAdmin(UUID userId) {
        Optional<User> userOpt = userRepository.findWithResearchGroupRolesByUserId(userId);
        if (userOpt.isEmpty()) {
            log.info("Admin delete: userId={} not found, nothing to do", userId);
            return;
        }
        User user = userOpt.get();
        RetentionCategory category = classify(user);

        if (category == RetentionCategory.PROFESSOR_OR_EMPLOYEE || category == RetentionCategory.SKIP_ADMIN) {
            // 1) Treat admins identically to professor/employee for anonymisation purposes.
            handleProfessorOrEmployee(user, false);
        } else if (category == RetentionCategory.APPLICANT) {
            handleApplicant(user, false);
        }
        // 2) UNKNOWN users have no FKs to anonymise; jump straight to general cleanup.
        handleGeneralData(user, false);
    }

    // Helper methods for handling different categories

    private RetentionCategory classify(User user) {
        List<UserResearchGroupRole> roles =
            user.getResearchGroupRoles() == null ? List.of() : user.getResearchGroupRoles().stream().toList();

        boolean isAdmin = roles.stream().anyMatch(r -> r.getRole() == UserRole.ADMIN);
        if (isAdmin) {
            return RetentionCategory.SKIP_ADMIN;
        }

        boolean isProfessorOrEmployee = roles.stream().anyMatch(r -> r.getRole() == UserRole.PROFESSOR || r.getRole() == UserRole.EMPLOYEE);
        if (isProfessorOrEmployee) {
            return RetentionCategory.PROFESSOR_OR_EMPLOYEE;
        }

        boolean isApplicant = roles.stream().anyMatch(r -> r.getRole() == UserRole.APPLICANT);
        if (isApplicant) {
            return RetentionCategory.APPLICANT;
        }

        return RetentionCategory.UNKNOWN;
    }

    private void handleApplicant(User user, boolean dryRun) {
        if (dryRun) {
            log.info("User retention (dry-run): would process APPLICANT userId={}", user.getUserId());
            return;
        }
        log.info("User retention: processing APPLICANT userId={}", user.getUserId());

        // 1. Delete applications (and for each application delete application reviews, ratings, interviews (slots, interviewees etc), internal comments and documents)
        List<Application> applications = applicationRepository.findAllByApplicantId(user.getUserId());
        if (!applications.isEmpty()) {
            List<UUID> applicationIds = applications.stream().map(Application::getApplicationId).toList();

            interviewSlotRepository.deleteByIntervieweeApplicationIdIn(applicationIds);
            intervieweeRepository.deleteByApplicationIdIn(applicationIds);

            applicationReviewRepository.deleteByApplicationIdIn(applicationIds);
            ratingRepository.deleteByApplicationIdIn(applicationIds);
            internalCommentRepository.deleteByApplicationIdIn(applicationIds);

            for (UUID applicationId : applicationIds) {
                documentService.deleteAllByApplicationId(applicationId);
            }
            applicationRepository.deleteAllInBatch(applications);
        }

        // 2. Delete applicant-owned profile/custom documents (rows + orphan files atomically)
        UUID userId = user.getUserId();
        documentService.deleteAllByApplicantId(userId);

        // 3. Delete applicant data
        applicantRepository.deleteById(userId);
    }

    private void handleProfessorOrEmployee(User user, boolean dryRun) {
        if (dryRun) {
            log.info("User retention (dry-run): would process PROFESSOR_OR_EMPLOYEE userId={}", user.getUserId());
            return;
        }
        log.info("User retention: processing PROFESSOR_OR_EMPLOYEE userId={}", user.getUserId());

        UUID deletedUserId = userRetentionProperties.getDeletedUserId();
        if (deletedUserId == null || !userRepository.existsById(deletedUserId)) {
            log.warn("User retention: deletedUserId is not configured or missing; skipping anonymization for userId={}", user.getUserId());
            return;
        }
        User deletedUser = userRepository.getReferenceById(deletedUserId);
        imageRepository.dissociateImagesFromUser(user, deletedUser);
        jobRepository.anonymiseJobByUserId(user, deletedUser, JobState.CLOSED);
        internalCommentRepository.anonymiseByCreatedBy(user, deletedUser);
        emailTemplateRepository.anonymiseByCreatedBy(user, deletedUser);
    }

    private void handleGeneralData(User user, boolean dryRun) {
        if (dryRun) {
            log.info("User retention (dry-run): would process general data for userId={}", user.getUserId());
            return;
        }
        log.info("User retention: processing general data for userId={}", user.getUserId());

        // Common data deletion/anonymization for all users
        emailSettingRepository.deleteByUser(user);
        UUID resolvedUserId = user.getUserId();
        imageService.deleteProfilePictureByUserId(resolvedUserId);
        userSettingRepository.deleteByUser(user);
        userResearchGroupRoleRepository.deleteByUserId(resolvedUserId);
        userRepository.deleteByUserId(resolvedUserId);
    }
}
