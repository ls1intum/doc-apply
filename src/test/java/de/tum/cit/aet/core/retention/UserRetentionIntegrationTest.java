package de.tum.cit.aet.core.retention;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import de.tum.cit.aet.IntegrationTest;
import de.tum.cit.aet.application.constants.ApplicationState;
import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.application.repository.ApplicationRepository;
import de.tum.cit.aet.core.config.UserRetentionProperties;
import de.tum.cit.aet.core.constants.DocumentType;
import de.tum.cit.aet.core.constants.Language;
import de.tum.cit.aet.core.documents.domain.Document;
import de.tum.cit.aet.core.documents.repository.DocumentRepository;
import de.tum.cit.aet.core.domain.ProfileImage;
import de.tum.cit.aet.core.repository.ImageRepository;
import de.tum.cit.aet.evaluation.domain.ApplicationReview;
import de.tum.cit.aet.evaluation.domain.InternalComment;
import de.tum.cit.aet.evaluation.domain.Rating;
import de.tum.cit.aet.evaluation.domain.enumeration.RecommendationDecision;
import de.tum.cit.aet.evaluation.repository.ApplicationReviewRepository;
import de.tum.cit.aet.evaluation.repository.InternalCommentRepository;
import de.tum.cit.aet.evaluation.repository.RatingRepository;
import de.tum.cit.aet.interview.domain.InterviewProcess;
import de.tum.cit.aet.interview.domain.InterviewSlot;
import de.tum.cit.aet.interview.domain.Interviewee;
import de.tum.cit.aet.interview.repository.InterviewProcessRepository;
import de.tum.cit.aet.interview.repository.InterviewSlotRepository;
import de.tum.cit.aet.interview.repository.IntervieweeRepository;
import de.tum.cit.aet.job.constants.JobState;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.job.repository.JobRepository;
import de.tum.cit.aet.notification.constants.EmailType;
import de.tum.cit.aet.notification.domain.EmailSetting;
import de.tum.cit.aet.notification.domain.EmailTemplate;
import de.tum.cit.aet.notification.repository.EmailSettingRepository;
import de.tum.cit.aet.notification.repository.EmailTemplateRepository;
import de.tum.cit.aet.notification.service.AsyncEmailSender;
import de.tum.cit.aet.notification.service.mail.Email;
import de.tum.cit.aet.usermanagement.domain.Applicant;
import de.tum.cit.aet.usermanagement.domain.Department;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.School;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.domain.UserSetting;
import de.tum.cit.aet.usermanagement.repository.ApplicantRepository;
import de.tum.cit.aet.usermanagement.repository.DepartmentRepository;
import de.tum.cit.aet.usermanagement.repository.ResearchGroupRepository;
import de.tum.cit.aet.usermanagement.repository.SchoolRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import de.tum.cit.aet.usermanagement.repository.UserResearchGroupRoleRepository;
import de.tum.cit.aet.usermanagement.repository.UserSettingRepository;
import de.tum.cit.aet.utility.testdata.ApplicantTestData;
import de.tum.cit.aet.utility.testdata.ApplicationTestData;
import de.tum.cit.aet.utility.testdata.DepartmentTestData;
import de.tum.cit.aet.utility.testdata.DocumentTestData;
import de.tum.cit.aet.utility.testdata.EmailTemplateTestData;
import de.tum.cit.aet.utility.testdata.InternalCommentTestData;
import de.tum.cit.aet.utility.testdata.JobTestData;
import de.tum.cit.aet.utility.testdata.RatingTestData;
import de.tum.cit.aet.utility.testdata.ResearchGroupTestData;
import de.tum.cit.aet.utility.testdata.SchoolTestData;
import de.tum.cit.aet.utility.testdata.UserTestData;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

@IntegrationTest
@Transactional
class UserRetentionIntegrationTest {

    private static final UUID DELETED_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000100");

    @Autowired
    private UserRetentionService userRetentionService;

    @Autowired
    private UserRetentionProperties userRetentionProperties;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ApplicantRepository applicantRepository;

    @Autowired
    private ApplicationRepository applicationRepository;

    @Autowired
    private ApplicationReviewRepository applicationReviewRepository;

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private EmailSettingRepository emailSettingRepository;

    @Autowired
    private EmailTemplateRepository emailTemplateRepository;

    @Autowired
    private ImageRepository imageRepository;

    @Autowired
    private InternalCommentRepository internalCommentRepository;

    @Autowired
    private InterviewProcessRepository interviewProcessRepository;

    @Autowired
    private IntervieweeRepository intervieweeRepository;

    @Autowired
    private InterviewSlotRepository interviewSlotRepository;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private RatingRepository ratingRepository;

    @Autowired
    private SchoolRepository schoolRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private ResearchGroupRepository researchGroupRepository;

    @Autowired
    private UserResearchGroupRoleRepository userResearchGroupRoleRepository;

    @Autowired
    private UserSettingRepository userSettingRepository;

    private AsyncEmailSender mockSender;

    private ResearchGroup researchGroup;

    @BeforeEach
    void setUp() {
        mockSender = Mockito.mock(AsyncEmailSender.class);
        ReflectionTestUtils.setField(userRetentionService, "sender", mockSender);
        userRetentionProperties.setDeletedUserId(DELETED_USER_ID);
        userRetentionProperties.setInactiveDaysBeforeDeletion(28);
        ensureDeletedUserExists();

        School school = SchoolTestData.savedDefault(schoolRepository);
        Department department = DepartmentTestData.savedDefault(departmentRepository, school);
        researchGroup = ResearchGroupTestData.saved(researchGroupRepository, department);
    }

    // ===== USER DELETION AND ANONYMIZATION =====
    @Nested
    class UserDeletionAndAnonymizationTests {

        @Test
        void shouldDeleteApplicantAndAllAssociatedData() {
            User professor = UserTestData.saveProfessor(researchGroup, userRepository);
            User savedApplicantUser = ApplicantTestData.saveApplicant("applicant@test.local", userRepository);
            UUID applicantId = savedApplicantUser.getUserId();

            Applicant applicant = ApplicantTestData.savedWithExistingUser(applicantRepository, savedApplicantUser);
            Job job = JobTestData.saved(jobRepository, professor, researchGroup, "Job", JobState.PUBLISHED, null);
            Application application = ApplicationTestData.saved(applicationRepository, job, applicant, ApplicationState.SENT);

            ApplicationReview review = saveReview(application, professor);
            Rating rating = RatingTestData.saved(ratingRepository, application, professor, RecommendationDecision.SOFT_PASS);
            InternalComment comment = InternalCommentTestData.saved(internalCommentRepository, application, professor);
            InterviewSlot slot = saveInterviewSlot(application, job);

            DocumentTestData.savedMockDocument(documentRepository, savedApplicantUser, application, null, DocumentType.CV, "cv.pdf");
            Document applicantProfileDictionary = DocumentTestData.savedMockDocument(
                documentRepository,
                savedApplicantUser,
                null,
                applicant,
                DocumentType.CV,
                "applicant-profile-cv.pdf"
            );

            saveUserSettings(savedApplicantUser);
            ProfileImage profileImage = saveProfileImage(savedApplicantUser, "/images/profile.png", "image/png", 123L);

            userRetentionService.processUserIdsList(List.of(applicantId), LocalDateTime.now(), false);

            assertApplicantDataDeleted(savedApplicantUser, application, review, rating, comment, slot, profileImage);
            assertThat(documentRepository.findById(applicantProfileDictionary.getDocumentId())).isEmpty();
        }

        @Test
        void shouldAnonymizeProfessorDataAndDeleteUser() {
            User professor = UserTestData.saveProfessor(researchGroup, userRepository);
            UUID professorId = professor.getUserId();
            User applicantUser = UserTestData.newUserAll(UUID.randomUUID(), "applicant2@test.local", "App", "User");
            ApplicantTestData.attachApplicantRole(applicantUser);
            applicantUser.setUniversityId(UUID.randomUUID().toString().replace("-", "").substring(0, 7));
            User savedApplicantUser = userRepository.saveAndFlush(applicantUser);
            Applicant applicant = ApplicantTestData.savedWithExistingUser(applicantRepository, savedApplicantUser);

            Job job = JobTestData.saved(jobRepository, professor, researchGroup, "Job", JobState.PUBLISHED, null);
            Application application = ApplicationTestData.saved(applicationRepository, job, applicant, ApplicationState.SENT);

            InternalComment comment = InternalCommentTestData.saved(internalCommentRepository, application, professor);
            EmailTemplate template = EmailTemplateTestData.saved(
                emailTemplateRepository,
                researchGroup,
                professor,
                EmailType.APPLICATION_SENT
            );

            ProfileImage profileImage = new ProfileImage();
            profileImage.setUrl("/images/p.png");
            profileImage.setMimeType("image/png");
            profileImage.setSizeBytes(1L);
            profileImage.setUploadedBy(professor);
            imageRepository.save(profileImage);

            userRetentionService.processUserIdsList(List.of(professorId), LocalDateTime.now(), false);

            Job updatedJob = jobRepository.findById(job.getJobId()).orElseThrow();
            assertThat(updatedJob.getSupervisingProfessor().getUserId()).isEqualTo(DELETED_USER_ID);
            assertThat(updatedJob.getState()).isEqualTo(JobState.CLOSED);

            Optional<InternalComment> updatedComment = internalCommentRepository.findById(comment.getInternalCommentId());
            assertThat(updatedComment).isPresent();
            assertThat(updatedComment.get().getCreatedBy().getUserId()).isEqualTo(DELETED_USER_ID);

            Optional<EmailTemplate> updatedTemplate = emailTemplateRepository.findById(template.getEmailTemplateId());
            assertThat(updatedTemplate).isPresent();
            assertThat(updatedTemplate.get().getCreatedBy().getUserId()).isEqualTo(DELETED_USER_ID);

            assertThat(userRepository.existsById(professorId)).isFalse();
        }
    }

    // ===== DRY RUN =====
    @Nested
    class DryRunTests {

        @Test
        void shouldNotChangeAnythingOnDryRun() {
            User applicantUser = UserTestData.newUserAll(UUID.randomUUID(), "dryrun@test.local", "Dry", "Run");
            ApplicantTestData.attachApplicantRole(applicantUser);
            applicantUser.setUniversityId(UUID.randomUUID().toString().replace("-", "").substring(0, 7));
            User savedApplicantUser = userRepository.saveAndFlush(applicantUser);
            UUID applicantId = savedApplicantUser.getUserId();
            Applicant applicant = ApplicantTestData.savedWithExistingUser(applicantRepository, savedApplicantUser);
            User professor = UserTestData.saveProfessor(researchGroup, userRepository);
            Job job = JobTestData.saved(jobRepository, professor, researchGroup, "Job", JobState.PUBLISHED, null);
            Application application = ApplicationTestData.saved(applicationRepository, job, applicant, ApplicationState.SENT);

            userRetentionService.processUserIdsList(List.of(applicantId), LocalDateTime.now(), true);

            assertThat(userRepository.existsById(applicantId)).isTrue();
            assertThat(applicationRepository.findById(application.getApplicationId())).isPresent();
            assertThat(applicantRepository.findById(applicantId)).isPresent();
        }
    }

    // ===== SKIP RULES =====
    @Nested
    class SkipRulesTests {

        @Test
        void shouldSkipUnknownUser() {
            User unknown = UserTestData.savedUserAll(userRepository, UUID.randomUUID(), "unknown@test.local", "Unknown", "User");
            UUID unknownId = unknown.getUserId();

            userRetentionService.processUserIdsList(List.of(unknownId), LocalDateTime.now(), false);

            assertThat(userRepository.existsById(unknownId)).isTrue();
        }

        @Test
        void shouldSkipAdminUserAndKeepData() {
            User admin = UserTestData.saveAdmin(userRepository);
            UUID adminId = admin.getUserId();

            UserSetting setting = new UserSetting(admin, "theme", "dark");
            userSettingRepository.save(setting);

            EmailSetting emailSetting = new EmailSetting();
            emailSetting.setUser(admin);
            emailSetting.setEmailType(EmailType.APPLICATION_SENT);
            emailSetting.setEnabled(true);
            emailSettingRepository.save(emailSetting);

            ProfileImage profileImage = new ProfileImage();
            profileImage.setUrl("/images/admin.png");
            profileImage.setMimeType("image/png");
            profileImage.setSizeBytes(12L);
            profileImage.setUploadedBy(admin);
            profileImage = imageRepository.save(profileImage);

            userRetentionService.processUserIdsList(List.of(adminId), LocalDateTime.now(), false);

            assertThat(userRepository.existsById(adminId)).isTrue();
            assertThat(userSettingRepository.findAllByIdUserId(adminId)).isNotEmpty();
            assertThat(emailSettingRepository.findAllByUser(admin)).isNotEmpty();
            assertThat(imageRepository.findById(profileImage.getImageId())).isPresent();
            assertThat(userResearchGroupRoleRepository.existsByUserUserId(adminId)).isTrue();
        }

        @Test
        void shouldKeepUserWithoutRolesAndResearchGroup() {
            User user = new User();
            user.setUserId(UUID.randomUUID());
            user.setEmail("norole@test.local");
            user.setFirstName("No");
            user.setLastName("Role");
            user.setSelectedLanguage("en");
            user.setUniversityId(UUID.randomUUID().toString().replace("-", "").substring(0, 7));
            user = userRepository.saveAndFlush(user);

            UserSetting setting = new UserSetting(user, "lang", "en");
            userSettingRepository.save(setting);

            EmailSetting emailSetting = new EmailSetting();
            emailSetting.setUser(user);
            emailSetting.setEmailType(EmailType.APPLICATION_SENT);
            emailSetting.setEnabled(true);
            emailSettingRepository.save(emailSetting);

            UUID userId = user.getUserId();
            userRetentionService.processUserIdsList(List.of(userId), LocalDateTime.now(), false);

            assertThat(userRepository.existsById(userId)).isTrue();
            assertThat(userSettingRepository.findAllByIdUserId(userId)).isNotEmpty();
            assertThat(emailSettingRepository.findAllByUser(user)).isNotEmpty();
        }
    }

    // ===== BATCH PROCESSING =====
    @Nested
    class BatchProcessingTests {

        @Test
        void shouldProcessMixedBatchAndBeIdempotent() {
            User professor = UserTestData.saveProfessor(researchGroup, userRepository);
            UUID professorId = professor.getUserId();

            User applicantUser = UserTestData.newUserAll(UUID.randomUUID(), "batch-applicant@test.local", "Batch", "Applicant");
            ApplicantTestData.attachApplicantRole(applicantUser);
            applicantUser.setUniversityId(UUID.randomUUID().toString().replace("-", "").substring(0, 7));
            User savedApplicantUser = userRepository.saveAndFlush(applicantUser);
            UUID applicantId = savedApplicantUser.getUserId();
            Applicant applicant = ApplicantTestData.savedWithExistingUser(applicantRepository, savedApplicantUser);

            Job job = JobTestData.saved(jobRepository, professor, researchGroup, "Batch Job", JobState.PUBLISHED, null);
            Application application = ApplicationTestData.saved(applicationRepository, job, applicant, ApplicationState.SENT);
            DocumentTestData.savedMockDocument(documentRepository, savedApplicantUser, application, null, DocumentType.CV, "cv-batch.pdf");

            EmailTemplate template = EmailTemplateTestData.saved(
                emailTemplateRepository,
                researchGroup,
                professor,
                EmailType.APPLICATION_SENT
            );

            ProfileImage profileImage = new ProfileImage();
            profileImage.setUrl("/images/prof-batch.png");
            profileImage.setMimeType("image/png");
            profileImage.setSizeBytes(8L);
            profileImage.setUploadedBy(professor);
            imageRepository.save(profileImage);

            User unknown = UserTestData.savedUserAll(userRepository, UUID.randomUUID(), "batch-unknown@test.local", "Batch", "Unknown");
            UUID unknownId = unknown.getUserId();

            List<UUID> ids = List.of(applicantId, professorId, unknownId);
            userRetentionService.processUserIdsList(ids, LocalDateTime.now(), false);

            assertThat(userRepository.existsById(applicantId)).isFalse();
            assertThat(applicantRepository.findById(applicantId)).isEmpty();
            assertThat(applicationRepository.findById(application.getApplicationId())).isEmpty();

            Job updatedJob = jobRepository.findById(job.getJobId()).orElseThrow();
            assertThat(updatedJob.getSupervisingProfessor().getUserId()).isEqualTo(DELETED_USER_ID);
            assertThat(updatedJob.getState()).isEqualTo(JobState.CLOSED);

            EmailTemplate updatedTemplate = emailTemplateRepository.findById(template.getEmailTemplateId()).orElseThrow();
            assertThat(updatedTemplate.getCreatedBy().getUserId()).isEqualTo(DELETED_USER_ID);

            assertThat(userRepository.existsById(professorId)).isFalse();
            assertThat(userRepository.existsById(unknownId)).isTrue();

            userRetentionService.processUserIdsList(ids, LocalDateTime.now(), false);

            assertThat(userRepository.existsById(unknownId)).isTrue();
            assertThat(jobRepository.findById(job.getJobId())).isPresent();
        }
    }

    // ===== WARNING EMAIL =====
    @Nested
    class WarningEmailTests {

        @Test
        void shouldSendWarningEmailOnlyOnWarningDay() {
            userRetentionProperties.setInactiveDaysBeforeDeletion(60);

            LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
            LocalDateTime warningDate = now.minusDays(userRetentionProperties.getInactiveDaysBeforeDeletion() - 28);

            // Matches warning date exactly
            User userToWarn = ApplicantTestData.saveApplicantWithLastActivity(
                "warning@test.local",
                applicantRepository,
                userRepository,
                warningDate.withHour(1).withMinute(0).withSecond(0).withNano(0)
            );

            // Too recent (day after warning date)
            ApplicantTestData.saveApplicantWithLastActivity(
                "recent@test.local",
                applicantRepository,
                userRepository,
                warningDate.plusDays(1)
            );

            // Too old (day before warning date)
            ApplicantTestData.saveApplicantWithLastActivity(
                "old@test.local",
                applicantRepository,
                userRepository,
                warningDate.minusDays(1)
            );

            userRetentionService.warnUserOfDataDeletion(warningDate);

            ArgumentCaptor<Email> emailCaptor = ArgumentCaptor.forClass(Email.class);
            verify(mockSender, times(1)).sendAsync(emailCaptor.capture());

            Email sentEmail = emailCaptor.getValue();
            assertThat(sentEmail.getEmailType()).isEqualTo(EmailType.USER_DATA_DELETION_WARNING);
            assertThat(sentEmail.getLanguage()).isEqualTo(Language.fromCode(userToWarn.getSelectedLanguage()));
            assertThat(sentEmail.getTo()).extracting(User::getUserId).containsExactly(userToWarn.getUserId());
            assertThat(sentEmail.getContent()).isEqualTo(userToWarn);
        }
    }

    private void ensureDeletedUserExists() {
        if (userRepository.existsById(DELETED_USER_ID)) {
            return;
        }
        User deleted = new User();
        deleted.setUserId(DELETED_USER_ID);
        deleted.setEmail("deleted@user");
        deleted.setFirstName("Deleted");
        deleted.setLastName("User");
        deleted.setSelectedLanguage("en");
        userRepository.save(deleted);
    }

    private ApplicationReview saveReview(Application application, User professor) {
        ApplicationReview review = new ApplicationReview();
        review.setApplication(application);
        review.setReviewedBy(professor);
        return applicationReviewRepository.save(review);
    }

    private InterviewSlot saveInterviewSlot(Application application, Job job) {
        InterviewProcess process = new InterviewProcess();
        process.setJob(job);
        process = interviewProcessRepository.save(process);

        Interviewee interviewee = new Interviewee();
        interviewee.setApplication(application);
        interviewee.setInterviewProcess(process);
        interviewee = intervieweeRepository.save(interviewee);

        InterviewSlot slot = new InterviewSlot();
        slot.setInterviewProcess(process);
        slot.setInterviewee(interviewee);
        slot.setStartDateTime(Instant.now().plusSeconds(3600));
        slot.setEndDateTime(Instant.now().plusSeconds(7200));
        slot.setLocation("Room 1");
        slot.setIsBooked(true);
        return interviewSlotRepository.save(slot);
    }

    private void saveUserSettings(User user) {
        UserSetting setting = new UserSetting(user, "theme", "dark");
        userSettingRepository.save(setting);

        EmailSetting emailSetting = new EmailSetting();
        emailSetting.setUser(user);
        emailSetting.setEmailType(EmailType.APPLICATION_SENT);
        emailSetting.setEnabled(true);
        emailSettingRepository.save(emailSetting);
    }

    private ProfileImage saveProfileImage(User user, String url, String mimeType, long sizeBytes) {
        ProfileImage profileImage = new ProfileImage();
        profileImage.setUrl(url);
        profileImage.setMimeType(mimeType);
        profileImage.setSizeBytes(sizeBytes);
        profileImage.setUploadedBy(user);
        return imageRepository.save(profileImage);
    }

    private void assertApplicantDataDeleted(
        User user,
        Application application,
        ApplicationReview review,
        Rating rating,
        InternalComment comment,
        InterviewSlot slot,
        ProfileImage profileImage
    ) {
        UUID userId = user.getUserId();
        UUID applicationId = application.getApplicationId();
        UUID reviewId = review.getApplicationReviewId();
        UUID ratingId = rating.getRatingId();
        UUID commentId = comment.getInternalCommentId();
        UUID intervieweeId = slot.getInterviewee().getId();
        UUID slotId = slot.getId();

        assertThat(userRepository.existsById(userId)).isFalse();
        assertThat(applicantRepository.findById(userId)).isEmpty();
        assertThat(applicationRepository.findAllByApplicantId(userId)).isEmpty();
        assertThat(applicationReviewRepository.findById(reviewId)).isEmpty();
        assertThat(ratingRepository.findById(ratingId)).isEmpty();
        assertThat(internalCommentRepository.findById(commentId)).isEmpty();
        assertThat(intervieweeRepository.findById(intervieweeId)).isEmpty();
        assertThat(interviewSlotRepository.findById(slotId)).isEmpty();
        assertThat(documentRepository.findAllApplicationDocuments(applicationId)).isEmpty();
        assertThat(documentRepository.findAll()).noneMatch(d -> d.getUploadedBy().getUserId().equals(userId));
        assertThat(userSettingRepository.findAllByIdUserId(userId)).isEmpty();
        assertThat(emailSettingRepository.findAllByUser(user)).isEmpty();
        assertThat(imageRepository.findById(profileImage.getImageId())).isEmpty();
        assertThat(userResearchGroupRoleRepository.existsByUserUserId(userId)).isFalse();
    }
}
