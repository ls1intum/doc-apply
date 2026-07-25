package de.tum.cit.aet.core.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.application.constants.ApplicationState;
import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.application.repository.ApplicationRepository;
import de.tum.cit.aet.core.constants.DataExportState;
import de.tum.cit.aet.core.constants.DocumentType;
import de.tum.cit.aet.core.documents.domain.ApplicantDocument;
import de.tum.cit.aet.core.documents.domain.ApplicationDocument;
import de.tum.cit.aet.core.documents.repository.DocumentRepository;
import de.tum.cit.aet.core.domain.DataExportRequest;
import de.tum.cit.aet.core.domain.export.ExportedUserData;
import de.tum.cit.aet.core.domain.export.UserDataExportProviderType;
import de.tum.cit.aet.core.dto.DataExportStatusDTO;
import de.tum.cit.aet.core.repository.DataExportRequestRepository;
import de.tum.cit.aet.core.service.UserDataExportService;
import de.tum.cit.aet.job.constants.JobState;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.job.repository.JobRepository;
import de.tum.cit.aet.notification.service.AsyncEmailSender;
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
import de.tum.cit.aet.utility.testdata.DocumentTestData;
import de.tum.cit.aet.utility.testdata.JobTestData;
import de.tum.cit.aet.utility.testdata.ResearchGroupTestData;
import de.tum.cit.aet.utility.testdata.UserTestData;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration tests for {@link UserDataExportResource}.
 */
public class UserDataExportResourceTest extends AbstractResourceTest {

    private static final String STATUS_URL = "/api/users/data-export/status";
    private static final String REQUEST_URL = "/api/users/data-export";
    private static final String DOWNLOAD_URL = "/api/users/data-export/download/%s";
    private static final String ENTITY_BASE_PACKAGE = "de.tum.cit.aet";

    @Autowired
    UserRepository userRepository;

    @Autowired
    DataExportRequestRepository dataExportRequestRepository;

    @Autowired
    ApplicantRepository applicantRepository;

    @Autowired
    ApplicationRepository applicationRepository;

    @Autowired
    DocumentRepository documentRepository;

    @Autowired
    ResearchGroupRepository researchGroupRepository;

    @Autowired
    JobRepository jobRepository;

    @Autowired
    UserDataExportService userDataExportService;

    @Autowired
    DatabaseCleaner databaseCleaner;

    @Autowired
    MvcTestClient api;

    @Value("${aet.storage.root}")
    private String storageRootConfig;

    @Value("${aet.data-export.root}")
    private String exportRootConfig;

    @BeforeEach
    void setup() {
        databaseCleaner.clean();
        api.withoutPostProcessors();
        AsyncEmailSender asyncEmailSenderMock = mock(AsyncEmailSender.class);
        ReflectionTestUtils.setField(userDataExportService, "sender", asyncEmailSenderMock);
        cleanExportRoot();
    }

    // ===== STATUS ENDPOINT =====
    @Nested
    class StatusTests {

        @Test
        void statusRequiresAuthentication() {
            api.getAndReturnBytes(STATUS_URL, Map.of(), 401, MediaType.ALL);
        }

        @Test
        void statusReflectsCooldownAndLatestRequest() {
            User user = savedUser("status-user@tum.de");

            LocalDateTime lastRequested = LocalDateTime.now(ZoneOffset.UTC).minusDays(1);
            DataExportRequest request = new DataExportRequest();
            request.setUser(user);
            request.setStatus(DataExportState.REQUESTED);
            request.setLastRequestedAt(lastRequested);
            DataExportRequest savedRequest = dataExportRequestRepository.saveAndFlush(request);
            DataExportRequest reloadedRequest = dataExportRequestRepository.findById(savedRequest.getExportRequestId()).orElseThrow();

            DataExportStatusDTO status = api
                .with(JwtPostProcessors.jwtUser(user.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(STATUS_URL, Map.of(), DataExportStatusDTO.class, 200, MediaType.APPLICATION_JSON);

            assertThat(status.status()).isEqualTo(DataExportState.REQUESTED);
            assertThat(status.lastRequestedAt()).isEqualTo(reloadedRequest.getLastRequestedAt());
            assertThat(status.nextAllowedAt()).isEqualTo(reloadedRequest.getLastRequestedAt().plusDays(7));
            assertThat(status.cooldownSeconds()).isGreaterThan(0);
        }
    }

    // ===== REQUEST EXPORT =====
    @Nested
    class RequestExportTests {

        @Test
        void requestRequiresAuthentication() {
            api.postAndRead(REQUEST_URL, Map.of(), Void.class, 401, MediaType.ALL);
        }

        @Test
        void requestCreatesPendingExport() {
            User user = savedUser("request-user@tum.de");

            api
                .with(JwtPostProcessors.jwtUser(user.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead(REQUEST_URL, Map.of(), Void.class, 202, MediaType.APPLICATION_JSON);

            DataExportRequest latest = dataExportRequestRepository.findTop1ByUserUserIdOrderByCreatedAtDesc(user.getUserId()).orElseThrow();

            assertThat(latest.getStatus()).isEqualTo(DataExportState.REQUESTED);
            assertThat(latest.getLastRequestedAt()).isNotNull();
        }

        @Test
        void requestRejectsWhenActiveExists() {
            User user = savedUser("active-request@tum.de");

            DataExportRequest request = new DataExportRequest();
            request.setUser(user);
            request.setStatus(DataExportState.REQUESTED);
            request.setLastRequestedAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(8));
            dataExportRequestRepository.saveAndFlush(request);

            api
                .with(JwtPostProcessors.jwtUser(user.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead(REQUEST_URL, Map.of(), Void.class, 409, MediaType.APPLICATION_JSON);
        }

        @Test
        void requestRejectsWhenRateLimited() {
            User user = savedUser("rate-limit@tum.de");

            DataExportRequest request = new DataExportRequest();
            request.setUser(user);
            request.setStatus(DataExportState.DOWNLOADED);
            request.setLastRequestedAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(2));
            dataExportRequestRepository.saveAndFlush(request);

            api
                .with(JwtPostProcessors.jwtUser(user.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead(REQUEST_URL, Map.of(), Void.class, 429, MediaType.APPLICATION_JSON);
        }
    }

    // ===== EXPORT PROCESSING =====
    @Nested
    class ExportProcessingTests {

        @Test
        void pendingExportIsProcessedAndZipCreated() throws Exception {
            User user = savedUser("process-export@tum.de");

            DataExportRequest request = new DataExportRequest();
            request.setUser(user);
            request.setStatus(DataExportState.REQUESTED);
            request.setLastRequestedAt(LocalDateTime.now(ZoneOffset.UTC));
            request = dataExportRequestRepository.saveAndFlush(request);

            userDataExportService.processPendingDataExports();

            DataExportRequest updated = dataExportRequestRepository.findById(request.getExportRequestId()).orElseThrow();
            assertThat(updated.getStatus()).isEqualTo(DataExportState.EMAIL_SENT);
            assertThat(updated.getFilePath()).startsWith(exportRootConfig);
            assertThat(updated.getDownloadToken()).matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");

            Path zipPath = Path.of(updated.getFilePath());
            assertThat(Files.exists(zipPath)).isTrue();

            Set<String> entries = readZipEntries(zipPath);
            assertThat(entries).contains("data/profile.csv", "README_DATA_EXPORT_DE.txt", "README_DATA_EXPORT_EN.txt");

            String readmeDe = readZipEntryAsString(zipPath, "README_DATA_EXPORT_DE.txt");
            assertThat(readmeDe).contains("data/profile.csv").contains("Datenexport");

            String readmeEn = readZipEntryAsString(zipPath, "README_DATA_EXPORT_EN.txt");
            assertThat(readmeEn).contains("data/profile.csv").contains("Data Export");
        }

        @Test
        void exportIncludesUploadedDocumentsWithPdfExtension() throws Exception {
            User user = savedUser("documents-user@tum.de");
            ApplicantTestData.attachApplicantRole(user);
            user = userRepository.saveAndFlush(user);
            Applicant applicant = ApplicantTestData.savedWithExistingUser(applicantRepository, user);

            ApplicantDocument document = DocumentTestData.savedApplicantDocument(
                storageRootConfig,
                documentRepository,
                user,
                applicant,
                DocumentType.CV,
                "/testdocs/test-doc1.pdf",
                "export-test-doc1.pdf"
            );

            DataExportRequest request = new DataExportRequest();
            request.setUser(user);
            request.setStatus(DataExportState.REQUESTED);
            request.setLastRequestedAt(LocalDateTime.now(ZoneOffset.UTC));
            request = dataExportRequestRepository.saveAndFlush(request);

            userDataExportService.processPendingDataExports();

            DataExportRequest updated = dataExportRequestRepository.findById(request.getExportRequestId()).orElseThrow();
            Set<String> entries = readZipEntries(Path.of(updated.getFilePath()));

            String expectedEntry = "documents/uploaded/" + document.getDocumentId() + ".pdf";
            assertThat(entries).contains(expectedEntry);
        }

        @Test
        void exportIncludesNonConfidentialReferenceLetter() throws Exception {
            User user = savedUser("ref-letter-user@tum.de");
            ApplicantTestData.attachApplicantRole(user);
            user = userRepository.saveAndFlush(user);
            Applicant applicant = ApplicantTestData.savedWithExistingUser(applicantRepository, user);

            ApplicationDocument letter = savedReferenceLetter(applicant, false, "non-confidential-letter.pdf");

            Set<String> entries = runExportFor(user);

            assertThat(entries).contains("documents/uploaded/" + letter.getDocumentId() + ".pdf");
        }

        @Test
        void exportExcludesConfidentialReferenceLetter() throws Exception {
            User user = savedUser("confidential-ref-user@tum.de");
            ApplicantTestData.attachApplicantRole(user);
            user = userRepository.saveAndFlush(user);
            Applicant applicant = ApplicantTestData.savedWithExistingUser(applicantRepository, user);

            ApplicationDocument letter = savedReferenceLetter(applicant, true, "confidential-letter.pdf");

            Set<String> entries = runExportFor(user);

            assertThat(entries).doesNotContain("documents/uploaded/" + letter.getDocumentId() + ".pdf");
        }

        @Test
        @Transactional
        void exportIncludesApplicantDataWhenApplicantRoleExists() throws Exception {
            User user = savedUser("applicant-export@tum.de");
            ApplicantTestData.attachApplicantRole(user);
            user = userRepository.saveAndFlush(user);

            Applicant applicant = new Applicant();
            applicant.setUser(user);
            applicant.setStreet("Teststr. 1");
            applicant.setPostalCode("12345");
            applicant.setCity("Munich");
            applicant.setCountry("de");
            applicantRepository.saveAndFlush(applicant);

            Path zipPath = processExportAndGetZipPath(user);
            String profileCsv = readZipEntryAsString(zipPath, "data/profile.csv");
            String applicantProfileCsv = readZipEntryAsString(zipPath, "data/applicant_profile.csv");
            Set<String> entries = readZipEntries(zipPath);

            assertThat(profileCsv).contains("email").contains("applicant-export@tum.de");
            assertThat(applicantProfileCsv).contains("city").contains("Munich");
            assertThat(entries).doesNotContain("data/staff_supervised_jobs.csv");
        }

        @Test
        void exportIncludesStaffDataWhenStaffRoleExists() throws Exception {
            ResearchGroup researchGroup = ResearchGroupTestData.saved(researchGroupRepository);
            User user = UserTestData.savedProfessor(userRepository, researchGroup);
            JobTestData.saved(jobRepository, user, researchGroup, "Staff Export Job", JobState.DRAFT, LocalDate.now());

            Path zipPath = processExportAndGetZipPath(user);
            String profileCsv = readZipEntryAsString(zipPath, "data/profile.csv");
            String supervisedJobsCsv = readZipEntryAsString(zipPath, "data/staff_supervised_jobs.csv");
            Set<String> entries = readZipEntries(zipPath);

            assertThat(profileCsv).contains("email").contains(user.getEmail());
            assertThat(supervisedJobsCsv).contains("job_title").contains("Staff Export Job");
            assertThat(entries).doesNotContain("data/applicant_profile.csv");
        }
    }

    // ===== DOWNLOAD EXPORT =====
    @Nested
    class DownloadExportTests {

        @Test
        void downloadRequiresAuthenticationAndUpdatesStatus() {
            User user = savedUser("download-user@tum.de");

            DataExportRequest request = new DataExportRequest();
            request.setUser(user);
            request.setStatus(DataExportState.REQUESTED);
            request.setLastRequestedAt(LocalDateTime.now(ZoneOffset.UTC));
            request = dataExportRequestRepository.saveAndFlush(request);

            userDataExportService.processPendingDataExports();

            DataExportRequest ready = dataExportRequestRepository.findById(request.getExportRequestId()).orElseThrow();
            String url = String.format(DOWNLOAD_URL, ready.getDownloadToken());

            MockHttpServletResponse response = api
                .with(JwtPostProcessors.jwtUser(user.getUserId(), "ROLE_PROFESSOR"))
                .getAndReturnResponse(url, Map.of(), 200, MediaType.valueOf("application/zip"));

            assertThat(response.getContentType()).isEqualTo("application/zip");
            assertThat(response.getHeader("Content-Disposition")).isNotNull().contains("attachment");

            DataExportRequest downloaded = dataExportRequestRepository.findById(request.getExportRequestId()).orElseThrow();
            assertThat(downloaded.getStatus()).isEqualTo(DataExportState.DOWNLOADED);
        }

        @Test
        void downloadRejectsInvalidToken() {
            User user = savedUser("invalid-token@tum.de");
            String url = String.format(DOWNLOAD_URL, UUID.randomUUID());
            api.with(JwtPostProcessors.jwtUser(user.getUserId(), "ROLE_PROFESSOR")).getAndReturnBytes(url, Map.of(), 404, MediaType.ALL);
        }

        @Test
        void downloadRejectsExpiredToken() {
            User user = savedUser("expired-token@tum.de");

            DataExportRequest request = new DataExportRequest();
            request.setUser(user);
            request.setStatus(DataExportState.EMAIL_SENT);
            request.setDownloadToken(UUID.randomUUID().toString());
            request.setExpiresAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(1));
            request.setFilePath("/tmp/nonexistent.zip");
            dataExportRequestRepository.saveAndFlush(request);

            String url = String.format(DOWNLOAD_URL, request.getDownloadToken());
            api.with(JwtPostProcessors.jwtUser(user.getUserId(), "ROLE_PROFESSOR")).getAndReturnBytes(url, Map.of(), 409, MediaType.ALL);
        }

        @Test
        void downloadRejectsNotReadyStatus() {
            User user = savedUser("not-ready@tum.de");

            DataExportRequest request = new DataExportRequest();
            request.setUser(user);
            request.setStatus(DataExportState.REQUESTED);
            request.setDownloadToken(UUID.randomUUID().toString());
            request.setExpiresAt(LocalDateTime.now(ZoneOffset.UTC).plusDays(1));
            request.setFilePath("/tmp/nonexistent.zip");
            dataExportRequestRepository.saveAndFlush(request);

            String url = String.format(DOWNLOAD_URL, request.getDownloadToken());
            api.with(JwtPostProcessors.jwtUser(user.getUserId(), "ROLE_PROFESSOR")).getAndReturnBytes(url, Map.of(), 409, MediaType.ALL);
        }

        @Test
        void downloadRejectsMissingFile() {
            User user = savedUser("missing-file@tum.de");

            DataExportRequest request = new DataExportRequest();
            request.setUser(user);
            request.setStatus(DataExportState.EMAIL_SENT);
            request.setDownloadToken(UUID.randomUUID().toString());
            request.setExpiresAt(LocalDateTime.now(ZoneOffset.UTC).plusDays(1));
            request.setFilePath("/tmp/does-not-exist.zip");
            dataExportRequestRepository.saveAndFlush(request);

            String url = String.format(DOWNLOAD_URL, request.getDownloadToken());
            api.with(JwtPostProcessors.jwtUser(user.getUserId(), "ROLE_PROFESSOR")).getAndReturnBytes(url, Map.of(), 500, MediaType.ALL);
        }
    }

    // ===== ENTITY ANNOTATION COVERAGE =====
    @Nested
    class EntityAnnotationCoverageTests {

        @Test
        void annotatedEntitiesMustHaveRuntimeCsvCoverage() throws Exception {
            Set<String> settingsEntries = readZipEntries(processExportAndGetZipPath(savedUser("settings-coverage@tum.de")));

            Applicant applicant = ApplicantTestData.savedWithNewUser(applicantRepository, userRepository);
            User applicantUser = applicant.getUser();
            Set<String> applicantEntries = readZipEntries(processExportAndGetZipPath(applicantUser));

            ResearchGroup researchGroup = ResearchGroupTestData.saved(researchGroupRepository);
            User staffUser = UserTestData.savedProfessor(userRepository, researchGroup);
            staffUser = userRepository.findById(staffUser.getUserId()).orElseThrow();
            JobTestData.saved(jobRepository, staffUser, researchGroup, "Coverage Job", JobState.DRAFT, LocalDate.now());
            Set<String> staffEntries = readZipEntries(processExportAndGetZipPath(staffUser));

            Map<UserDataExportProviderType, Set<String>> entriesByProviderType = new EnumMap<>(UserDataExportProviderType.class);
            entriesByProviderType.put(UserDataExportProviderType.USER_SETTINGS, settingsEntries);
            entriesByProviderType.put(UserDataExportProviderType.APPLICANT, applicantEntries);
            entriesByProviderType.put(UserDataExportProviderType.STAFF, staffEntries);

            Map<String, String> expectedCsvEntryByEntity = expectedCsvEntryByEntityClassName();
            List<Class<?>> annotatedEntities = findExportAnnotatedEntities();

            Set<String> discoveredClassNames = annotatedEntities.stream().map(Class::getName).collect(Collectors.toSet());
            assertThat(expectedCsvEntryByEntity.keySet())
                .as("Every @ExportedUserData entity must have an explicit runtime CSV coverage mapping")
                .isEqualTo(discoveredClassNames);

            for (Class<?> entityClass : annotatedEntities) {
                ExportedUserData annotation = entityClass.getAnnotation(ExportedUserData.class);
                assertThat(annotation).isNotNull();

                String csvEntry = expectedCsvEntryByEntity.get(entityClass.getName());
                Set<String> entries = entriesByProviderType.get(annotation.by());

                assertThat(entries).as("Missing runtime export archive for provider type %s", annotation.by()).isNotNull();
                assertThat(entries)
                    .as("Expected CSV entry '%s' for entity %s to exist in export archive", csvEntry, entityClass.getName())
                    .contains(csvEntry);
            }
        }
    }

    // ---------------- Helper methods for test setup and assertions ----------------

    private Map<String, String> expectedCsvEntryByEntityClassName() {
        Map<String, String> pathByEntity = new HashMap<>();
        pathByEntity.put("de.tum.cit.aet.usermanagement.domain.User", "data/profile.csv");
        pathByEntity.put("de.tum.cit.aet.usermanagement.domain.UserSetting", "data/user_settings.csv");
        pathByEntity.put("de.tum.cit.aet.notification.domain.EmailSetting", "data/email_settings.csv");

        pathByEntity.put("de.tum.cit.aet.usermanagement.domain.Applicant", "data/applicant_profile.csv");
        pathByEntity.put("de.tum.cit.aet.application.domain.Application", "data/applicant_applications.csv");
        pathByEntity.put("de.tum.cit.aet.interview.domain.Interviewee", "data/applicant_interviewees.csv");
        pathByEntity.put("de.tum.cit.aet.reference.domain.ReferenceRequest", "data/applicant_reference_requests.csv");

        pathByEntity.put("de.tum.cit.aet.job.domain.Job", "data/staff_supervised_jobs.csv");
        pathByEntity.put("de.tum.cit.aet.usermanagement.domain.UserResearchGroupRole", "data/staff_research_group_roles.csv");
        pathByEntity.put("de.tum.cit.aet.evaluation.domain.ApplicationReview", "data/staff_reviews.csv");
        pathByEntity.put("de.tum.cit.aet.evaluation.domain.InternalComment", "data/staff_comments.csv");
        pathByEntity.put("de.tum.cit.aet.evaluation.domain.Rating", "data/staff_ratings.csv");
        pathByEntity.put("de.tum.cit.aet.interview.domain.InterviewProcess", "data/staff_interview_processes.csv");
        pathByEntity.put("de.tum.cit.aet.interview.domain.InterviewSlot", "data/staff_interview_slots.csv");
        return pathByEntity;
    }

    private List<Class<?>> findExportAnnotatedEntities() {
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(ExportedUserData.class));

        return scanner
            .findCandidateComponents(ENTITY_BASE_PACKAGE)
            .stream()
            .map(BeanDefinition::getBeanClassName)
            .filter(Objects::nonNull)
            .map(this::loadClass)
            .map(clazz -> (Class<?>) clazz)
            .collect(Collectors.toList());
    }

    private Class<?> loadClass(String className) {
        try {
            return Class.forName(className);
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException("Could not load class " + className, e);
        }
    }

    private User savedUser(String email) {
        User user = UserTestData.newUser();
        user.setEmail(email);
        user.setSelectedLanguage("en");
        return userRepository.saveAndFlush(user);
    }

    /**
     * Persists a reference letter document attached to a fresh application owned by the given applicant.
     * The document has no uploader (mirroring a referee upload) and the owning application's confidentiality
     * flag is set as requested.
     *
     * @param applicant    the applicant who owns the application the letter is attached to
     * @param confidential whether the application marks its reference letters confidential
     * @param filename     the on-disk filename inside the storage root
     * @return the persisted reference letter document
     */
    private ApplicationDocument savedReferenceLetter(Applicant applicant, boolean confidential, String filename) throws IOException {
        ResearchGroup researchGroup = ResearchGroupTestData.saved(researchGroupRepository);
        User professor = UserTestData.savedProfessor(userRepository, researchGroup);
        Job job = JobTestData.saved(
            jobRepository,
            professor,
            researchGroup,
            "Reference Letter Export Job",
            JobState.PUBLISHED,
            LocalDate.of(2026, 9, 1)
        );
        Application application = ApplicationTestData.saved(applicationRepository, job, applicant, ApplicationState.SENT);
        application.setReferenceLettersConfidential(confidential);
        application = applicationRepository.saveAndFlush(application);

        return DocumentTestData.savedApplicationDocument(
            storageRootConfig,
            documentRepository,
            null,
            application,
            DocumentType.REFERENCE_LETTER,
            "/testdocs/test-doc1.pdf",
            filename
        );
    }

    private Set<String> runExportFor(User user) throws Exception {
        DataExportRequest request = new DataExportRequest();
        request.setUser(user);
        request.setStatus(DataExportState.REQUESTED);
        request.setLastRequestedAt(LocalDateTime.now(ZoneOffset.UTC));
        request = dataExportRequestRepository.saveAndFlush(request);

        userDataExportService.processPendingDataExports();

        DataExportRequest updated = dataExportRequestRepository.findById(request.getExportRequestId()).orElseThrow();
        return readZipEntries(Path.of(updated.getFilePath()));
    }

    private void cleanExportRoot() {
        Path root = Path.of(exportRootConfig).toAbsolutePath().normalize();
        if (Files.exists(root)) {
            try (Stream<Path> stream = Files.walk(root)) {
                stream
                    .sorted(Comparator.reverseOrder())
                    .forEach(path -> {
                        try {
                            Files.deleteIfExists(path);
                        } catch (Exception ignored) {
                            // best-effort cleanup
                        }
                    });
            } catch (Exception ignored) {
                // best-effort cleanup
            }
        }
        try {
            Files.createDirectories(root);
        } catch (Exception ignored) {
            // best-effort cleanup
        }
    }

    private Set<String> readZipEntries(Path zipPath) throws Exception {
        Set<String> entries = new HashSet<>();
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(Files.readAllBytes(zipPath)))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                entries.add(entry.getName());
                zis.closeEntry();
            }
        }
        return entries;
    }

    private Path processExportAndGetZipPath(User user) {
        User managedUser = userRepository.findById(user.getUserId()).orElseThrow();

        DataExportRequest request = new DataExportRequest();
        request.setUser(managedUser);
        request.setStatus(DataExportState.REQUESTED);
        request.setLastRequestedAt(LocalDateTime.now(ZoneOffset.UTC));
        request = dataExportRequestRepository.saveAndFlush(request);

        userDataExportService.processPendingDataExports();

        DataExportRequest updated = dataExportRequestRepository.findById(request.getExportRequestId()).orElseThrow();
        return Path.of(updated.getFilePath());
    }

    private String readZipEntryAsString(Path zipPath, String entryName) throws Exception {
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(Files.readAllBytes(zipPath)))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if (entryName.equals(entry.getName())) {
                    byte[] payload = zis.readAllBytes();
                    return new String(payload, StandardCharsets.UTF_8);
                }
                zis.closeEntry();
            }
        }
        throw new IllegalStateException("Zip entry not found: " + entryName);
    }
}
