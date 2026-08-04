package de.tum.cit.aet.reference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.application.constants.ApplicationState;
import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.application.domain.dto.ApplicationForApplicantDTO;
import de.tum.cit.aet.application.domain.dto.UpdateApplicationDTO;
import de.tum.cit.aet.application.repository.ApplicationRepository;
import de.tum.cit.aet.job.constants.JobState;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.job.repository.JobRepository;
import de.tum.cit.aet.notification.service.AsyncEmailSender;
import de.tum.cit.aet.reference.constants.ReferenceRequestStatus;
import de.tum.cit.aet.reference.domain.ReferenceRequest;
import de.tum.cit.aet.reference.dto.RefereeContactDTO;
import de.tum.cit.aet.reference.dto.ReferenceRequestDTO;
import de.tum.cit.aet.reference.repository.ReferenceRequestRepository;
import de.tum.cit.aet.reference.service.ReferenceRequestService;
import de.tum.cit.aet.usermanagement.domain.Applicant;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.dto.ApplicantDTO;
import de.tum.cit.aet.usermanagement.repository.ApplicantRepository;
import de.tum.cit.aet.usermanagement.repository.ResearchGroupRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import de.tum.cit.aet.utility.DatabaseCleaner;
import de.tum.cit.aet.utility.MvcTestClient;
import de.tum.cit.aet.utility.security.JwtPostProcessors;
import de.tum.cit.aet.utility.testdata.ApplicantTestData;
import de.tum.cit.aet.utility.testdata.ApplicationTestData;
import de.tum.cit.aet.utility.testdata.JobTestData;
import de.tum.cit.aet.utility.testdata.ReferenceRequestTestData;
import de.tum.cit.aet.utility.testdata.ResearchGroupTestData;
import de.tum.cit.aet.utility.testdata.UserTestData;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.core.type.TypeReference;

class ReferenceRequestResourceTest extends AbstractResourceTest {

    private static final String REFERENCES_URL = "/api/applications/%s/references";
    private static final String REFERENCE_BY_ID_URL = "/api/applications/%s/references/%s";

    @Autowired
    ApplicationRepository applicationRepository;

    @Autowired
    JobRepository jobRepository;

    @Autowired
    UserRepository userRepository;

    @Autowired
    ApplicantRepository applicantRepository;

    @Autowired
    ResearchGroupRepository researchGroupRepository;

    @Autowired
    ReferenceRequestRepository referenceRequestRepository;

    @Autowired
    ReferenceRequestService referenceRequestService;

    @Autowired
    DatabaseCleaner databaseCleaner;

    @Autowired
    MvcTestClient api;

    private AsyncEmailSender mockSender;

    private ResearchGroup researchGroup;
    private User professor;
    private Applicant applicant;
    private Job jobWithReferences;
    private Application savedApplication;

    @BeforeEach
    void setup() {
        databaseCleaner.clean();
        api.withoutPostProcessors();
        mockSender = mock(AsyncEmailSender.class);
        ReflectionTestUtils.setField(referenceRequestService, "emailSender", mockSender);
        researchGroup = ResearchGroupTestData.saved(researchGroupRepository);
        professor = UserTestData.savedProfessor(userRepository, researchGroup);
        applicant = ApplicantTestData.savedWithNewUser(applicantRepository, userRepository);

        jobWithReferences = JobTestData.saved(
            jobRepository,
            professor,
            researchGroup,
            "PhD Position with Recommendations",
            JobState.PUBLISHED,
            LocalDate.of(2026, 9, 1)
        );
        jobWithReferences.setReferenceLettersRequired(2);
        jobWithReferences = jobRepository.save(jobWithReferences);

        savedApplication = ApplicationTestData.saved(applicationRepository, jobWithReferences, applicant, ApplicationState.SAVED);
    }

    private RefereeContactDTO defaultPayload() {
        return new RefereeContactDTO("Prof. Dr.", "Ada", "Lovelace", "ada@example.com");
    }

    private List<ReferenceRequestDTO> getReferencesAsApplicant(UUID applicationId) {
        return api
            .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
            .getAndRead(String.format(REFERENCES_URL, applicationId), null, new TypeReference<>() {}, 200);
    }

    @Nested
    class GetReferences {

        @Test
        void shouldReturnEmptyListWhenNoneAdded() {
            List<ReferenceRequestDTO> references = getReferencesAsApplicant(savedApplication.getApplicationId());

            assertThat(references).isEmpty();
        }

        @Test
        void shouldReturnAllAttachedReferencesInInsertionOrder() {
            ReferenceRequestTestData.saved(referenceRequestRepository, savedApplication, "first@example.com");
            ReferenceRequestTestData.saved(referenceRequestRepository, savedApplication, "second@example.com");

            List<ReferenceRequestDTO> references = getReferencesAsApplicant(savedApplication.getApplicationId());

            assertThat(references)
                .hasSize(2)
                .extracting(ReferenceRequestDTO::email)
                .containsExactly("first@example.com", "second@example.com");
        }

        @Test
        void shouldReject401WhenUnauthenticated() {
            api.getAndReturnBytes(String.format(REFERENCES_URL, savedApplication.getApplicationId()), null, 401);
        }
    }

    @Nested
    class AddReference {

        @Test
        void shouldPersistReferenceWithAddedStatus() {
            RefereeContactDTO payload = defaultPayload();

            ReferenceRequestDTO created = api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .postAndRead(String.format(REFERENCES_URL, savedApplication.getApplicationId()), payload, ReferenceRequestDTO.class, 201);

            assertThat(created.referenceRequestId()).isNotNull();
            assertThat(created.email()).isEqualTo(payload.email());
            assertThat(created.status()).isEqualTo(ReferenceRequestStatus.ADDED);

            assertThat(referenceRequestRepository.findByApplicationApplicationIdOrderByCreatedAtAsc(savedApplication.getApplicationId()))
                .singleElement()
                .satisfies(persisted -> {
                    assertThat(persisted.getEmail()).isEqualTo(payload.email());
                    assertThat(persisted.getFirstName()).isEqualTo(payload.firstName());
                    assertThat(persisted.getLastName()).isEqualTo(payload.lastName());
                    assertThat(persisted.getStatus()).isEqualTo(ReferenceRequestStatus.ADDED);
                });
        }

        @Test
        void shouldTrimWhitespaceFromNameFieldsOnPersist() {
            RefereeContactDTO payload = new RefereeContactDTO("  Prof.  ", "  Alan  ", "  Turing  ", "alan@example.com");

            api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .postAndRead(String.format(REFERENCES_URL, savedApplication.getApplicationId()), payload, ReferenceRequestDTO.class, 201);

            ReferenceRequest persisted = referenceRequestRepository
                .findByApplicationApplicationIdOrderByCreatedAtAsc(savedApplication.getApplicationId())
                .getFirst();
            assertThat(persisted.getFirstName()).isEqualTo("Alan");
            assertThat(persisted.getLastName()).isEqualTo("Turing");
            assertThat(persisted.getEmail()).isEqualTo("alan@example.com");
        }

        @Test
        void shouldInviteImmediatelyWhenAddingToSubmittedApplication() {
            Application sentApplication = ApplicationTestData.saved(
                applicationRepository,
                jobWithReferences,
                applicant,
                ApplicationState.SENT
            );

            ReferenceRequestDTO created = api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .postAndRead(
                    String.format(REFERENCES_URL, sentApplication.getApplicationId()),
                    defaultPayload(),
                    ReferenceRequestDTO.class,
                    201
                );

            assertThat(created.status()).isEqualTo(ReferenceRequestStatus.REQUESTED);
            ReferenceRequest persisted = referenceRequestRepository.findById(created.referenceRequestId()).orElseThrow();
            assertThat(persisted.getStatus()).isEqualTo(ReferenceRequestStatus.REQUESTED);
            assertThat(persisted.getTokenHash()).isNotBlank();
            assertThat(persisted.getTokenExpiresAt()).isNotNull();
            verify(mockSender, times(1)).sendAsync(any());
        }

        @Test
        void shouldRejectWhenApplicationInTerminalState() {
            Application withdrawnApplication = ApplicationTestData.saved(
                applicationRepository,
                jobWithReferences,
                applicant,
                ApplicationState.WITHDRAWN
            );

            api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .postAndReturnBytes(String.format(REFERENCES_URL, withdrawnApplication.getApplicationId()), defaultPayload(), 400);
        }

        @Test
        void shouldRejectWhenJobDoesNotRequireReferences() {
            Job jobWithout = JobTestData.saved(
                jobRepository,
                professor,
                researchGroup,
                "Plain Position",
                JobState.PUBLISHED,
                LocalDate.of(2026, 12, 1)
            );
            Application application = ApplicationTestData.saved(applicationRepository, jobWithout, applicant, ApplicationState.SAVED);

            api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .postAndReturnBytes(String.format(REFERENCES_URL, application.getApplicationId()), defaultPayload(), 400);
        }
    }

    @Nested
    class RemoveReference {

        @Test
        void shouldDeleteExistingReference() {
            ReferenceRequest entry = ReferenceRequestTestData.saved(referenceRequestRepository, savedApplication, "drop@example.com");

            api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .deleteAndRead(
                    String.format(REFERENCE_BY_ID_URL, savedApplication.getApplicationId(), entry.getReferenceRequestId()),
                    null,
                    Void.class,
                    204
                );

            assertThat(referenceRequestRepository.findById(entry.getReferenceRequestId())).isEmpty();
        }

        @Test
        void shouldReject404WhenReferenceUnknown() {
            api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .deleteAndRead(
                    String.format(REFERENCE_BY_ID_URL, savedApplication.getApplicationId(), UUID.randomUUID()),
                    null,
                    Void.class,
                    404
                );
        }

        @Test
        void shouldRejectWhenReferenceBelongsToDifferentApplication() {
            Application otherApplication = ApplicationTestData.saved(
                applicationRepository,
                jobWithReferences,
                applicant,
                ApplicationState.SAVED
            );
            ReferenceRequest foreignEntry = ReferenceRequestTestData.saved(
                referenceRequestRepository,
                otherApplication,
                "foreign@example.com"
            );

            api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .deleteAndRead(
                    String.format(REFERENCE_BY_ID_URL, savedApplication.getApplicationId(), foreignEntry.getReferenceRequestId()),
                    null,
                    Void.class,
                    400
                );

            assertThat(referenceRequestRepository.findById(foreignEntry.getReferenceRequestId())).isPresent();
        }

        @Test
        void shouldRejectRemovingSubmittedReference() {
            ReferenceRequest entry = ReferenceRequestTestData.newReferenceRequest(savedApplication, "done@example.com");
            entry.setStatus(ReferenceRequestStatus.SUBMITTED);
            entry = referenceRequestRepository.save(entry);

            api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .deleteAndRead(
                    String.format(REFERENCE_BY_ID_URL, savedApplication.getApplicationId(), entry.getReferenceRequestId()),
                    null,
                    Void.class,
                    400
                );

            assertThat(referenceRequestRepository.findById(entry.getReferenceRequestId())).isPresent();
        }
    }

    @Nested
    class UpdateReference {

        @Test
        void shouldUpdateTitleNameAndEmailWithoutEmailingWhileDraft() {
            ReferenceRequest entry = referenceRequestRepository.save(
                ReferenceRequestTestData.newReferenceRequest(
                    savedApplication,
                    "Prof.",
                    "Ada",
                    "Lovelace",
                    "old@example.com",
                    ReferenceRequestStatus.ADDED
                )
            );
            RefereeContactDTO payload = new RefereeContactDTO("Dr.", "Grace", "Hopper", "grace@example.com");

            ReferenceRequestDTO updated = api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .putAndRead(
                    String.format(REFERENCE_BY_ID_URL, savedApplication.getApplicationId(), entry.getReferenceRequestId()),
                    payload,
                    ReferenceRequestDTO.class,
                    200
                );

            assertThat(updated.firstName()).isEqualTo("Grace");
            assertThat(updated.lastName()).isEqualTo("Hopper");
            assertThat(updated.email()).isEqualTo("grace@example.com");
            ReferenceRequest persisted = referenceRequestRepository.findById(entry.getReferenceRequestId()).orElseThrow();
            assertThat(persisted.getTitle()).isEqualTo("Dr.");
            assertThat(persisted.getStatus()).isEqualTo(ReferenceRequestStatus.ADDED);
            verify(mockSender, never()).sendAsync(any());
        }

        @Test
        void shouldResendInvitationWhenEmailChangesAfterSubmission() {
            Application pendingApplication = ApplicationTestData.saved(
                applicationRepository,
                jobWithReferences,
                applicant,
                ApplicationState.SENT
            );
            ReferenceRequest entry = ReferenceRequestTestData.newReferenceRequest(pendingApplication, "old@example.com");
            entry.setStatus(ReferenceRequestStatus.REQUESTED);
            entry.setTokenHash("original-hash");
            entry = referenceRequestRepository.save(entry);
            RefereeContactDTO payload = new RefereeContactDTO("Prof. Dr.", "Ada", "Lovelace", "new@example.com");

            api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .putAndRead(
                    String.format(REFERENCE_BY_ID_URL, pendingApplication.getApplicationId(), entry.getReferenceRequestId()),
                    payload,
                    ReferenceRequestDTO.class,
                    200
                );

            ReferenceRequest persisted = referenceRequestRepository.findById(entry.getReferenceRequestId()).orElseThrow();
            assertThat(persisted.getEmail()).isEqualTo("new@example.com");
            assertThat(persisted.getStatus()).isEqualTo(ReferenceRequestStatus.REQUESTED);
            assertThat(persisted.getTokenHash()).isNotEqualTo("original-hash");
            verify(mockSender, times(1)).sendAsync(any());
        }

        @Test
        void shouldNotResendInvitationWhenOnlyNameChangesAfterSubmission() {
            Application pendingApplication = ApplicationTestData.saved(
                applicationRepository,
                jobWithReferences,
                applicant,
                ApplicationState.SENT
            );
            ReferenceRequest entry = ReferenceRequestTestData.newReferenceRequest(pendingApplication, "keep@example.com");
            entry.setStatus(ReferenceRequestStatus.REQUESTED);
            entry.setTokenHash("keep-hash");
            entry = referenceRequestRepository.save(entry);
            RefereeContactDTO payload = new RefereeContactDTO("Prof. Dr.", "Grace", "Hopper", "keep@example.com");

            api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .putAndRead(
                    String.format(REFERENCE_BY_ID_URL, pendingApplication.getApplicationId(), entry.getReferenceRequestId()),
                    payload,
                    ReferenceRequestDTO.class,
                    200
                );

            ReferenceRequest persisted = referenceRequestRepository.findById(entry.getReferenceRequestId()).orElseThrow();
            assertThat(persisted.getFirstName()).isEqualTo("Grace");
            assertThat(persisted.getTokenHash()).isEqualTo("keep-hash");
            verify(mockSender, never()).sendAsync(any());
        }

        @Test
        void shouldRejectUpdatingSubmittedReference() {
            ReferenceRequest entry = ReferenceRequestTestData.newReferenceRequest(savedApplication, "done@example.com");
            entry.setStatus(ReferenceRequestStatus.SUBMITTED);
            entry = referenceRequestRepository.save(entry);
            RefereeContactDTO payload = new RefereeContactDTO("Dr.", "Grace", "Hopper", "grace@example.com");

            api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .putAndRead(
                    String.format(REFERENCE_BY_ID_URL, savedApplication.getApplicationId(), entry.getReferenceRequestId()),
                    payload,
                    Void.class,
                    400
                );
        }

        @Test
        void shouldReject404WhenReferenceUnknown() {
            RefereeContactDTO payload = new RefereeContactDTO(null, "Grace", "Hopper", "grace@example.com");

            api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .putAndRead(
                    String.format(REFERENCE_BY_ID_URL, savedApplication.getApplicationId(), UUID.randomUUID()),
                    payload,
                    Void.class,
                    404
                );
        }
    }

    @Nested
    class SubmitFlow {

        private void saveAddedReference(String email) {
            ReferenceRequest entry = ReferenceRequestTestData.newReferenceRequest(savedApplication, email);
            entry.setStatus(ReferenceRequestStatus.ADDED);
            referenceRequestRepository.save(entry);
        }

        private void submitApplication() {
            UpdateApplicationDTO payload = new UpdateApplicationDTO(
                savedApplication.getApplicationId(),
                ApplicantDTO.getFromEntity(applicant),
                null,
                ApplicationState.SENT,
                null,
                null,
                null,
                true
            );
            api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .putAndRead("/api/applications", payload, ApplicationForApplicantDTO.class, 200);
        }

        @Test
        void shouldTransitionReferencesToRequestedAndDispatchEmailsWhenApplicationIsSubmitted() {
            saveAddedReference("first@example.com");
            saveAddedReference("second@example.com");

            submitApplication();

            assertThat(referenceRequestRepository.findByApplicationApplicationIdOrderByCreatedAtAsc(savedApplication.getApplicationId()))
                .hasSize(2)
                .allSatisfy(entry -> {
                    assertThat(entry.getStatus()).isEqualTo(ReferenceRequestStatus.REQUESTED);
                    assertThat(entry.getTokenHash()).isNotBlank();
                    assertThat(entry.getTokenExpiresAt()).isNotNull();
                });
            verify(mockSender, times(2)).sendAsync(any());
        }
    }

    @Nested
    class WithdrawCancellation {

        private static final String WITHDRAW_URL = "/api/applications/withdraw/%s";

        @Test
        void shouldCancelPendingReferencesAndNotifyRefereesWhenApplicationIsWithdrawn() {
            Application sentApplication = ApplicationTestData.saved(
                applicationRepository,
                jobWithReferences,
                applicant,
                ApplicationState.SENT
            );
            ReferenceRequest pending = ReferenceRequestTestData.newReferenceRequest(sentApplication, "pending@example.com");
            pending.setTokenHash("pending-hash");
            pending = referenceRequestRepository.save(pending);
            ReferenceRequest submitted = ReferenceRequestTestData.newReferenceRequest(
                sentApplication,
                "Prof.",
                "Alan",
                "Turing",
                "submitted@example.com",
                ReferenceRequestStatus.SUBMITTED
            );
            submitted = referenceRequestRepository.save(submitted);

            api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .putAndRead(String.format(WITHDRAW_URL, sentApplication.getApplicationId()), null, Void.class, 200);

            assertThat(referenceRequestRepository.findById(pending.getReferenceRequestId()).orElseThrow().getStatus()).isEqualTo(
                ReferenceRequestStatus.CANCELLED
            );
            assertThat(referenceRequestRepository.findById(submitted.getReferenceRequestId()).orElseThrow().getStatus()).isEqualTo(
                ReferenceRequestStatus.SUBMITTED
            );
            verify(mockSender, times(1)).sendAsync(any());
        }

        @Test
        void shouldNotSendCancellationEmailsWhenNoReferenceIsPending() {
            Application sentApplication = ApplicationTestData.saved(
                applicationRepository,
                jobWithReferences,
                applicant,
                ApplicationState.SENT
            );
            ReferenceRequest declined = ReferenceRequestTestData.newReferenceRequest(
                sentApplication,
                "Prof.",
                "Grace",
                "Hopper",
                "declined@example.com",
                ReferenceRequestStatus.DECLINED
            );
            referenceRequestRepository.save(declined);

            api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .putAndRead(String.format(WITHDRAW_URL, sentApplication.getApplicationId()), null, Void.class, 200);

            assertThat(referenceRequestRepository.findById(declined.getReferenceRequestId()).orElseThrow().getStatus()).isEqualTo(
                ReferenceRequestStatus.DECLINED
            );
            verify(mockSender, never()).sendAsync(any());
        }
    }
}
