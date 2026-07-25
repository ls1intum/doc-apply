package de.tum.cit.aet.job.web.rest;

import static java.util.Map.entry;
import static org.assertj.core.api.Assertions.assertThat;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.core.domain.Image;
import de.tum.cit.aet.core.repository.ImageRepository;
import de.tum.cit.aet.job.constants.*;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.job.dto.*;
import de.tum.cit.aet.job.repository.JobRepository;
import de.tum.cit.aet.usermanagement.domain.Department;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.School;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.repository.DepartmentRepository;
import de.tum.cit.aet.usermanagement.repository.ResearchGroupRepository;
import de.tum.cit.aet.usermanagement.repository.SchoolRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import de.tum.cit.aet.utility.DatabaseCleaner;
import de.tum.cit.aet.utility.MvcTestClient;
import de.tum.cit.aet.utility.PageResponse;
import de.tum.cit.aet.utility.security.JwtPostProcessors;
import de.tum.cit.aet.utility.testdata.ApplicantTestData;
import de.tum.cit.aet.utility.testdata.DepartmentTestData;
import de.tum.cit.aet.utility.testdata.ImageTestData;
import de.tum.cit.aet.utility.testdata.JobTestData;
import de.tum.cit.aet.utility.testdata.ResearchGroupTestData;
import de.tum.cit.aet.utility.testdata.SchoolTestData;
import de.tum.cit.aet.utility.testdata.UserTestData;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import tools.jackson.core.type.TypeReference;

class JobResourceTest extends AbstractResourceTest {

    @Autowired
    JobRepository jobRepository;

    @Autowired
    UserRepository userRepository;

    @Autowired
    ResearchGroupRepository researchGroupRepository;

    @Autowired
    ImageRepository imageRepository;

    @Autowired
    DatabaseCleaner databaseCleaner;

    @Autowired
    SchoolRepository schoolRepository;

    @Autowired
    DepartmentRepository departmentRepository;

    @Autowired
    MvcTestClient api;

    ResearchGroup researchGroup;
    User professor;
    User applicantUser;

    /**
     * Helper method to create a JobFormDTO from a Job entity with an optional imageId
     */
    private JobFormDTO createJobFormDTO(Job job, UUID imageId) {
        return createJobFormDTO(job, job.getTitle(), imageId);
    }

    /**
     * Helper method to create a JobFormDTO from a Job entity with a custom title and optional imageId
     */
    private JobFormDTO createJobFormDTO(Job job, String title, UUID imageId) {
        return new JobFormDTO(
            job.getJobId(),
            title,
            job.getResearchArea(),
            job.getSubjectArea(),
            professor.getUserId(),
            job.getLocation(),
            job.getStartDate(),
            job.getEndDate(),
            job.getWorkload(),
            job.getContractDuration(),
            job.getFundingType(),
            job.getTvlGrade(),
            job.getReferenceLettersRequired(),
            job.getRecommendationType(),
            job.getJobDescriptionEN(),
            job.getJobDescriptionDE(),
            JobState.DRAFT,
            imageId,
            true,
            false,
            null,
            null
        );
    }

    @BeforeEach
    void setup() {
        databaseCleaner.clean();

        // Create school and department for research group
        School school = SchoolTestData.saved(schoolRepository, "School of Computation, Information and Technology", "CIT");
        Department department = DepartmentTestData.saved(departmentRepository, "Computer Science", school);

        researchGroup = ResearchGroupTestData.savedAll(
            researchGroupRepository,
            department,
            "Prof. Doe",
            "Algorithms Group",
            "ALG",
            "Munich",
            "We do cool stuff",
            "alg@example.com",
            "80333",
            "Arcisstr. 21",
            "https://alg.tum.de",
            "ACTIVE"
        );

        professor = UserTestData.savedProfessorAll(
            userRepository,
            researchGroup,
            null,
            "prof.doe@tum.de",
            "John",
            "Doe",
            "en",
            "+49 89 1234",
            "https://doe.tum.de",
            "https://linkedin.com/in/doe",
            "DE",
            null,
            "männlich",
            UUID.randomUUID().toString().replace("-", "").substring(0, 7)
        );

        applicantUser = ApplicantTestData.saveApplicant("applicant@test.de", userRepository);

        JobTestData.saved(jobRepository, professor, researchGroup, "Published Role", JobState.PUBLISHED, LocalDate.of(2025, 9, 1));
        JobTestData.saved(jobRepository, professor, researchGroup, "Draft Role", JobState.DRAFT, LocalDate.of(2025, 10, 1));
    }

    // ===== GET AVAILABLE JOBS =====
    @Nested
    class GetAvailableJobsTests {

        @Test
        void getAvailableJobsOnlyPublishedOnes() {
            PageResponse<JobCardDTO> page = api.getAndRead(
                "/api/jobs/available",
                Map.of("pageNumber", "0", "pageSize", "10"),
                new TypeReference<>() {},
                200
            );

            assertThat(page.totalElements()).isEqualTo(1);
            assertThat(page.content()).hasSize(1);
            assertThat(page.number()).isZero();
            assertThat(page.size()).isEqualTo(10);

            JobCardDTO card = page.content().getFirst();
            assertThat(card.title()).isEqualTo("Published Role");
            assertThat(card.location().getEnglishValue()).isEqualTo("Garching");
            assertThat(card.professorName()).isEqualTo("John Doe");
            assertThat(card.avatar()).isEqualTo(professor.getAvatar());
            assertThat(card.workload()).isEqualTo(20);
            assertThat(card.startDate()).isEqualTo(LocalDate.of(2025, 9, 1));
        }

        @Test
        void getAvailableJobsInvalidPaginationReturnsError() {
            api.getAndRead("/api/jobs/available", Map.of("pageNumber", "-1", "pageSize", "10"), new TypeReference<>() {}, 400);
        }
    }

    // ===== CREATE JOB =====
    @Nested
    class CreateJobTests {

        @Test
        void createJobPersistsAndReturnsIt() {
            JobFormDTO payload = new JobFormDTO(
                null,
                "ML Engineer",
                "Machine Learning",
                SubjectArea.COMPUTER_SCIENCE,
                professor.getUserId(),
                Campus.GARCHING,
                LocalDate.of(2025, 11, 1),
                LocalDate.of(2026, 5, 31),
                40,
                12,
                FundingType.FULLY_FUNDED,
                TvlGrade.E13,
                2,
                RecommendationType.LETTER_AND_EVALUATION,
                "Build ML pipelines",
                "ML Pipeline erstellen",
                JobState.PUBLISHED,
                null,
                true,
                false,
                null,
                null
            );

            JobFormDTO returned = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/jobs/create", payload, JobFormDTO.class, 200);

            assertThat(returned.jobId()).isNotNull();
            assertThat(returned).usingRecursiveComparison().ignoringFields("jobId").isEqualTo(payload);

            Job saved = jobRepository.findById(returned.jobId()).orElseThrow();
            assertThat(saved)
                .extracting(
                    Job::getTitle,
                    Job::getResearchArea,
                    Job::getSubjectArea,
                    (Job j) -> j.getSupervisingProfessor().getUserId(),
                    Job::getLocation,
                    Job::getStartDate,
                    Job::getEndDate,
                    Job::getWorkload,
                    Job::getContractDuration,
                    Job::getFundingType,
                    Job::getTvlGrade,
                    Job::getJobDescriptionEN,
                    Job::getJobDescriptionDE,
                    Job::getState,
                    Job::getReferenceLettersRequired,
                    Job::getRecommendationType
                )
                .containsExactly(
                    "ML Engineer",
                    "Machine Learning",
                    SubjectArea.COMPUTER_SCIENCE,
                    professor.getUserId(),
                    Campus.GARCHING,
                    LocalDate.of(2025, 11, 1),
                    LocalDate.of(2026, 5, 31),
                    40,
                    12,
                    FundingType.FULLY_FUNDED,
                    TvlGrade.E13,
                    "Build ML pipelines",
                    "ML Pipeline erstellen",
                    JobState.PUBLISHED,
                    2,
                    RecommendationType.LETTER_AND_EVALUATION
                );
        }

        @Test
        void createJobDefaultsRecommendationTypeWhenAbsent() {
            Job job = jobRepository.findAll().getFirst();
            JobFormDTO base = createJobFormDTO(job, "Default Type Position", null);
            JobFormDTO payload = new JobFormDTO(
                null,
                base.title(),
                base.researchArea(),
                base.subjectArea(),
                base.supervisingProfessor(),
                base.location(),
                base.startDate(),
                base.endDate(),
                base.workload(),
                base.contractDuration(),
                base.fundingType(),
                base.tvlGrade(),
                1,
                null,
                base.jobDescriptionEN(),
                base.jobDescriptionDE(),
                JobState.DRAFT,
                null,
                base.suitableForDisabled(),
                base.startDateByArrangement(),
                null,
                null
            );

            JobFormDTO returned = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/jobs/create", payload, JobFormDTO.class, 200);

            Job saved = jobRepository.findById(returned.jobId()).orElseThrow();
            assertThat(saved.getRecommendationType()).isEqualTo(RecommendationType.LETTER_AND_EVALUATION);
        }

        @Test
        void createJobClearsRecommendationTypeWhenNoReferencesRequired() {
            Job job = jobRepository.findAll().getFirst();
            JobFormDTO base = createJobFormDTO(job, "No References Position", null);
            JobFormDTO payload = new JobFormDTO(
                null,
                base.title(),
                base.researchArea(),
                base.subjectArea(),
                base.supervisingProfessor(),
                base.location(),
                base.startDate(),
                base.endDate(),
                base.workload(),
                base.contractDuration(),
                base.fundingType(),
                base.tvlGrade(),
                0,
                RecommendationType.EVALUATION_ONLY,
                base.jobDescriptionEN(),
                base.jobDescriptionDE(),
                JobState.DRAFT,
                null,
                base.suitableForDisabled(),
                base.startDateByArrangement(),
                null,
                null
            );

            JobFormDTO returned = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/jobs/create", payload, JobFormDTO.class, 200);

            Job saved = jobRepository.findById(returned.jobId()).orElseThrow();
            assertThat(saved.getRecommendationType()).isNull();
            assertThat(returned.recommendationType()).isNull();
        }

        @Test
        void createJobInvalidDoesNotPersist() {
            long before = jobRepository.count();

            Map<String, Object> invalid = Map.ofEntries(
                entry("title", "Bad Job"),
                entry("researchArea", "Machine Learning"),
                entry("subjectArea", "COMPUTER_SCIENCE"),
                entry("supervisingProfessor", professor.getUserId().toString()),
                entry("location", "GARCHING"),
                entry("startDate", "2025-11-01"),
                entry("endDate", "2026-05-31"),
                entry("workload", "oops"),
                entry("contractDuration", 12),
                entry("fundingType", "FULLY_FUNDED"),
                entry("tvlGrade", "E10"),
                entry("jobDescriptionEN", "desc"),
                entry("jobDescriptionDE", "desc"),
                entry("state", "PUBLISHED")
            );

            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/jobs/create", invalid, JobFormDTO.class, 400);

            assertThat(jobRepository.count()).isEqualTo(before);
        }

        @ParameterizedTest
        @NullSource
        @ValueSource(strings = "ROLE_APPLICANT")
        void createJobForbidden(String role) {
            JobFormDTO payload = new JobFormDTO(
                null,
                "Unauthorized",
                "Area",
                SubjectArea.COMPUTER_SCIENCE,
                professor.getUserId(),
                Campus.GARCHING,
                LocalDate.now(),
                LocalDate.now().plusMonths(1),
                20,
                6,
                FundingType.FULLY_FUNDED,
                null,
                0,
                null,
                "desc",
                "desc",
                JobState.DRAFT,
                null,
                true,
                false,
                null,
                null
            );
            MvcTestClient client = role != null ? api.with(JwtPostProcessors.jwtUser(applicantUser.getUserId(), role)) : api;
            client.postAndRead("/api/jobs/create", payload, JobFormDTO.class, 403);
        }
    }

    // ===== UPDATE JOB =====
    @Nested
    class UpdateJobTests {

        @Test
        void updateJobUpdatesCorrectly() {
            Job job = jobRepository.findAll().getFirst();

            JobFormDTO updatedPayload = new JobFormDTO(
                job.getJobId(),
                "Updated Title",
                "Updated Area",
                SubjectArea.DATA_SCIENCE,
                professor.getUserId(),
                Campus.GARCHING_HOCHBRUECK,
                LocalDate.of(2025, 12, 1),
                LocalDate.of(2026, 6, 30),
                30,
                6,
                FundingType.PARTIALLY_FUNDED,
                TvlGrade.E15,
                2,
                RecommendationType.EVALUATION_ONLY,
                "Updated Description",
                "Neue Beschreibung",
                JobState.DRAFT,
                null,
                true,
                false,
                null,
                null
            );

            JobFormDTO returnedJob = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead("/api/jobs/update/" + job.getJobId(), updatedPayload, JobFormDTO.class, 200);

            assertThat(returnedJob).usingRecursiveComparison().isEqualTo(updatedPayload);
            Job updatedJob = jobRepository.findById(job.getJobId()).orElseThrow();

            assertThat(updatedJob.getTitle()).isEqualTo(updatedPayload.title());
            assertThat(updatedJob.getResearchArea()).isEqualTo(updatedPayload.researchArea());
            assertThat(updatedJob.getSubjectArea()).isEqualTo(updatedPayload.subjectArea());
            assertThat(updatedJob.getSupervisingProfessor().getUserId()).isEqualTo(updatedPayload.supervisingProfessor());
            assertThat(updatedJob.getLocation()).isEqualTo(updatedPayload.location());
            assertThat(updatedJob.getStartDate()).isEqualTo(updatedPayload.startDate());
            assertThat(updatedJob.getEndDate()).isEqualTo(updatedPayload.endDate());
            assertThat(updatedJob.getWorkload()).isEqualTo(updatedPayload.workload());
            assertThat(updatedJob.getContractDuration()).isEqualTo(updatedPayload.contractDuration());
            assertThat(updatedJob.getFundingType()).isEqualTo(updatedPayload.fundingType());
            assertThat(updatedJob.getTvlGrade()).isEqualTo(updatedPayload.tvlGrade());
            assertThat(updatedJob.getJobDescriptionEN()).isEqualTo(updatedPayload.jobDescriptionEN());
            assertThat(updatedJob.getJobDescriptionDE()).isEqualTo(updatedPayload.jobDescriptionDE());
            assertThat(updatedJob.getState()).isEqualTo(updatedPayload.state());
            assertThat(updatedJob.getRecommendationType()).isEqualTo(updatedPayload.recommendationType());
        }

        @Test
        void updateJobNonexistentJobThrowsNotFound() {
            JobFormDTO updatedPayload = new JobFormDTO(
                UUID.randomUUID(),
                "Ghost Job",
                "Area",
                SubjectArea.COMPUTER_SCIENCE,
                professor.getUserId(),
                Campus.GARCHING,
                LocalDate.now(),
                LocalDate.now().plusMonths(6),
                20,
                6,
                FundingType.FULLY_FUNDED,
                TvlGrade.E12,
                2,
                null,
                "desc",
                "desc",
                JobState.DRAFT,
                null,
                true,
                false,
                null,
                null
            );

            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead("/api/jobs/update/" + updatedPayload.jobId(), updatedPayload, JobFormDTO.class, 404);
        }

        @ParameterizedTest
        @NullSource
        @ValueSource(strings = "ROLE_APPLICANT")
        void updateJobForbidden(String role) {
            Job job = jobRepository.findAll().getFirst();
            JobFormDTO updatedPayload = new JobFormDTO(
                job.getJobId(),
                "No Auth",
                "Area",
                SubjectArea.COMPUTER_SCIENCE,
                professor.getUserId(),
                Campus.GARCHING,
                LocalDate.now(),
                LocalDate.now().plusMonths(1),
                10,
                3,
                FundingType.FULLY_FUNDED,
                null,
                3,
                null,
                "desc",
                "desc",
                JobState.DRAFT,
                null,
                true,
                false,
                null,
                null
            );
            MvcTestClient client = role != null ? api.with(JwtPostProcessors.jwtUser(applicantUser.getUserId(), role)) : api;
            client.putAndRead("/api/jobs/update/" + job.getJobId(), updatedPayload, JobFormDTO.class, 403);
        }
    }

    // ===== DELETE JOB =====
    @Nested
    class DeleteJobTests {

        @Test
        void deleteJobRemovesIt() {
            Job job = jobRepository.findAll().getFirst();
            assertThat(jobRepository.existsById(job.getJobId())).isTrue();

            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .deleteAndRead("/api/jobs/" + job.getJobId(), null, Void.class, 204);

            assertThat(jobRepository.existsById(job.getJobId())).isFalse();
        }

        @Test
        void deleteJobNonexistentJobThrowsNotFound() {
            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .deleteAndRead("/api/jobs/" + UUID.randomUUID(), null, Void.class, 404);
        }

        @ParameterizedTest
        @NullSource
        @ValueSource(strings = "ROLE_APPLICANT")
        void deleteJobForbidden(String role) {
            Job job = jobRepository.findAll().getFirst();
            MvcTestClient client = role != null ? api.with(JwtPostProcessors.jwtUser(applicantUser.getUserId(), role)) : api;
            client.deleteAndRead("/api/jobs/" + job.getJobId(), null, Void.class, 403);
        }
    }

    // ===== CHANGE JOB STATE =====
    @Nested
    class ChangeJobStateTests {

        @Test
        void changeJobStateUpdatesIt() {
            Job job = jobRepository.findAll().getFirst();
            assertThat(job.getState()).isEqualTo(JobState.PUBLISHED);

            JobFormDTO returnedJob = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(
                    "/api/jobs/changeState/" + job.getJobId() + "?jobState=CLOSED&shouldRejectRemainingApplications=true",
                    null,
                    JobFormDTO.class,
                    200
                );

            assertThat(returnedJob.jobId()).isEqualTo(job.getJobId());

            Job updatedJob = jobRepository.findById(job.getJobId()).orElseThrow();
            assertThat(updatedJob.getState()).isEqualTo(JobState.CLOSED);
        }

        @Test
        void changeJobStateNonExistantJobThrowsNotFound() {
            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(
                    "/api/jobs/changeState/" + UUID.randomUUID() + "?jobState=CLOSED&shouldRejectRemainingApplications=true",
                    null,
                    JobFormDTO.class,
                    404
                );
        }

        @ParameterizedTest
        @NullSource
        @ValueSource(strings = "ROLE_APPLICANT")
        void changeJobStateForbidden(String role) {
            Job job = jobRepository.findAll().getFirst();
            MvcTestClient client = role != null ? api.with(JwtPostProcessors.jwtUser(applicantUser.getUserId(), role)) : api;
            client.putAndRead(
                "/api/jobs/changeState/" + job.getJobId() + "?jobState=CLOSED&shouldRejectRemainingApplications=false",
                null,
                JobFormDTO.class,
                403
            );
        }
    }

    // ===== GET JOBS FOR CURRENT RESEARCH GROUP =====
    @Nested
    class GetJobsForCurrentResearchGroupTests {

        @Test
        void getJobsForCurrentResearchGroupReturnsJobsForResearchGroup() {
            PageResponse<CreatedJobDTO> page = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead("/api/jobs/research-group", Map.of("pageNumber", "0", "pageSize", "10"), new TypeReference<>() {}, 200);
            assertThat(page.totalElements()).isEqualTo(2);
        }

        @Test
        void getJobsForCurrentResearchGroupInvalidPaginationReturnsError() {
            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead("/api/jobs/research-group", Map.of("pageNumber", "-1", "pageSize", "10"), new TypeReference<>() {}, 400);
        }

        @Test
        void getJobsForCurrentResearchGroupWithoutAuthForbidden() {
            api.getAndRead("/api/jobs/research-group", Map.of("pageNumber", "0", "pageSize", "10"), new TypeReference<>() {}, 403);
        }
    }

    // ===== GET ALL JOBS (ADMIN) =====
    @Nested
    class GetAllJobsTests {

        @Test
        void shouldReturnAllJobsForAdmin() {
            UUID adminUserId = UUID.randomUUID();
            PageResponse<AdminCreatedJobDTO> page = api
                .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
                .getAndRead("/api/jobs/all", Map.of("pageNumber", "0", "pageSize", "10"), new TypeReference<>() {}, 200);

            assertThat(page.totalElements()).isEqualTo(2);
            assertThat(page.content()).hasSize(2);
        }

        @Test
        void shouldRejectProfessorOnAdminEndpoint() {
            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead("/api/jobs/all", Map.of("pageNumber", "0", "pageSize", "10"), new TypeReference<>() {}, 403);
        }
    }

    // ===== GET JOB BY ID =====
    @Nested
    class GetJobByIdTests {

        @Test
        void getJobByIdReturnsCorrectJob() {
            Job job = jobRepository.findAll().getFirst();

            JobDTO returnedJob = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead("/api/jobs/" + job.getJobId(), null, JobDTO.class, 200);

            assertThat(returnedJob.jobId()).isEqualTo(job.getJobId());
            assertThat(returnedJob.title()).isEqualTo(job.getTitle());
            assertThat(returnedJob.researchArea()).isEqualTo(job.getResearchArea());
            assertThat(returnedJob.subjectArea()).isEqualTo(job.getSubjectArea());
            assertThat(returnedJob.supervisingProfessor()).isEqualTo(job.getSupervisingProfessor().getUserId());
            assertThat(returnedJob.location()).isEqualTo(job.getLocation());
            assertThat(returnedJob.startDate()).isEqualTo(job.getStartDate());
            assertThat(returnedJob.endDate()).isEqualTo(job.getEndDate());
            assertThat(returnedJob.workload()).isEqualTo(job.getWorkload());
            assertThat(returnedJob.contractDuration()).isEqualTo(job.getContractDuration());
            assertThat(returnedJob.fundingType()).isEqualTo(job.getFundingType());
            assertThat(returnedJob.tvlGrade()).isEqualTo(job.getTvlGrade());
            assertThat(returnedJob.jobDescriptionEN()).isEqualTo(job.getJobDescriptionEN());
            assertThat(returnedJob.jobDescriptionDE()).isEqualTo(job.getJobDescriptionDE());
            assertThat(returnedJob.state()).isEqualTo(job.getState());
        }

        @Test
        void getJobByIdNonExistentJobThrowsNotFound() {
            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead("/api/jobs/" + UUID.randomUUID(), null, JobDTO.class, 404);
        }

        @Test
        void getJobByIdWithoutAuthForbidden() {
            Job job = jobRepository.findAll().getFirst();
            api.getAndRead("/api/jobs/" + job.getJobId(), null, JobDTO.class, 403);
        }
    }

    // ===== GET JOB DETAILS =====
    @Nested
    class GetJobDetailsTests {

        @Test
        void getJobDetailsReturnsCorrectJobDetails() {
            Job job = jobRepository.findAll().getFirst();

            JobDetailDTO returnedJob = api.getAndRead("/api/jobs/detail/" + job.getJobId(), null, JobDetailDTO.class, 200);

            assertThat(returnedJob.jobId()).isEqualTo(job.getJobId());
            assertThat(returnedJob.supervisingProfessorName()).isEqualTo(
                job.getSupervisingProfessor().getFirstName() + " " + job.getSupervisingProfessor().getLastName()
            );
            assertThat(returnedJob.title()).isEqualTo(job.getTitle());
            assertThat(returnedJob.subjectArea()).isEqualTo(job.getSubjectArea());
            assertThat(returnedJob.researchArea()).isEqualTo(job.getResearchArea());
            assertThat(returnedJob.location().getEnglishValue()).isEqualTo("Garching");
            assertThat(returnedJob.workload()).isEqualTo(job.getWorkload());
            assertThat(returnedJob.contractDuration()).isEqualTo(job.getContractDuration());
            assertThat(returnedJob.fundingType()).isEqualTo(job.getFundingType());
            assertThat(returnedJob.tvlGrade()).isEqualTo(job.getTvlGrade());
            assertThat(returnedJob.jobDescriptionEN()).isEqualTo(job.getJobDescriptionEN());
            assertThat(returnedJob.jobDescriptionDE()).isEqualTo(job.getJobDescriptionDE());
            assertThat(returnedJob.startDate()).isEqualTo(job.getStartDate());
            assertThat(returnedJob.endDate()).isEqualTo(job.getEndDate());
            assertThat(returnedJob.createdAt()).isEqualTo(job.getCreatedAt());
            assertThat(returnedJob.lastModifiedAt()).isEqualTo(job.getLastModifiedAt());
            assertThat(returnedJob.state()).isEqualTo(job.getState());

            // Verify the research group summary DTO is correctly populated
            assertThat(returnedJob.researchGroup()).isNotNull();
            assertThat(returnedJob.researchGroup().researchGroupId()).isEqualTo(job.getResearchGroup().getResearchGroupId());
            assertThat(returnedJob.researchGroup().name()).isEqualTo(job.getResearchGroup().getName());
            assertThat(returnedJob.researchGroup().description()).isEqualTo(job.getResearchGroup().getDescription());
            assertThat(returnedJob.researchGroup().email()).isEqualTo(job.getResearchGroup().getEmail());
            assertThat(returnedJob.researchGroup().website()).isEqualTo(job.getResearchGroup().getWebsite());
            assertThat(returnedJob.researchGroup().street()).isEqualTo(job.getResearchGroup().getStreet());
            assertThat(returnedJob.researchGroup().postalCode()).isEqualTo(job.getResearchGroup().getPostalCode());
            assertThat(returnedJob.researchGroup().city()).isEqualTo(job.getResearchGroup().getCity());
            assertThat(returnedJob.researchGroup().departmentName()).isEqualTo(job.getResearchGroup().getDepartment().getName());
        }

        @Test
        void getJobDetailsNonExistantIdThrowsNotFound() {
            api.getAndRead("/api/jobs/detail/" + UUID.randomUUID(), null, JobDetailDTO.class, 404);
        }
    }

    // ===== UPDATE JOB IMAGE HANDLING =====
    @Nested
    class UpdateJobImageHandlingTests {

        @Test
        void updateJobReplacingImageCallsReplaceImage() {
            // Arrange - Create a job with a job banner
            Image jobBanner1 = imageRepository.save(ImageTestData.newJobBanner(professor, researchGroup));
            Job job = jobRepository.findAll().getFirst();
            job.setImage(jobBanner1);
            jobRepository.save(job);

            // Create a new job banner
            Image jobBanner2 = imageRepository.save(ImageTestData.newJobBanner(professor, researchGroup));

            JobFormDTO updatedPayload = createJobFormDTO(job, jobBanner2.getImageId());

            // Act
            JobFormDTO result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead("/api/jobs/update/" + job.getJobId(), updatedPayload, JobFormDTO.class, 200);

            // Assert - Job banners should NOT be deleted (they're reusable library images)
            assertThat(imageRepository.findById(jobBanner1.getImageId())).isPresent();
            assertThat(imageRepository.findById(jobBanner2.getImageId())).isPresent();
            assertThat(result.imageId()).isEqualTo(jobBanner2.getImageId());
        }

        @Test
        void updateJobRemovingImageDoesNotDeleteReusableLibraryImage() {
            // Arrange - Create a job with a job banner
            Image jobBanner = imageRepository.save(ImageTestData.newJobBanner(professor, researchGroup));
            Job job = jobRepository.findAll().getFirst();
            job.setImage(jobBanner);
            jobRepository.save(job);

            JobFormDTO updatedPayload = createJobFormDTO(job, null);

            // Act
            JobFormDTO result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead("/api/jobs/update/" + job.getJobId(), updatedPayload, JobFormDTO.class, 200);

            // Assert - Job banner should NOT be deleted (it's a reusable library image)
            assertThat(imageRepository.findById(jobBanner.getImageId())).isPresent();
            assertThat(result.imageId()).isNull();
        }

        @Test
        void updateJobWithDefaultJobBannerDoesNotDeleteOldImage() {
            // Arrange - Create admin user for default image
            User adminUser = UserTestData.newUserAll(UUID.randomUUID(), "admin@tum.de", "Admin", "User");
            adminUser = userRepository.save(adminUser);

            Image defaultBanner = imageRepository.save(ImageTestData.newDefaultJobBanner(adminUser, researchGroup.getDepartment()));
            Job job = jobRepository.findAll().getFirst();
            job.setImage(defaultBanner);
            jobRepository.save(job);

            // Create a new default banner
            Image newDefaultBanner = imageRepository.save(ImageTestData.newDefaultJobBanner(adminUser, researchGroup.getDepartment()));

            JobFormDTO updatedPayload = createJobFormDTO(job, newDefaultBanner.getImageId());

            // Act
            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead("/api/jobs/update/" + job.getJobId(), updatedPayload, JobFormDTO.class, 200);

            // Assert - Default images should NOT be auto-deleted
            assertThat(imageRepository.findById(defaultBanner.getImageId())).isPresent();
            assertThat(imageRepository.findById(newDefaultBanner.getImageId())).isPresent();
        }

        @Test
        void updateJobWithJobBannerDoesNotDeleteOldImage() {
            // Arrange - Create job banners (research group library images)
            Image jobBanner1 = imageRepository.save(ImageTestData.newJobBanner(professor, researchGroup));
            Job job = jobRepository.findAll().getFirst();
            job.setImage(jobBanner1);
            jobRepository.save(job);

            Image jobBanner2 = imageRepository.save(ImageTestData.newJobBanner(professor, researchGroup));

            JobFormDTO updatedPayload = createJobFormDTO(job, jobBanner2.getImageId());

            // Act
            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead("/api/jobs/update/" + job.getJobId(), updatedPayload, JobFormDTO.class, 200);

            // Assert - Job banners are reusable library images, so should NOT be deleted
            assertThat(imageRepository.findById(jobBanner1.getImageId())).isPresent();
            assertThat(imageRepository.findById(jobBanner2.getImageId())).isPresent();
        }

        @Test
        void updateJobWithSameImageDoesNotDeleteIt() {
            // Arrange
            Image jobBanner = imageRepository.save(ImageTestData.newJobBanner(professor, researchGroup));
            Job job = jobRepository.findAll().getFirst();
            job.setImage(jobBanner);
            jobRepository.save(job);

            JobFormDTO updatedPayload = createJobFormDTO(job, "Updated Title", jobBanner.getImageId());

            // Act
            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead("/api/jobs/update/" + job.getJobId(), updatedPayload, JobFormDTO.class, 200);

            // Assert - Image should still exist (not deleted)
            assertThat(imageRepository.findById(jobBanner.getImageId())).isPresent();
        }
    }
}
