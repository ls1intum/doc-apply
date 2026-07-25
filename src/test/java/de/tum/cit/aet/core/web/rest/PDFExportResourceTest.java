package de.tum.cit.aet.core.web.rest;

import static org.assertj.core.api.Assertions.assertThat;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.application.constants.ApplicationState;
import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.application.domain.dto.ApplicationDetailDTO;
import de.tum.cit.aet.application.domain.dto.ApplicationPDFRequest;
import de.tum.cit.aet.application.repository.ApplicationRepository;
import de.tum.cit.aet.job.constants.*;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.job.dto.JobFormDTO;
import de.tum.cit.aet.job.dto.JobPreviewRequest;
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
import de.tum.cit.aet.utility.testdata.ApplicantTestData;
import de.tum.cit.aet.utility.testdata.ApplicationTestData;
import de.tum.cit.aet.utility.testdata.JobTestData;
import de.tum.cit.aet.utility.testdata.ResearchGroupTestData;
import de.tum.cit.aet.utility.testdata.UserTestData;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.io.RandomAccessReadBuffer;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PDFExportResourceTest extends AbstractResourceTest {

    private static final String BASE_URL = "/api/export";
    private static final byte[] PDF_MAGIC_NUMBER = "%PDF-".getBytes();
    private static final int MIN_PDF_SIZE = 1000;

    @Autowired
    DatabaseCleaner databaseCleaner;

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
    MvcTestClient api;

    User professor;
    ResearchGroup group;
    Applicant applicant;
    Applicant applicantWithWebsiteAndLinkedin;
    Job job;
    Application application;
    Application applicationWithWebsiteAndLinkedin;

    @BeforeEach
    void setup() {
        databaseCleaner.clean();
        group = ResearchGroupTestData.saved(researchGroupRepository);
        professor = UserTestData.savedProfessor(userRepository, group);
        applicant = ApplicantTestData.savedWithNewUser(applicantRepository, userRepository);
        applicantWithWebsiteAndLinkedin = ApplicantTestData.savedWithNewUserWithWebsiteAndLinkedin(applicantRepository, userRepository);
        job = JobTestData.saved(jobRepository, professor, group, null, null, null);
        application = ApplicationTestData.savedAll(
            applicationRepository,
            job,
            applicant,
            ApplicationState.SENT,
            LocalDate.now(),
            "Test projects",
            "Test skills",
            "Test motivation"
        );
        applicationWithWebsiteAndLinkedin = ApplicationTestData.savedAll(
            applicationRepository,
            job,
            applicantWithWebsiteAndLinkedin,
            ApplicationState.SENT,
            LocalDate.now(),
            "Test projects",
            "Test skills",
            "Test motivation"
        );
    }

    private MvcTestClient asProfessor(User user) {
        return api.with(JwtPostProcessors.jwtUser(user.getUserId(), "ROLE_PROFESSOR"));
    }

    private MvcTestClient asApplicant(Applicant applicant) {
        return api.with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"));
    }

    private Map<String, String> createCompleteLabelsMap() {
        Map<String, String> labels = new java.util.HashMap<>();
        addHeaderAndOverviewLabels(labels);
        addPersonalLabels(labels);
        addEducationAndMetadataLabels(labels);
        addJobSpecificLabels(labels);
        return labels;
    }

    private void addHeaderAndOverviewLabels(Map<String, String> labels) {
        // Application header
        labels.put("application", "Application");
        labels.put("headline", "Application for ");
        labels.put("applicationBy", "Application by ");
        labels.put("forPosition", " for position ");
        labels.put("status", "Status: ");

        // Overview
        labels.put("overview", "Overview");
        labels.put("supervisor", "Supervisor");
        labels.put("researchGroup", "Research Group");
        labels.put("location", "Location");
        labels.put("subjectArea", "Subject Area");
        labels.put("researchArea", "Research Area");
        labels.put("workload", "Workload");
        labels.put("hoursPerWeek", " hours/week");
        labels.put("duration", "Duration");
        labels.put("year", " year");
        labels.put("years", " years");
        labels.put("fundingType", "Funding Type");
        labels.put("tvlGrade", "Pay Grade");
        labels.put("startDate", "Start Date");
        labels.put("endDate", "End Date");
        labels.put("suitableForDisabled", "Suitable for Disabled");
        labels.put("uponAgreement", "Upon agreement");
        labels.put("yes", "Yes");
        labels.put("no", "No");
        labels.put("jobDescription", "Job Description");
    }

    private void addPersonalLabels(Map<String, String> labels) {
        // Personal Statements
        labels.put("personalStatements", "Personal Statements");
        labels.put("motivation", "Motivation");
        labels.put("skills", "Special Skills");
        labels.put("researchExperience", "Research Experience");

        // Personal Information
        labels.put("personalInformation", "Personal Information");
        labels.put("applicantInfo", "Applicant Information");
        labels.put("preferredLanguage", "Preferred Language");
        labels.put("desiredStartDate", "Desired Start Date");
        labels.put("gender", "Gender");
        labels.put("nationality", "Nationality");
        labels.put("website", "Website");
        labels.put("linkedIn", "LinkedIn");
    }

    private void addEducationAndMetadataLabels(Map<String, String> labels) {
        // Education
        labels.put("bachelorInfo", "Bachelor Information");
        labels.put("masterInfo", "Master Information");
        labels.put("degreeName", "Degree Name");
        labels.put("university", "University");
        labels.put("grade", "Grade");

        // Footer/Metadata
        labels.put("thisDocumentWasGeneratedOn", "This document was generated on ");
        labels.put("byUser", " by user ");
        labels.put("usingTumapply", " using TUMApply.");
        labels.put("metaEndText", "End of document");
        labels.put("page", "Page");
        labels.put("of", "of");
    }

    private void addJobSpecificLabels(Map<String, String> labels) {
        // Job specific
        labels.put("jobPdfEnding", "Job_Posting");
        labels.put("jobBy", "Job by ");
        labels.put("forJob", " for job ");
        labels.put("jobDetails", "Job Details");
        labels.put("description", "Description");
        labels.put("tasksResponsibilities", "Tasks & Responsibilities");
        labels.put("eligibilityCriteria", "Eligibility Criteria");
        labels.put("contactDetails", "Contact Details");
        labels.put("address", "Address");
        labels.put("email", "Email");
    }

    private void assertValidPdf(byte[] pdfBytes) {
        assertThat(pdfBytes).isNotNull();
        assertThat(pdfBytes).isNotEmpty();
        assertThat(pdfBytes).startsWith(PDF_MAGIC_NUMBER);
        assertThat(pdfBytes.length).isGreaterThan(MIN_PDF_SIZE);
    }

    private ApplicationPDFRequest createApplicationPdfRequest(Application application, Job job) {
        Map<String, String> labels = createCompleteLabelsMap();
        ApplicationDetailDTO appDto = ApplicationDetailDTO.getFromEntity(application, job);
        return new ApplicationPDFRequest(appDto, labels);
    }

    // Helper to extract text from a PDF byte array using PDFBox
    private String extractTextFromPdf(byte[] pdfBytes) {
        try (PDDocument doc = Loader.loadPDF(new RandomAccessReadBuffer(pdfBytes))) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(doc);
        } catch (Exception e) {
            throw new RuntimeException("Failed to extract text from PDF", e);
        }
    }

    @Nested
    class ExportApplicationToPDF {

        @Test
        void exportApplicationToPDFReturnsPdfForAuthenticatedUser() {
            ApplicationPDFRequest request = createApplicationPdfRequest(application, job);

            byte[] result = asApplicant(applicant).postAndReturnBytes(
                BASE_URL + "/application/pdf",
                request,
                200,
                MediaType.APPLICATION_PDF
            );
            assertValidPdf(result);
        }

        @Test
        void exportApplicationToPDFReturns401ForUnauthenticatedUser() {
            ApplicationPDFRequest request = createApplicationPdfRequest(application, job);

            Void result = api
                .withoutPostProcessors()
                .postAndRead(BASE_URL + "/application/pdf", request, Void.class, 401, MediaType.APPLICATION_PDF);
            assertThat(result).isNull();
        }

        @Test
        void shouldExportApplicationWithWebsiteAndLinkedIn() {
            ApplicationPDFRequest request = createApplicationPdfRequest(application, job);

            byte[] result = asApplicant(applicantWithWebsiteAndLinkedin).postAndReturnBytes(
                BASE_URL + "/application/pdf",
                request,
                200,
                MediaType.APPLICATION_PDF
            );
            assertValidPdf(result);
        }

        @Test
        void shouldExportApplicationWithMasterDegreeNameNull() {
            Applicant applicantWithMasterNameNull = ApplicantTestData.savedWithNewUser(applicantRepository, userRepository);
            applicantWithMasterNameNull.setMasterDegreeName(null);
            applicantRepository.save(applicantWithMasterNameNull);
            Application appWithMaster = ApplicationTestData.savedAll(
                applicationRepository,
                job,
                applicantWithMasterNameNull,
                ApplicationState.SENT,
                LocalDate.now(),
                "Test",
                "Test",
                "Test"
            );
            ApplicationPDFRequest request = createApplicationPdfRequest(appWithMaster, job);

            byte[] result = asApplicant(applicantWithMasterNameNull).postAndReturnBytes(
                BASE_URL + "/application/pdf",
                request,
                200,
                MediaType.APPLICATION_PDF
            );
            assertValidPdf(result);
        }
    }

    @Nested
    class ExportJobToPDF {

        @Test
        void exportJobToPDFReturnsPdfForPublicAccess() {
            Map<String, String> labels = createCompleteLabelsMap();

            byte[] result = api
                .withoutPostProcessors()
                .postAndReturnBytes(BASE_URL + "/job/" + job.getJobId() + "/pdf", labels, 200, MediaType.APPLICATION_PDF);

            assertValidPdf(result);
        }

        @Test
        void shouldExportJobForEmployee() {
            User employee = UserTestData.savedEmployee(userRepository, group);

            byte[] result = api
                .with(JwtPostProcessors.jwtUser(employee.getUserId(), "ROLE_EMPLOYEE"))
                .postAndReturnBytes(
                    BASE_URL + "/job/" + job.getJobId() + "/pdf",
                    createCompleteLabelsMap(),
                    200,
                    MediaType.APPLICATION_PDF
                );

            assertValidPdf(result);
        }

        @Test
        void shouldHandleJobWithNullFields() {
            ResearchGroup groupWithNoContact = ResearchGroupTestData.newRgOptional();
            groupWithNoContact = researchGroupRepository.save(groupWithNoContact);

            User prof = UserTestData.savedProfessor(userRepository, groupWithNoContact);
            Job jobWithEmptyContact = JobTestData.savedNull(jobRepository, prof, groupWithNoContact);

            byte[] result = api
                .withoutPostProcessors()
                .postAndReturnBytes(
                    BASE_URL + "/job/" + jobWithEmptyContact.getJobId() + "/pdf",
                    createCompleteLabelsMap(),
                    200,
                    MediaType.APPLICATION_PDF
                );

            assertValidPdf(result);
        }

        @ParameterizedTest
        @MethodSource("jobLanguageProvider")
        void exportJobToPDFLanguageSelection(String enDescription, String deDescription, String requestedLang, String expectedSubstring) {
            Job jobToTest = JobTestData.savedAll(
                jobRepository,
                "Lang Test Job",
                "AI",
                SubjectArea.COMPUTER_SCIENCE,
                professor,
                group,
                Campus.GARCHING,
                LocalDate.now(),
                LocalDate.now(),
                20,
                3,
                FundingType.FULLY_FUNDED,
                TvlGrade.E13,
                enDescription,
                deDescription,
                JobState.PUBLISHED
            );

            Map<String, String> labels = createCompleteLabelsMap();
            if (requestedLang != null) {
                labels.put("lang", requestedLang);
            }

            byte[] pdf = api
                .withoutPostProcessors()
                .postAndReturnBytes(BASE_URL + "/job/" + jobToTest.getJobId() + "/pdf", labels, 200, MediaType.APPLICATION_PDF);

            assertValidPdf(pdf);
            String text = extractTextFromPdf(pdf);
            assertThat(text).contains(expectedSubstring);
        }

        static Stream<Arguments> jobLanguageProvider() {
            return Stream.of(
                // both present -> select en
                Arguments.of("EN unique-en-xyz", "DE unique-de-xyz", "en", "unique-en-xyz"),
                // both present -> select de
                Arguments.of("EN unique-en-xyz", "DE unique-de-xyz", "de", "unique-de-xyz"),
                // only EN present -> requested DE should fallback to EN
                Arguments.of("EN only unique-en-only", null, "de", "unique-en-only"),
                // only DE present -> requested EN should fallback to DE
                Arguments.of(null, "DE only unique-de-only", "en", "unique-de-only"),
                // de whitespace with en present -> fallback to en
                Arguments.of("EN fallback unique-en-ws", "   ", "de", "unique-en-ws"),
                // both empty -> '-'
                Arguments.of("", "", null, "-"),
                // none present -> expect '-'
                Arguments.of(null, null, null, "-")
            );
        }
    }

    @Nested
    class ExportJobPreviewToPDF {

        @Test
        void exportJobPreviewToPDFReturnsPdfForProfessor() {
            JobFormDTO jobFormDTO = new JobFormDTO(
                UUID.randomUUID(),
                "Software Engineer",
                "AI Research",
                SubjectArea.COMPUTER_SCIENCE,
                professor.getUserId(),
                Campus.GARCHING,
                null,
                null,
                20,
                null,
                null,
                null,
                0,
                null,
                "Job Description",
                "Stellenbeschreibung",
                JobState.DRAFT,
                null,
                true,
                false,
                null,
                null
            );
            Map<String, String> labels = createCompleteLabelsMap();
            JobPreviewRequest request = new JobPreviewRequest(jobFormDTO, labels);

            byte[] result = asProfessor(professor).postAndReturnBytes(
                BASE_URL + "/job/preview/pdf",
                request,
                200,
                MediaType.APPLICATION_PDF
            );

            assertValidPdf(result);
        }

        @Test
        void exportJobPreviewToPDFReturns403ForApplicant() {
            JobFormDTO jobFormDTO = JobFormDTO.getFromEntity(job);
            Map<String, String> labels = createCompleteLabelsMap();
            JobPreviewRequest request = new JobPreviewRequest(jobFormDTO, labels);

            Void result = asApplicant(applicant).postAndRead(
                BASE_URL + "/job/preview/pdf",
                request,
                Void.class,
                403,
                MediaType.APPLICATION_PDF
            );

            assertThat(result).isNull();
        }

        @Test
        void exportJobPreviewToPDFReturns401ForUnauthenticatedUser() {
            JobFormDTO jobFormDTO = JobFormDTO.getFromEntity(job);
            JobPreviewRequest request = new JobPreviewRequest(jobFormDTO, createCompleteLabelsMap());

            Void result = api
                .withoutPostProcessors()
                .postAndRead(BASE_URL + "/job/preview/pdf", request, Void.class, 401, MediaType.APPLICATION_PDF);

            assertThat(result).isNull();
        }

        @Test
        void shouldHandleJobPreviewWithoutResearchGroup() {
            User userWithoutRG = UserTestData.createUserWithoutResearchGroup(userRepository, "test@example.com", "Test", "User", "ab12xyz");

            JobFormDTO jobFormDTO = new JobFormDTO(
                UUID.randomUUID(),
                "Test Job",
                "AI",
                SubjectArea.COMPUTER_SCIENCE,
                userWithoutRG.getUserId(),
                Campus.GARCHING,
                LocalDate.now(),
                LocalDate.now(),
                null,
                3,
                FundingType.FULLY_FUNDED,
                TvlGrade.E15,
                1,
                null,
                "Description",
                "Beschreibung",
                JobState.DRAFT,
                null,
                true,
                false,
                null,
                null
            );

            JobPreviewRequest request = new JobPreviewRequest(jobFormDTO, createCompleteLabelsMap());

            byte[] result = api
                .with(JwtPostProcessors.jwtUser(userWithoutRG.getUserId(), "ROLE_PROFESSOR"))
                .postAndReturnBytes(BASE_URL + "/job/preview/pdf", request, 200, MediaType.APPLICATION_PDF);

            assertValidPdf(result);
        }
    }

    @Nested
    class Authorization {

        @Test
        void unauthenticatedReturns401ForApplicationExport() {
            Void result = api
                .withoutPostProcessors()
                .postAndRead(
                    BASE_URL + "/application/" + application.getApplicationId() + "/pdf",
                    Map.of(),
                    Void.class,
                    401,
                    MediaType.APPLICATION_PDF
                );

            assertThat(result).isNull();
        }

        @Test
        void unauthenticatedReturns401ForJobPreviewExport() {
            JobFormDTO jobFormDTO = JobFormDTO.getFromEntity(job);
            JobPreviewRequest request = new JobPreviewRequest(jobFormDTO, Map.of());

            Void result = api
                .withoutPostProcessors()
                .postAndRead(BASE_URL + "/job/preview/pdf", request, Void.class, 401, MediaType.APPLICATION_PDF);

            assertThat(result).isNull();
        }
    }
}
