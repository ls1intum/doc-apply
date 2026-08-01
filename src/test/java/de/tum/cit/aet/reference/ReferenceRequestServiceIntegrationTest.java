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
import de.tum.cit.aet.application.repository.ApplicationRepository;
import de.tum.cit.aet.job.constants.JobState;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.job.repository.JobRepository;
import de.tum.cit.aet.notification.service.AsyncEmailSender;
import de.tum.cit.aet.reference.constants.ReferenceRequestStatus;
import de.tum.cit.aet.reference.domain.ReferenceRequest;
import de.tum.cit.aet.reference.repository.ReferenceRequestRepository;
import de.tum.cit.aet.reference.service.ReferenceRequestService;
import de.tum.cit.aet.usermanagement.domain.Applicant;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.repository.ApplicantRepository;
import de.tum.cit.aet.usermanagement.repository.ResearchGroupRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import de.tum.cit.aet.utility.DatabaseCleaner;
import de.tum.cit.aet.utility.testdata.ApplicantTestData;
import de.tum.cit.aet.utility.testdata.ApplicationTestData;
import de.tum.cit.aet.utility.testdata.JobTestData;
import de.tum.cit.aet.utility.testdata.ReferenceRequestTestData;
import de.tum.cit.aet.utility.testdata.ResearchGroupTestData;
import de.tum.cit.aet.utility.testdata.UserTestData;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Service-level tests for {@link ReferenceRequestService} methods that are driven by the daily
 * scheduler and therefore not reachable via REST: {@code expireOverdueRequests} and
 * {@code sendReminders}. Resource-reachable behaviour is covered in
 * {@link ReferenceRequestResourceTest} and {@link ReferenceLetterUploadResourceTest}.
 */
class ReferenceRequestServiceIntegrationTest extends AbstractResourceTest {

    @Autowired
    private ReferenceRequestService referenceRequestService;

    @Autowired
    private ApplicationRepository applicationRepository;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ApplicantRepository applicantRepository;

    @Autowired
    private ResearchGroupRepository researchGroupRepository;

    @Autowired
    private ReferenceRequestRepository referenceRequestRepository;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    private AsyncEmailSender mockSender;
    private ResearchGroup researchGroup;
    private User professor;
    private Applicant applicant;
    private Job jobWithReferences;
    private Application savedApplication;

    @BeforeEach
    void setup() {
        databaseCleaner.clean();
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
            LocalDate.now().plusMonths(6)
        );
        jobWithReferences.setReferenceLettersRequired(2);
        jobWithReferences = jobRepository.save(jobWithReferences);

        savedApplication = ApplicationTestData.saved(applicationRepository, jobWithReferences, applicant, ApplicationState.SENT);
    }

    private ReferenceRequest savedRequestedEntry(String email, LocalDateTime expiresAt, int reminderCount) {
        ReferenceRequest entry = ReferenceRequestTestData.newReferenceRequest(savedApplication, email);
        entry.setStatus(ReferenceRequestStatus.REQUESTED);
        entry.setTokenHash("hash-" + email);
        entry.setTokenExpiresAt(expiresAt);
        entry.setReminderCount(reminderCount);
        return referenceRequestRepository.save(entry);
    }

    @Nested
    class ExpireOverdueRequests {

        @Test
        void shouldFlipRequestedEntriesPastDeadlineToExpired() {
            savedRequestedEntry("overdue@example.com", LocalDateTime.now().minusHours(1), 0);

            int expired = referenceRequestService.expireOverdueRequests();

            assertThat(expired).isEqualTo(1);
            ReferenceRequest reloaded = referenceRequestRepository
                .findByApplicationApplicationIdOrderByCreatedAtAsc(savedApplication.getApplicationId())
                .getFirst();
            assertThat(reloaded.getStatus()).isEqualTo(ReferenceRequestStatus.EXPIRED);
        }

        @Test
        void shouldLeaveFutureDeadlinesUntouched() {
            savedRequestedEntry("future@example.com", LocalDateTime.now().plusDays(2), 0);

            int expired = referenceRequestService.expireOverdueRequests();

            assertThat(expired).isZero();
            ReferenceRequest reloaded = referenceRequestRepository
                .findByApplicationApplicationIdOrderByCreatedAtAsc(savedApplication.getApplicationId())
                .getFirst();
            assertThat(reloaded.getStatus()).isEqualTo(ReferenceRequestStatus.REQUESTED);
        }

        @Test
        void shouldNotTouchSubmittedEntriesEvenWhenPastDeadline() {
            ReferenceRequest entry = ReferenceRequestTestData.newReferenceRequest(savedApplication, "done@example.com");
            entry.setStatus(ReferenceRequestStatus.SUBMITTED);
            entry.setTokenHash("hash-done");
            entry.setTokenExpiresAt(LocalDateTime.now().minusDays(1));
            entry = referenceRequestRepository.save(entry);

            int expired = referenceRequestService.expireOverdueRequests();

            assertThat(expired).isZero();
            ReferenceRequest reloaded = referenceRequestRepository.findById(entry.getReferenceRequestId()).orElseThrow();
            assertThat(reloaded.getStatus()).isEqualTo(ReferenceRequestStatus.SUBMITTED);
        }
    }

    @Nested
    class SendReminders {

        @Test
        void shouldSendFirstReminderWhenDeadlineIsWithinSevenDayBand() {
            savedRequestedEntry("seven-day@example.com", LocalDateTime.now().plusDays(5), 0);

            int sent = referenceRequestService.sendReminders();

            assertThat(sent).isEqualTo(1);
            ReferenceRequest reloaded = referenceRequestRepository
                .findByApplicationApplicationIdOrderByCreatedAtAsc(savedApplication.getApplicationId())
                .getFirst();
            assertThat(reloaded.getReminderCount()).isEqualTo(1);
            assertThat(reloaded.getLastReminderAt()).isNotNull();
            verify(mockSender, times(1)).sendAsync(any());
        }

        @Test
        void shouldSendFinalReminderWhenDeadlineIsWithinTwentyFourHoursAndFirstAlreadySent() {
            ReferenceRequest entry = savedRequestedEntry("final@example.com", LocalDateTime.now().plusHours(12), 1);

            int sent = referenceRequestService.sendReminders();

            assertThat(sent).isEqualTo(1);
            ReferenceRequest reloaded = referenceRequestRepository.findById(entry.getReferenceRequestId()).orElseThrow();
            assertThat(reloaded.getReminderCount()).isEqualTo(2);
        }

        @Test
        void shouldNotSendWhenReminderCapAlreadyReached() {
            savedRequestedEntry("capped@example.com", LocalDateTime.now().plusHours(6), 2);

            int sent = referenceRequestService.sendReminders();

            assertThat(sent).isZero();
            verify(mockSender, never()).sendAsync(any());
        }

        @Test
        void shouldSkipEntriesOutsideReminderWindow() {
            savedRequestedEntry("far-off@example.com", LocalDateTime.now().plusDays(30), 0);

            int sent = referenceRequestService.sendReminders();

            assertThat(sent).isZero();
            verify(mockSender, never()).sendAsync(any());
        }
    }
}
