package de.tum.cit.aet.reference.service;

import de.tum.cit.aet.application.constants.ApplicationState;
import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.application.repository.ApplicationRepository;
import de.tum.cit.aet.core.constants.DocumentType;
import de.tum.cit.aet.core.constants.Language;
import de.tum.cit.aet.core.documents.domain.ApplicationDocument;
import de.tum.cit.aet.core.documents.service.DocumentService;
import de.tum.cit.aet.core.exception.BadRequestException;
import de.tum.cit.aet.core.exception.EntityNotFoundException;
import de.tum.cit.aet.core.exception.OperationNotAllowedException;
import de.tum.cit.aet.core.service.CurrentUserService;
import de.tum.cit.aet.job.constants.RecommendationType;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.notification.constants.EmailType;
import de.tum.cit.aet.notification.dto.ReferenceLetterContextDTO;
import de.tum.cit.aet.notification.service.AsyncEmailSender;
import de.tum.cit.aet.notification.service.mail.Email;
import de.tum.cit.aet.reference.constants.ReferenceRequestStatus;
import de.tum.cit.aet.reference.domain.ReferenceRequest;
import de.tum.cit.aet.reference.dto.RefereeContactDTO;
import de.tum.cit.aet.reference.dto.ReferenceLetterSubmissionDTO;
import de.tum.cit.aet.reference.dto.ReferenceLetterUploadContextDTO;
import de.tum.cit.aet.reference.dto.ReferenceRequestDTO;
import de.tum.cit.aet.reference.repository.ReferenceRequestRepository;
import de.tum.cit.aet.usermanagement.domain.User;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Manages the referee contacts an applicant attaches to an application and dispatches the
 * tokenized invitation emails when the application is submitted.
 */
@Service
@RequiredArgsConstructor
public class ReferenceRequestService {

    private static final int TOKEN_BYTE_LENGTH = 32;
    private static final int DEFAULT_VALIDITY_MONTHS = 2;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final DateTimeFormatter DEADLINE_FORMATTER = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm 'UTC'");
    private static final int MAX_REMINDERS = 2;
    private static final long FIRST_REMINDER_HOURS = 24L * 7;
    private static final long FINAL_REMINDER_HOURS = 24L;

    /**
     * Application states in which an applicant may still add, edit or remove referee contacts.
     * Excludes the terminal states (accepted, rejected, withdrawn, job closed) where the outcome is fixed.
     */
    private static final Set<ApplicationState> REFERENCE_MANAGEABLE_STATES = EnumSet.of(
        ApplicationState.SAVED,
        ApplicationState.SENT,
        ApplicationState.IN_REVIEW,
        ApplicationState.INTERVIEW
    );

    private final ReferenceRequestRepository referenceRequestRepository;
    private final ApplicationRepository applicationRepository;
    private final CurrentUserService currentUserService;
    private final AsyncEmailSender emailSender;
    private final DocumentService documentService;

    @Value("${aet.client.url:}")
    private String clientUrl;

    /**
     * Retrieves the raw {@link ReferenceRequest} entities attached to the given application,
     * ordered by creation time. Intended for callers that need the domain entity
     * (e.g. data export) rather than the DTO returned by {@link #getReferences(UUID)}.
     *
     * @param applicationId the owning application id
     * @return list of reference requests ordered ascending by creation time
     */
    public List<ReferenceRequest> findAllByApplicationIdOrdered(UUID applicationId) {
        return referenceRequestRepository.findByApplicationApplicationIdOrderByCreatedAtAsc(applicationId);
    }

    /**
     * Lists all referee contacts attached to the given application, ordered by creation time.
     * Checks that the current user owns the application or is an admin or a research group member of the job.
     *
     * @param applicationId the owning application
     * @return all reference requests, mapped to DTOs (no token data)
     */
    public List<ReferenceRequestDTO> getReferences(UUID applicationId) {
        Application application = applicationRepository
            .findByIdWithApplicantAndJob(applicationId)
            .orElseThrow(() -> EntityNotFoundException.forId("Application", applicationId));
        if (!currentUserService.isAdmin() && !currentUserService.isCurrentUser(application.getApplicant().getUserId())) {
            currentUserService.assertAccessTo(application.getJob().getResearchGroup());
        }
        return referenceRequestRepository
            .findByApplicationApplicationIdOrderByCreatedAtAsc(application.getApplicationId())
            .stream()
            .map(ReferenceRequestDTO::fromEntity)
            .toList();
    }

    /**
     * Adds a new referee contact to the application. Allowed while the application is in a
     * non-terminal state and the job has reference letters enabled. When the application has
     * already been submitted the referee is invited immediately; in a draft the invitation is
     * deferred until the application is submitted.
     *
     * @param applicationId the owning application
     * @param payload       the referee's title, name and email
     * @return the persisted entry as a DTO
     */
    public ReferenceRequestDTO addToApplication(UUID applicationId, RefereeContactDTO payload) {
        Application application = assertOwnsApplication(applicationId);
        assertReferencesManageable(application);
        assertReferenceLettersEnabled(application);

        ReferenceRequest entry = new ReferenceRequest();
        entry.setApplication(application);
        entry.setTitle(payload.title());
        entry.setFirstName(payload.firstName().trim());
        entry.setLastName(payload.lastName().trim());
        entry.setEmail(payload.email().trim());
        entry.setStatus(ReferenceRequestStatus.ADDED);

        if (application.getState() == ApplicationState.SAVED) {
            referenceRequestRepository.save(entry);
        } else {
            issueInvitation(application, entry);
        }
        return ReferenceRequestDTO.fromEntity(entry);
    }

    /**
     * Marks the reference request behind the token as {@code DECLINED} when the referee chooses not
     * to provide a letter. Only a {@code REQUESTED} request with a non-expired token may be declined;
     * the decision is terminal.
     *
     * @param rawToken the plaintext token from the invitation email
     * @return the updated request as a DTO
     * @throws EntityNotFoundException      when the token is unknown
     * @throws OperationNotAllowedException when the request is no longer open for a decision
     */
    public ReferenceRequestDTO declineRequest(String rawToken) {
        ReferenceRequest entry = findByRawToken(rawToken);
        assertReferenceActionAllowed(entry);
        entry.setStatus(ReferenceRequestStatus.DECLINED);
        ReferenceRequest saved = referenceRequestRepository.save(entry);
        return ReferenceRequestDTO.fromEntity(saved);
    }

    /**
     * Updates the title, name and email of an existing referee contact. A reference whose letter has
     * already been submitted is immutable. When the application has already been submitted and the email
     * changes, a fresh invitation is issued to the new address (rotating the token so any earlier link
     * stops working).
     *
     * @param applicationId the owning application
     * @param referenceId   the entry to update
     * @param payload       the new title, name and email
     * @return the updated entry as a DTO
     */
    public ReferenceRequestDTO updateInApplication(UUID applicationId, UUID referenceId, RefereeContactDTO payload) {
        Application application = assertOwnsApplication(applicationId);
        assertReferencesManageable(application);

        ReferenceRequest entry = referenceRequestRepository
            .findByIdWithApplication(referenceId)
            .orElseThrow(() -> EntityNotFoundException.forId("ReferenceRequest", referenceId));
        if (!entry.getApplication().getApplicationId().equals(application.getApplicationId())) {
            throw new OperationNotAllowedException("Reference does not belong to the given application.");
        }
        if (entry.getStatus() == ReferenceRequestStatus.SUBMITTED) {
            throw new OperationNotAllowedException("A reference whose letter was already submitted can no longer be edited.");
        }

        String previousEmail = entry.getEmail() == null ? "" : entry.getEmail().trim();
        entry.setTitle(payload.title());
        entry.setFirstName(payload.firstName().trim());
        entry.setLastName(payload.lastName().trim());
        entry.setEmail(payload.email().trim());

        boolean emailChanged = !entry.getEmail().equalsIgnoreCase(previousEmail);
        boolean alreadyInvited =
            entry.getStatus() == ReferenceRequestStatus.REQUESTED || entry.getStatus() == ReferenceRequestStatus.EXPIRED;

        if (emailChanged && alreadyInvited && application.getJob().getReferenceLettersRequired() > 0) {
            issueInvitation(application, entry);
        } else {
            referenceRequestRepository.save(entry);
        }
        return ReferenceRequestDTO.fromEntity(entry);
    }

    /**
     * Removes a referee contact from the application. Allowed while the application is in a non-terminal
     * state, except for references whose letter has already been submitted.
     *
     * @param applicationId the owning application
     * @param referenceId   the entry to remove
     */
    public void removeFromApplication(UUID applicationId, UUID referenceId) {
        Application application = assertOwnsApplication(applicationId);
        assertReferencesManageable(application);

        ReferenceRequest entry = referenceRequestRepository
            .findByIdWithApplication(referenceId)
            .orElseThrow(() -> EntityNotFoundException.forId("ReferenceRequest", referenceId));
        if (!entry.getApplication().getApplicationId().equals(application.getApplicationId())) {
            throw new OperationNotAllowedException("Reference does not belong to the given application.");
        }
        if (entry.getStatus() == ReferenceRequestStatus.SUBMITTED) {
            throw new OperationNotAllowedException("A reference whose letter was already submitted can no longer be removed.");
        }
        referenceRequestRepository.delete(entry);
    }

    /**
     * Generates and persists a fresh token for each pending entry on the application and dispatches
     * the invitation email. Must be called from a transactional context — the caller's transaction
     * keeps {@code application.job} / {@code application.job.researchGroup} attached for lazy access.
     *
     * @param application the application whose referees should be notified
     */
    public void dispatchInvitations(Application application) {
        if (application.getJob().getReferenceLettersRequired() <= 0) {
            return;
        }
        List<ReferenceRequest> entries = referenceRequestRepository.findByApplicationApplicationIdOrderByCreatedAtAsc(
            application.getApplicationId()
        );
        for (ReferenceRequest entry : entries) {
            if (entry.getStatus() != ReferenceRequestStatus.ADDED || entry.getTokenHash() != null) {
                continue;
            }
            issueInvitation(application, entry);
        }
    }

    /**
     * Issues a fresh token for a single referee, marks the entry {@code REQUESTED}, resets its reminder
     * bookkeeping and sends the invitation email. Used both for the bulk dispatch at submission time and
     * when a referee is added or re-pointed to a new email after the application was already submitted.
     *
     * @param application the owning application
     * @param entry       the referee entry to (re-)invite
     */
    private void issueInvitation(Application application, ReferenceRequest entry) {
        String rawToken = generateToken();
        LocalDateTime expiry = computeTokenExpiry(application.getJob());

        entry.setStatus(ReferenceRequestStatus.REQUESTED);
        entry.setTokenHash(hashToken(rawToken));
        entry.setTokenExpiresAt(expiry);
        entry.setLastReminderAt(null);

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime deadline = expiry.atZone(ZoneOffset.systemDefault()).toLocalDateTime();
        long hoursUntilDeadline = ChronoUnit.HOURS.between(now, deadline);
        if (hoursUntilDeadline <= FINAL_REMINDER_HOURS) {
            entry.setReminderCount(MAX_REMINDERS);
        } else if (hoursUntilDeadline <= FIRST_REMINDER_HOURS) {
            entry.setReminderCount(1);
        } else {
            entry.setReminderCount(0);
        }

        referenceRequestRepository.save(entry);
        sendRefereeEmail(application, entry, rawToken, EmailType.REFERENCE_LETTER_INVITATION);
    }

    /**
     * Returns the context data the referee needs to see on the upload page, based on the token in their
     * invitation email. The token is resolved to a reference request, and the associated application and job
     * are loaded to extract the applicant and job details for display.
     *
     * @param rawToken the plaintext token from the invitation email
     * @return the context the referee sees on the upload page
     * @throws EntityNotFoundException when the token is unknown
     */
    public ReferenceLetterUploadContextDTO getContextByToken(String rawToken) {
        ReferenceRequest entry = findByRawToken(rawToken);
        Application application = entry.getApplication();
        Job job = application.getJob();
        return new ReferenceLetterUploadContextDTO(
            application.getApplicantFirstName(),
            application.getApplicantLastName(),
            job.getTitle(),
            job.getResearchGroup() != null ? job.getResearchGroup().getName() : null,
            entry.getTokenExpiresAt(),
            entry.getStatus(),
            application.isReferenceLettersConfidential(),
            job.getRecommendationType()
        );
    }

    /**
     * Copies the structured assessment answers onto the reference request entity.
     *
     * @param entry      the reference request being submitted
     * @param assessment the answers the referee provided
     */
    private void applyAssessment(ReferenceRequest entry, ReferenceLetterSubmissionDTO assessment) {
        entry.setRelationship(assessment.relationship());
        entry.setAcquaintanceDuration(assessment.acquaintanceDuration());
        entry.setAcquaintanceDepth(assessment.acquaintanceDepth());
        entry.setRatingIntellectualAbility(assessment.ratingIntellectualAbility());
        entry.setRatingResearchPotential(assessment.ratingResearchPotential());
        entry.setRatingMotivation(assessment.ratingMotivation());
        entry.setRatingCommunication(assessment.ratingCommunication());
        entry.setRatingLeadership(assessment.ratingLeadership());
        entry.setRatingCollaboration(assessment.ratingCollaboration());
        entry.setOverallRecommendation(assessment.overallRecommendation());
    }

    /**
     * Stores the recommendation an external referee submitted — the letter PDF, the structured
     * assessment answers, or both, depending on the job's recommendation type — links any uploaded
     * document to the reference request and marks the request {@code SUBMITTED}.
     *
     * @param rawToken          the plaintext token from the invitation email
     * @param recommendation    the answer the referee submitted
     * @return the updated request as a DTO
     */
    public ReferenceRequestDTO uploadLetter(String rawToken, ReferenceLetterSubmissionDTO recommendation) {
        ReferenceRequest entry = findByRawToken(rawToken);
        assertReferenceActionAllowed(entry);

        Application application = entry.getApplication();
        RecommendationType recommendationType = application.getJob().getRecommendationType();
        assertSubmissionMatchesType(recommendationType, recommendation);

        if (recommendationType != RecommendationType.EVALUATION_ONLY) {
            String displayName = "Reference letter — " + entry.getFirstName() + " " + entry.getLastName();

            ApplicationDocument document = documentService.uploadApplicationDocument(
                recommendation.letter(),
                DocumentType.REFERENCE_LETTER,
                displayName,
                application,
                null
            );
            entry.setDocumentId(document.getDocumentId());
        }

        if (recommendationType != RecommendationType.LETTER_ONLY) {
            applyAssessment(entry, recommendation);
        }
        entry.setStatus(ReferenceRequestStatus.SUBMITTED);
        ReferenceRequest saved = referenceRequestRepository.save(entry);

        return ReferenceRequestDTO.fromEntity(saved);
    }

    /**
     * Verifies that the submission contains exactly the parts the job's recommendation type asks
     * for: the letter is required unless the job is evaluation-only, the complete assessment is
     * required unless the job is letter-only, and parts that were not asked for are rejected so
     * stale clients cannot store data the professor never requested.
     *
     * @param recommendationType what the job asks recommenders to provide
     * @param recommendation     the submission to validate
     */
    private void assertSubmissionMatchesType(RecommendationType recommendationType, ReferenceLetterSubmissionDTO recommendation) {
        boolean letterRequired = recommendationType != RecommendationType.EVALUATION_ONLY;
        boolean assessmentRequired = recommendationType != RecommendationType.LETTER_ONLY;

        if (letterRequired && !recommendation.hasLetter()) {
            throw new BadRequestException("A recommendation letter file is required for this job.");
        }
        if (!letterRequired && recommendation.hasLetter()) {
            throw new BadRequestException("This job does not accept a recommendation letter file.");
        }
        if (assessmentRequired && !recommendation.hasCompleteAssessment()) {
            throw new BadRequestException("All structured assessment answers are required for this job.");
        }
        if (!assessmentRequired && recommendation.hasAnyAssessmentAnswer()) {
            throw new BadRequestException("This job does not accept structured assessment answers.");
        }
    }

    /**
     * Utility method to fetch all reference requests for a list of application IDs, grouped by application ID.
     *
     * @param applicationIds the list of application IDs to fetch reference requests for
     * @return a map with application IDs as keys and a set of reference requests associated with that application as values
     */
    public Map<UUID, Set<ReferenceRequest>> getReferencesForApplicationIds(List<UUID> applicationIds) {
        return referenceRequestRepository
            .findByApplicationIds(applicationIds)
            .stream()
            .collect(Collectors.groupingBy(r -> r.getApplication().getApplicationId(), Collectors.toCollection(HashSet::new)));
    }

    /**
     * Cancels every still-pending reference request on a withdrawn application and notifies the referee
     * that their recommendation is no longer needed. Only {@code REQUESTED} entries are affected.
     * Already submitted, declined or expired requests are left untouched.
     *
     * @param application the application that was just withdrawn
     */
    public void cancelPendingForWithdrawnApplication(Application application) {
        List<ReferenceRequest> entries = referenceRequestRepository.findByApplicationApplicationIdOrderByCreatedAtAsc(
            application.getApplicationId()
        );
        for (ReferenceRequest entry : entries) {
            if (entry.getStatus() != ReferenceRequestStatus.REQUESTED) {
                continue;
            }
            entry.setStatus(ReferenceRequestStatus.CANCELLED);
            referenceRequestRepository.save(entry);
            sendCancellationEmail(application, entry);
        }
    }

    /**
     * Flips every {@code REQUESTED} entry whose token has already lapsed to {@code EXPIRED}.
     *
     * @return the number of rows that were transitioned to EXPIRED
     */
    public int expireOverdueRequests() {
        return referenceRequestRepository.expireOverdueRequests(LocalDateTime.now());
    }

    /**
     * Rotates the token and sends a reminder email for each REQUESTED entry whose deadline is
     * within the configured reminder windows.
     * Each reminder rotates the token (the previous hash is overwritten), so the new email's link
     * is the one that works — earlier emails stop accepting uploads.
     *
     * @return the number of reminder emails dispatched in this run
     */
    public int sendReminders() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime upperBound = now.plusHours(FIRST_REMINDER_HOURS);
        List<ReferenceRequest> candidates = referenceRequestRepository.findReminderCandidates(now, upperBound, MAX_REMINDERS);

        int sent = 0;
        for (ReferenceRequest entry : candidates) {
            if (!shouldSendReminder(entry, now)) {
                continue;
            }
            String rawToken = generateToken();
            entry.setTokenHash(hashToken(rawToken));
            entry.setReminderCount(entry.getReminderCount() + 1);
            entry.setLastReminderAt(now);
            referenceRequestRepository.save(entry);
            sendRefereeEmail(entry.getApplication(), entry, rawToken, EmailType.REFERENCE_LETTER_REMINDER);
            sent++;
        }
        return sent;
    }

    /**
     * Decides whether the given entry currently qualifies for a reminder.
     * First reminder when the deadline is within {@value #FIRST_REMINDER_HOURS}h and {@code reminderCount &lt; 1}
     * Final reminder when the deadline is within {@value #FINAL_REMINDER_HOURS}h and {@code reminderCount &lt; 2}
     *
     * @param entry the candidate reference request (already filtered by repository query)
     * @param now   the run's reference timestamp
     * @return true when this entry should receive a reminder now
     */
    private boolean shouldSendReminder(ReferenceRequest entry, LocalDateTime now) {
        LocalDateTime deadline = entry.getTokenExpiresAt().atZone(ZoneOffset.systemDefault()).toLocalDateTime();
        long hoursUntilDeadline = ChronoUnit.HOURS.between(now, deadline);
        if (entry.getReminderCount() < MAX_REMINDERS && hoursUntilDeadline <= FINAL_REMINDER_HOURS) {
            return true;
        }
        return entry.getReminderCount() < 1 && hoursUntilDeadline <= FIRST_REMINDER_HOURS;
    }

    /**
     * Resolves a raw token to its persisted request. Caller is responsible for any lifecycle checks.
     *
     * @param rawToken the plaintext token from the invitation email
     * @return the matching reference request
     * @throws EntityNotFoundException when no request matches the token
     */
    private ReferenceRequest findByRawToken(String rawToken) {
        return referenceRequestRepository
            .findByTokenHashWithApplication(hashToken(rawToken))
            .orElseThrow(() -> new EntityNotFoundException("ReferenceRequest"));
    }

    /**
     * Guards token-backed referee actions: only {@code REQUESTED} requests with a non-expired token may
     * be changed. Already-submitted, expired or already-declined requests are immutable.
     *
     * @param entry the reference request being changed
     */
    private void assertReferenceActionAllowed(ReferenceRequest entry) {
        if (entry.getStatus() != ReferenceRequestStatus.REQUESTED) {
            throw new OperationNotAllowedException("This reference request is no longer accepting changes.");
        }
        if (entry.getTokenExpiresAt() != null && entry.getTokenExpiresAt().isBefore(LocalDateTime.now())) {
            throw new OperationNotAllowedException("This reference letter upload link has expired.");
        }
    }

    /**
     * Loads the application and verifies the current user owns it (or is an admin).
     *
     * @param applicationId the application to load
     * @return the loaded application with eager applicant, job and research group
     */
    private Application assertOwnsApplication(UUID applicationId) {
        Application application = applicationRepository
            .findByIdWithApplicantJobAndResearchGroup(applicationId)
            .orElseThrow(() -> EntityNotFoundException.forId("Application", applicationId));
        currentUserService.assertAccessTo(application);
        return application;
    }

    private void assertReferencesManageable(Application application) {
        LocalDate jobEndDate = application.getJob().getEndDate();
        if (!REFERENCE_MANAGEABLE_STATES.contains(application.getState()) || (jobEndDate != null && jobEndDate.isBefore(LocalDate.now()))) {
            throw new OperationNotAllowedException("References can no longer be modified for this application.");
        }
    }

    private void assertReferenceLettersEnabled(Application application) {
        if (application.getJob().getReferenceLettersRequired() <= 0) {
            throw new OperationNotAllowedException("Reference letters are not enabled for this job.");
        }
    }

    /**
     * Builds a referee-facing email (invitation or reminder) and hands it to the async sender. The
     * referee has no User account, so a transient {@link User} stub holds the email address required
     * by the mail layer.
     *
     * @param application the application the referee is attached to
     * @param entry       the reference request entry containing the referee's name and email
     * @param rawToken    the plaintext token to include in the email link
     * @param emailType   the type of email to send (invitation or reminder)
     */
    private void sendRefereeEmail(Application application, ReferenceRequest entry, String rawToken, EmailType emailType) {
        Job job = application.getJob();
        User refereeStub = new User();
        refereeStub.setEmail(entry.getEmail());
        refereeStub.setFirstName(entry.getFirstName());
        refereeStub.setLastName(entry.getLastName());

        String referenceLink = clientUrl + "/reference/" + rawToken;
        String deadline =
            entry.getTokenExpiresAt() != null
                ? entry
                      .getTokenExpiresAt()
                      .atZone(ZoneOffset.systemDefault())
                      .withZoneSameInstant(ZoneOffset.UTC)
                      .format(DEADLINE_FORMATTER)
                : "";

        ReferenceLetterContextDTO ctx = new ReferenceLetterContextDTO(
            entry.getTitle(),
            entry.getFirstName(),
            entry.getLastName(),
            application.getApplicantFirstName(),
            application.getApplicantLastName(),
            job.getTitle(),
            job.getResearchGroup().getName(),
            referenceLink,
            deadline,
            job.getRecommendationType()
        );

        Email email = Email.builder()
            .to(refereeStub)
            .language(Language.ENGLISH)
            .emailType(emailType)
            .content(ctx)
            .researchGroup(job.getResearchGroup())
            .sendAlways(true)
            .build();

        emailSender.sendAsync(email);
    }

    /**
     * Notifies a referee that a request was cancelled because the applicant withdrew their application.
     *
     * @param application the withdrawn application the referee was attached to
     * @param entry       the reference request that was cancelled
     */
    private void sendCancellationEmail(Application application, ReferenceRequest entry) {
        Job job = application.getJob();
        User refereeStub = new User();
        refereeStub.setEmail(entry.getEmail());
        refereeStub.setFirstName(entry.getFirstName());
        refereeStub.setLastName(entry.getLastName());

        ReferenceLetterContextDTO ctx = new ReferenceLetterContextDTO(
            entry.getTitle(),
            entry.getFirstName(),
            entry.getLastName(),
            application.getApplicantFirstName(),
            application.getApplicantLastName(),
            job.getTitle(),
            job.getResearchGroup().getName(),
            "",
            "",
            job.getRecommendationType()
        );

        Email email = Email.builder()
            .to(refereeStub)
            .language(Language.ENGLISH)
            .emailType(EmailType.REFERENCE_LETTER_CANCELLED)
            .content(ctx)
            .researchGroup(job.getResearchGroup())
            .sendAlways(true)
            .build();

        emailSender.sendAsync(email);
    }

    /**
     * Resolves the latest valid expiry for a freshly issued token:
     * Job's end date if set, otherwise defaults to {@value #DEFAULT_VALIDITY_MONTHS} months from now.
     *
     * @param job the job the application belongs to, used to determine the token expiry
     * @return the computed token expiry timestamp
     */
    private LocalDateTime computeTokenExpiry(Job job) {
        LocalDate jobEnd = job.getEndDate();

        LocalDate expiryDate = (jobEnd != null) ? jobEnd : LocalDate.now().plusMonths(DEFAULT_VALIDITY_MONTHS);

        return expiryDate.atTime(23, 59, 59).atZone(ZoneOffset.UTC).withZoneSameInstant(ZoneOffset.systemDefault()).toLocalDateTime();
    }

    /**
     * @return a 256-bit cryptographically random token, URL-safe Base64 encoded.
     */
    private static String generateToken() {
        byte[] bytes = new byte[TOKEN_BYTE_LENGTH];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * Hashes a high-entropy token with SHA-256 for safe storage. Plain SHA-256 is acceptable
     * here because the token already carries 256 bits of entropy; slow hashing (BCrypt) would
     * add no additional brute-force resistance for a uniformly random secret of this size.
     *
     * @param rawToken the plaintext token to hash
     * @return the hashed token
     */
    private static String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required", e);
        }
    }
}
