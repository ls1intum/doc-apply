package de.tum.cit.aet.evaluation.web.rest;

import static java.util.Map.entry;
import static org.assertj.core.api.Assertions.assertThat;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.application.constants.ApplicationState;
import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.application.repository.ApplicationRepository;
import de.tum.cit.aet.core.constants.DocumentType;
import de.tum.cit.aet.core.documents.repository.DocumentRepository;
import de.tum.cit.aet.core.dto.OffsetPageDTO;
import de.tum.cit.aet.core.dto.SortDTO;
import de.tum.cit.aet.evaluation.constants.RejectReason;
import de.tum.cit.aet.evaluation.dto.AcceptDTO;
import de.tum.cit.aet.evaluation.dto.ApplicationEvaluationDetailDTO;
import de.tum.cit.aet.evaluation.dto.ApplicationEvaluationDetailListDTO;
import de.tum.cit.aet.evaluation.dto.ApplicationEvaluationOverviewListDTO;
import de.tum.cit.aet.evaluation.dto.RejectDTO;
import de.tum.cit.aet.evaluation.repository.RatingRepository;
import de.tum.cit.aet.interview.domain.InterviewProcess;
import de.tum.cit.aet.interview.domain.Interviewee;
import de.tum.cit.aet.interview.domain.enumeration.AssessmentRating;
import de.tum.cit.aet.interview.repository.InterviewProcessRepository;
import de.tum.cit.aet.interview.repository.IntervieweeRepository;
import de.tum.cit.aet.job.constants.JobState;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.job.repository.JobRepository;
import de.tum.cit.aet.usermanagement.domain.Applicant;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.repository.ApplicantRepository;
import de.tum.cit.aet.usermanagement.repository.ResearchGroupRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import de.tum.cit.aet.utility.DatabaseCleaner;
import de.tum.cit.aet.utility.MvcTestClient;
import de.tum.cit.aet.utility.security.JwtPostProcessors;
import de.tum.cit.aet.utility.testdata.*;
import java.io.ByteArrayInputStream;
import java.time.LocalDate;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.core.type.TypeReference;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApplicationEvaluationResourceTest extends AbstractResourceTest {

    @Autowired
    UserRepository userRepository;

    @Autowired
    ResearchGroupRepository researchGroupRepository;

    @Autowired
    ApplicantRepository applicantRepository;

    @Autowired
    JobRepository jobRepository;

    @Autowired
    ApplicationRepository applicationRepository;

    @Autowired
    DatabaseCleaner databaseCleaner;

    @Autowired
    DocumentRepository documentRepository;

    @Autowired
    RatingRepository ratingRepository;

    @Autowired
    InterviewProcessRepository interviewProcessRepository;

    @Autowired
    IntervieweeRepository intervieweeRepository;

    @Autowired
    MvcTestClient api;

    @Value("${aet.storage.root}")
    private String storageRootConfig;

    User professor;
    ResearchGroup researchGroup;
    User professorUnauthorized;
    ResearchGroup researchGroupUnauthorized;
    Applicant applicant;
    Job publishedJob;
    Application sentApp;
    Application inReviewApp;

    @BeforeEach
    void setup() {
        databaseCleaner.clean();

        researchGroup = ResearchGroupTestData.saved(researchGroupRepository);
        professor = UserTestData.savedProfessor(userRepository, researchGroup);

        researchGroupUnauthorized = ResearchGroupTestData.saved(researchGroupRepository);
        professorUnauthorized = UserTestData.savedProfessor(userRepository, researchGroupUnauthorized);

        applicant = ApplicantTestData.savedWithNewUser(applicantRepository, userRepository);

        publishedJob = JobTestData.saved(
            jobRepository,
            professor,
            researchGroup,
            "Published Role",
            JobState.PUBLISHED,
            LocalDate.now().plusDays(7)
        );

        sentApp = ApplicationTestData.savedSent(applicationRepository, publishedJob, applicant);
        inReviewApp = ApplicationTestData.savedInReview(applicationRepository, publishedJob, applicant);
    }

    @Nested
    class GetApplications {

        @Test
        void overviewsOnlyViewableStates() {
            ApplicationEvaluationOverviewListDTO dto = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(
                    "/api/evaluation/applications",
                    Map.ofEntries(entry("offset", "0"), entry("limit", "10")),
                    ApplicationEvaluationOverviewListDTO.class,
                    200
                );

            assertThat(dto.applications()).extracting("applicationId").contains(sentApp.getApplicationId(), inReviewApp.getApplicationId());
        }

        @Test
        void detailsReturnsDetails() {
            ApplicationEvaluationDetailListDTO details = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(
                    "/api/evaluation/application-details",
                    Map.of("offset", "0", "limit", "10"),
                    ApplicationEvaluationDetailListDTO.class,
                    200
                );

            assertThat(details.applications().size()).isEqualTo(2);
            assertThat(details.applications()).anyMatch(application ->
                application.applicationDetailDTO().applicationId().equals(sentApp.getApplicationId())
            );
            assertThat(details.applications()).anyMatch(application ->
                application.applicationDetailDTO().applicationId().equals(inReviewApp.getApplicationId())
            );
        }

        @Test
        void detailsWindowValidOddSize() {
            ApplicationEvaluationDetailListDTO win = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(
                    "/api/evaluation/application-details/window",
                    Map.ofEntries(entry("applicationId", inReviewApp.getApplicationId().toString()), entry("windowSize", "3")),
                    ApplicationEvaluationDetailListDTO.class,
                    200
                );

            assertThat(win.applications().size()).isEqualTo(2);
            assertThat(win.applications()).anyMatch(application ->
                application.applicationDetailDTO().applicationId().equals(sentApp.getApplicationId())
            );
            assertThat(win.applications()).anyMatch(application ->
                application.applicationDetailDTO().applicationId().equals(inReviewApp.getApplicationId())
            );
        }

        @Test
        void detailsLimitIsApplied() {
            SortDTO sort = new SortDTO("status", SortDTO.Direction.DESC);
            ApplicationEvaluationDetailListDTO details = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(
                    "/api/evaluation/application-details",
                    Map.of("offset", "0", "limit", "1", "sortBy", sort.sortBy(), "direction", sort.direction().name()),
                    ApplicationEvaluationDetailListDTO.class,
                    200
                );

            assertThat(details.applications()).hasSize(1);
            assertThat(details.applications().getFirst().applicationDetailDTO().applicationId()).isEqualTo(inReviewApp.getApplicationId());
            assertThat(details.applications().getFirst().applicationDetailDTO().applicationState()).isEqualTo(inReviewApp.getState());
            assertThat(details.applications().getFirst().applicationDetailDTO().applicant().user().name()).isEqualTo(
                applicant.getUser().getFirstName() + " " + applicant.getUser().getLastName()
            );
        }

        @Test
        void overviewsWithSortingOk() {
            SortDTO sort = new SortDTO("status", SortDTO.Direction.DESC);
            OffsetPageDTO page = new OffsetPageDTO(0, 10);

            ApplicationEvaluationOverviewListDTO dto = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(
                    "/api/evaluation/applications",
                    Map.of(
                        "offset",
                        String.valueOf(page.offset()),
                        "limit",
                        String.valueOf(page.limit()),
                        "sortBy",
                        sort.sortBy(),
                        "direction",
                        sort.direction().name()
                    ),
                    ApplicationEvaluationOverviewListDTO.class,
                    200
                );

            assertThat(dto.applications()).hasSize(2);
            assertThat(dto.applications().getFirst().applicationId()).isEqualTo(inReviewApp.getApplicationId());
            assertThat(dto.applications().getFirst().state()).isEqualTo(inReviewApp.getState());
            assertThat(dto.applications().getFirst().name()).isEqualTo(
                applicant.getUser().getFirstName() + " " + applicant.getUser().getLastName()
            );
            assertThat(dto.applications().get(1).applicationId()).isEqualTo(sentApp.getApplicationId());
            assertThat(dto.applications().get(1).state()).isEqualTo(sentApp.getState());
            assertThat(dto.applications().get(1).name()).isEqualTo(
                applicant.getUser().getFirstName() + " " + applicant.getUser().getLastName()
            );
        }
    }

    @Nested
    class RatingSummary {

        @Test
        void shouldReturnEmptyRatingSummaryWhenNoRatingsExist() {
            ApplicationEvaluationDetailDTO target = fetchDetail(sentApp.getApplicationId());

            assertThat(target.averageRating()).isNull();
            assertThat(target.ratingCount()).isEqualTo(0);
        }

        @Test
        void shouldIncludeProfessorRatingsInAverageAndCount() {
            RatingTestData.saved(ratingRepository, sentApp, professor, 2);

            ApplicationEvaluationDetailDTO target = fetchDetail(sentApp.getApplicationId());

            assertThat(target.averageRating()).isEqualTo(2.0);
            assertThat(target.ratingCount()).isEqualTo(1);
        }

        @Test
        void shouldIncludeInterviewRatingEvenWithoutProfessorRatings() {
            saveInterviewRating(sentApp, AssessmentRating.EXCELLENT);

            ApplicationEvaluationDetailDTO target = fetchDetail(sentApp.getApplicationId());

            assertThat(target.averageRating()).isEqualTo(2.0);
            assertThat(target.ratingCount()).isEqualTo(1);
        }

        @Test
        void shouldAverageProfessorAndInterviewRatingsTogether() {
            RatingTestData.saved(ratingRepository, sentApp, professor, 2);
            saveInterviewRating(sentApp, AssessmentRating.POOR);

            ApplicationEvaluationDetailDTO target = fetchDetail(sentApp.getApplicationId());

            assertThat(target.averageRating()).isEqualTo(0.0);
            assertThat(target.ratingCount()).isEqualTo(2);
        }

        private ApplicationEvaluationDetailDTO fetchDetail(UUID applicationId) {
            ApplicationEvaluationDetailListDTO details = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(
                    "/api/evaluation/application-details",
                    Map.of("offset", "0", "limit", "10"),
                    ApplicationEvaluationDetailListDTO.class,
                    200
                );

            return details
                .applications()
                .stream()
                .filter(application -> application.applicationDetailDTO().applicationId().equals(applicationId))
                .findFirst()
                .orElseThrow();
        }

        private void saveInterviewRating(Application application, AssessmentRating rating) {
            InterviewProcess process = InterviewTestData.savedProcess(interviewProcessRepository, application.getJob());
            Interviewee interviewee = InterviewTestData.newInterviewee(application, process);
            interviewee.setRating(rating);
            intervieweeRepository.save(interviewee);
        }
    }

    @Nested
    class AcceptApplication {

        @Test
        void sentBecomesAcceptedAndMayCloseJob() {
            AcceptDTO payload = new AcceptDTO("Accepted!", true, true);

            Void result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/evaluation/applications/" + sentApp.getApplicationId() + "/accept", payload, Void.class, 204);

            assertThat(result).isNull();

            Application updated = applicationRepository.findById(sentApp.getApplicationId()).orElseThrow();
            assertThat(updated.getState()).isEqualTo(ApplicationState.ACCEPTED);

            Job job = jobRepository.findById(publishedJob.getJobId()).orElseThrow();
            assertThat(job.getState()).isEqualTo(JobState.APPLICANT_FOUND);
        }

        @Test
        void notInReviewableStateReturns400() {
            sentApp.setState(ApplicationState.ACCEPTED);
            applicationRepository.save(sentApp);

            AcceptDTO payload = new AcceptDTO("Already accepted", true, true);

            Void result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/evaluation/applications/" + sentApp.getApplicationId() + "/accept", payload, Void.class, 400);

            assertThat(result).isNull();
        }

        @Test
        void nonExistingReturns404() {
            UUID randomId = UUID.randomUUID();
            AcceptDTO payload = new AcceptDTO("Not found", true, true);

            Void result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/evaluation/applications/" + randomId + "/accept", payload, Void.class, 404);

            assertThat(result).isNull();
        }

        @Test
        void withoutClosingJobKeepsJobOpen() {
            AcceptDTO payload = new AcceptDTO("Accepted but job open", false, false);

            Void result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/evaluation/applications/" + sentApp.getApplicationId() + "/accept", payload, Void.class, 204);

            assertThat(result).isNull();

            Job job = jobRepository.findById(publishedJob.getJobId()).orElseThrow();
            assertThat(job.getState()).isEqualTo(JobState.PUBLISHED);
        }

        @Test
        void withoutNotifyApplicantStillAccepts() {
            AcceptDTO payload = new AcceptDTO("Accepted silently", true, false);

            Void result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/evaluation/applications/" + sentApp.getApplicationId() + "/accept", payload, Void.class, 204);

            assertThat(result).isNull();

            Application updated = applicationRepository.findById(sentApp.getApplicationId()).orElseThrow();
            assertThat(updated.getState()).isEqualTo(ApplicationState.ACCEPTED);
        }
    }

    @Nested
    class RejectApplication {

        @ParameterizedTest(name = "should reject in-review application with reason {0} and notify={1}")
        @CsvSource({ "OTHER_REASON, true", "FAILED_REQUIREMENTS, false" })
        void shouldRejectInReviewApplicationForVariousReasonAndNotifyCombinations(RejectReason reason, boolean notify) {
            RejectDTO payload = new RejectDTO(reason, notify);

            Void result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/evaluation/applications/" + inReviewApp.getApplicationId() + "/reject", payload, Void.class, 204);

            assertThat(result).isNull();

            Application updated = applicationRepository.findById(inReviewApp.getApplicationId()).orElseThrow();
            assertThat(updated.getState()).isEqualTo(ApplicationState.REJECTED);
        }

        @Test
        void notInReviewableStateReturns400() {
            inReviewApp.setState(ApplicationState.ACCEPTED);
            applicationRepository.save(inReviewApp);

            RejectDTO payload = new RejectDTO(RejectReason.FAILED_REQUIREMENTS, true);

            Void result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/evaluation/applications/" + inReviewApp.getApplicationId() + "/reject", payload, Void.class, 400);

            assertThat(result).isNull();
        }

        @Test
        void nonExistingReturns404() {
            UUID randomId = UUID.randomUUID();
            RejectDTO payload = new RejectDTO(RejectReason.FAILED_REQUIREMENTS, true);

            Void result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/evaluation/applications/" + randomId + "/reject", payload, Void.class, 404);

            assertThat(result).isNull();
        }
    }

    @Nested
    class MarkApplicationAsInReview {

        @Test
        void sentBecomesInReview() {
            Void result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead("/api/evaluation/applications/" + sentApp.getApplicationId() + "/open", null, Void.class, 204);

            assertThat(result).isNull();

            Application updated = applicationRepository.findById(sentApp.getApplicationId()).orElseThrow();
            assertThat(updated.getState()).isEqualTo(ApplicationState.IN_REVIEW);
        }

        @Test
        void nonExistingReturns404() {
            UUID randomId = UUID.randomUUID();

            Void result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead("/api/evaluation/applications/" + randomId + "/open", null, Void.class, 404);

            assertThat(result).isNull();
        }
    }

    @Nested
    class DownloadDocuments {

        @Test
        void shouldRejectDownloadOfDraftApplication() {
            Application draft = ApplicationTestData.saved(applicationRepository, publishedJob, applicant, ApplicationState.SAVED);

            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(
                    "/api/evaluation/applications/" + draft.getApplicationId() + "/documents-download",
                    Map.of(),
                    Void.class,
                    403,
                    MediaType.ALL
                );
        }

        @Test
        void includesAllTypes() throws Exception {
            Map<DocumentType, String> expectedFileNames = Map.of(
                DocumentType.BACHELOR_TRANSCRIPT,
                "bachelor",
                DocumentType.MASTER_TRANSCRIPT,
                "master",
                DocumentType.CV,
                "cv",
                DocumentType.REFERENCE,
                "reference",
                DocumentType.CUSTOM,
                "custom"
            );

            int i = 1;
            for (Map.Entry<DocumentType, String> entry : expectedFileNames.entrySet()) {
                DocumentTestData.savedDocumentWithFile(
                    storageRootConfig,
                    documentRepository,
                    professor,
                    sentApp,
                    null,
                    "/testdocs/test-doc" + i + ".pdf",
                    entry.getValue() + ".pdf",
                    entry.getKey(),
                    entry.getValue()
                );
                i++;
            }

            byte[] zipBytes = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndReturnBytes(
                    "/api/evaluation/applications/" + sentApp.getApplicationId() + "/documents-download",
                    Map.of(),
                    200,
                    MediaType.valueOf("application/zip")
                );

            assertThat(zipBytes)
                .isNotNull()
                .isNotEmpty()
                .hasSizeGreaterThan(200)
                .describedAs("Downloaded ZIP should contain all expected document files");

            Set<String> foundEntries = new HashSet<>();

            try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
                ZipEntry entry;
                while ((entry = zis.getNextEntry()) != null) {
                    foundEntries.add(entry.getName());
                    zis.closeEntry();
                }
            }

            assertThat(foundEntries)
                .isNotEmpty()
                .hasSize(expectedFileNames.size())
                .allSatisfy(name -> {
                    assertThat(name).endsWith(".pdf");
                    assertThat(name).doesNotContain("..");
                    assertThat(name).doesNotContain("/");
                });

            assertThat(foundEntries)
                .anyMatch(name -> name.startsWith("bachelor"))
                .anyMatch(name -> name.startsWith("master"))
                .anyMatch(name -> name.startsWith("cv"))
                .anyMatch(name -> name.startsWith("reference"))
                .anyMatch(name -> name.startsWith("custom"));

            assertThat(foundEntries.stream().distinct().count()).isEqualTo(foundEntries.size());

            for (Map.Entry<DocumentType, String> entry : expectedFileNames.entrySet()) {
                assertThat(foundEntries).anyMatch(name -> name.startsWith(entry.getValue()));
            }
        }

        @Test
        void multipleSameTypeAddsNumbering() throws Exception {
            DocumentTestData.savedDocumentWithFile(
                storageRootConfig,
                documentRepository,
                professor,
                sentApp,
                null,
                "/testdocs/test-doc1.pdf",
                "cv1.pdf",
                DocumentType.CV,
                "cv"
            );
            DocumentTestData.savedDocumentWithFile(
                storageRootConfig,
                documentRepository,
                professor,
                sentApp,
                null,
                "/testdocs/test-doc2.pdf",
                "cv2.pdf",
                DocumentType.CV,
                "cv"
            );

            byte[] zipBytes = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndReturnBytes(
                    "/api/evaluation/applications/" + sentApp.getApplicationId() + "/documents-download",
                    Map.of(),
                    200,
                    MediaType.valueOf("application/zip")
                );

            assertThat(zipBytes).isNotEmpty();
            try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
                ZipEntry first = zis.getNextEntry();
                Assertions.assertNotNull(first);
                assertThat(first.getName()).startsWith("cv_1");
                zis.closeEntry();
                ZipEntry second = zis.getNextEntry();
                Assertions.assertNotNull(second);
                assertThat(second.getName()).startsWith("cv_2");
                zis.closeEntry();
            }
        }

        @Test
        void nonExistingApplicationReturns404() {
            UUID randomId = UUID.randomUUID();

            Void result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead("/api/evaluation/applications/" + randomId + "/documents-download", Map.of(), Void.class, 404, MediaType.ALL);

            assertThat(result).isNull();
        }
    }

    @Nested
    class GetJobNames {

        @Test
        void returnsListOfJobNames() {
            List<String> jobNames = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead("/api/evaluation/job-names", Map.of(), new TypeReference<>() {}, 200);

            assertThat(jobNames).contains(publishedJob.getTitle());
        }

        @Test
        void returnsEmptyWhenNoJobsExist() {
            jobRepository.deleteAll();

            List<String> jobNames = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead("/api/evaluation/job-names", Map.of(), new TypeReference<>() {}, 200);

            assertThat(jobNames).isEmpty();
        }
    }

    @Nested
    class Authorization {

        @Test
        void allUnauthorizedEndpointsReturn401() {
            // accept
            Void accept = api
                .withoutPostProcessors()
                .postAndRead(
                    "/api/evaluation/applications/" + sentApp.getApplicationId() + "/accept",
                    new AcceptDTO("msg", false, false),
                    Void.class,
                    401
                );
            assertThat(accept).isNull();

            // reject
            Void reject = api
                .withoutPostProcessors()
                .postAndRead(
                    "/api/evaluation/applications/" + sentApp.getApplicationId() + "/reject",
                    new RejectDTO(RejectReason.FAILED_REQUIREMENTS, false),
                    Void.class,
                    401
                );
            assertThat(reject).isNull();

            // mark as in review
            Void mark = api
                .withoutPostProcessors()
                .putAndRead("/api/evaluation/applications/" + sentApp.getApplicationId() + "/open", null, Void.class, 401);
            assertThat(mark).isNull();

            // get overviews
            Void overviews = api
                .withoutPostProcessors()
                .getAndRead("/api/evaluation/applications", Map.of("offset", "0", "limit", "10"), Void.class, 401);
            assertThat(overviews).isNull();

            // get details
            Void details = api
                .withoutPostProcessors()
                .getAndRead("/api/evaluation/application-details", Map.of("offset", "0", "limit", "10"), Void.class, 401);
            assertThat(details).isNull();

            // get details window
            Void window = api
                .withoutPostProcessors()
                .getAndRead(
                    "/api/evaluation/application-details/window",
                    Map.of("applicationId", inReviewApp.getApplicationId().toString(), "windowSize", "3"),
                    Void.class,
                    401
                );
            assertThat(window).isNull();

            // get job names
            Void jobNames = api.withoutPostProcessors().getAndRead("/api/evaluation/job-names", Map.of(), Void.class, 401);
            assertThat(jobNames).isNull();

            // download documents
            Void documents = api
                .withoutPostProcessors()
                .getAndRead(
                    "/api/evaluation/applications/" + sentApp.getApplicationId() + "/documents-download",
                    Map.of(),
                    Void.class,
                    401
                );
            assertThat(documents).isNull();
        }

        @Test
        void allForbiddenEndpointsReturn403() {
            // accept
            Void accept = api
                .with(JwtPostProcessors.jwtUser(professorUnauthorized.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead(
                    "/api/evaluation/applications/" + sentApp.getApplicationId() + "/accept",
                    new AcceptDTO("msg", false, false),
                    Void.class,
                    403
                );
            assertThat(accept).isNull();

            // reject
            Void reject = api
                .with(JwtPostProcessors.jwtUser(professorUnauthorized.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead(
                    "/api/evaluation/applications/" + sentApp.getApplicationId() + "/reject",
                    new RejectDTO(RejectReason.FAILED_REQUIREMENTS, false),
                    Void.class,
                    403
                );
            assertThat(reject).isNull();

            // mark as in review
            Void mark = api
                .with(JwtPostProcessors.jwtUser(professorUnauthorized.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead("/api/evaluation/applications/" + sentApp.getApplicationId() + "/open", null, Void.class, 403);
            assertThat(mark).isNull();

            // download documents
            Void documents = api
                .with(JwtPostProcessors.jwtUser(professorUnauthorized.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(
                    "/api/evaluation/applications/" + sentApp.getApplicationId() + "/documents-download",
                    Map.of(),
                    Void.class,
                    403,
                    MediaType.ALL
                );
            assertThat(documents).isNull();
        }
    }
}
