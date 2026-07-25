package de.tum.cit.aet.reference;

import static org.assertj.core.api.Assertions.assertThat;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.application.constants.ApplicationState;
import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.application.repository.ApplicationRepository;
import de.tum.cit.aet.core.documents.domain.Document;
import de.tum.cit.aet.core.documents.repository.DocumentRepository;
import de.tum.cit.aet.job.constants.JobState;
import de.tum.cit.aet.job.constants.RecommendationType;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.job.repository.JobRepository;
import de.tum.cit.aet.reference.constants.AcquaintanceDepth;
import de.tum.cit.aet.reference.constants.OverallRecommendation;
import de.tum.cit.aet.reference.constants.PeerRating;
import de.tum.cit.aet.reference.constants.RefereeRelationship;
import de.tum.cit.aet.reference.constants.ReferenceRequestStatus;
import de.tum.cit.aet.reference.domain.ReferenceRequest;
import de.tum.cit.aet.reference.dto.ReferenceLetterUploadContextDTO;
import de.tum.cit.aet.reference.dto.ReferenceRequestDTO;
import de.tum.cit.aet.reference.repository.ReferenceRequestRepository;
import de.tum.cit.aet.usermanagement.domain.Applicant;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.repository.ApplicantRepository;
import de.tum.cit.aet.usermanagement.repository.ResearchGroupRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import de.tum.cit.aet.utility.DatabaseCleaner;
import de.tum.cit.aet.utility.MvcTestClient;
import de.tum.cit.aet.utility.testdata.ApplicantTestData;
import de.tum.cit.aet.utility.testdata.ApplicationTestData;
import de.tum.cit.aet.utility.testdata.JobTestData;
import de.tum.cit.aet.utility.testdata.ReferenceRequestTestData;
import de.tum.cit.aet.utility.testdata.ResearchGroupTestData;
import de.tum.cit.aet.utility.testdata.UserTestData;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import tools.jackson.core.type.TypeReference;

class ReferenceLetterUploadResourceTest extends AbstractResourceTest {

    private static final String CONTEXT_URL = "/api/reference-letters/%s";
    private static final String DECLINE_URL = "/api/reference-letters/%s/decline";

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
    DocumentRepository documentRepository;

    @Autowired
    DatabaseCleaner databaseCleaner;

    @Autowired
    MvcTestClient api;

    private ResearchGroup researchGroup;
    private User professor;
    private Applicant applicant;
    private Job jobWithReferences;
    private Application application;

    @BeforeEach
    void setup() {
        databaseCleaner.clean();
        api.withoutPostProcessors();
        researchGroup = ResearchGroupTestData.saved(researchGroupRepository);
        professor = UserTestData.savedProfessor(userRepository, researchGroup);
        applicant = ApplicantTestData.savedWithNewUser(applicantRepository, userRepository);
        jobWithReferences = JobTestData.saved(
            jobRepository,
            professor,
            researchGroup,
            "Reference Letter Test Position",
            JobState.PUBLISHED,
            LocalDate.of(2026, 9, 1)
        );
        jobWithReferences.setReferenceLettersRequired(1);
        jobWithReferences.setRecommendationType(RecommendationType.LETTER_AND_EVALUATION);
        jobWithReferences = jobRepository.save(jobWithReferences);

        application = ApplicationTestData.saved(applicationRepository, jobWithReferences, applicant, ApplicationState.SENT);
    }

    private ReferenceRequest savedRequestedEntry(String rawToken) {
        ReferenceRequest entry = ReferenceRequestTestData.newReferenceRequest(application, "ada@example.com");
        entry.setTokenHash(hashToken(rawToken));
        entry.setTokenExpiresAt(LocalDateTime.now(ZoneOffset.UTC).plusDays(14));
        entry.setStatus(ReferenceRequestStatus.REQUESTED);
        return referenceRequestRepository.save(entry);
    }

    private void setJobRecommendationType(RecommendationType recommendationType) {
        jobWithReferences.setRecommendationType(recommendationType);
        jobWithReferences = jobRepository.save(jobWithReferences);
    }

    private static String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required", e);
        }
    }

    private static MockMultipartFile pdf(String filename) {
        return new MockMultipartFile("letter", filename, "application/pdf", "%PDF-1.4 test".getBytes(StandardCharsets.UTF_8));
    }

    private static Map<String, String> assessmentParams() {
        Map<String, String> params = new HashMap<>();
        params.put("relationship", "RESEARCH_SUPERVISOR");
        params.put("acquaintanceDuration", "THREE_TO_FIVE_YEARS");
        params.put("acquaintanceDepth", "VERY_WELL");
        params.put("ratingIntellectualAbility", "TOP_FIVE_PERCENT");
        params.put("ratingResearchPotential", "TOP_TEN_PERCENT");
        params.put("ratingMotivation", "TOP_ONE_TO_TWO_PERCENT");
        params.put("ratingCommunication", "TOP_TWENTY_FIVE_PERCENT");
        params.put("ratingLeadership", "TOP_FIFTY_PERCENT");
        params.put("ratingCollaboration", "CANNOT_JUDGE");
        params.put("overallRecommendation", "STRONGLY_RECOMMEND");
        return params;
    }

    @Nested
    class GetContext {

        @Test
        void shouldReturnPrefilledContextForKnownToken() {
            savedRequestedEntry("known-token");

            ReferenceLetterUploadContextDTO context = api.getAndRead(
                String.format(CONTEXT_URL, "known-token"),
                null,
                new TypeReference<>() {},
                200
            );

            assertThat(context.applicantFirstName()).isEqualTo(application.getApplicantFirstName());
            assertThat(context.applicantLastName()).isEqualTo(application.getApplicantLastName());
            assertThat(context.jobTitle()).isEqualTo(jobWithReferences.getTitle());
            assertThat(context.researchGroupName()).isEqualTo(researchGroup.getName());
            assertThat(context.status()).isEqualTo(ReferenceRequestStatus.REQUESTED);
            assertThat(context.confidential()).isTrue();
            assertThat(context.recommendationType()).isEqualTo(RecommendationType.LETTER_AND_EVALUATION);
        }

        @Test
        void shouldExposeConfiguredRecommendationTypeInContext() {
            setJobRecommendationType(RecommendationType.EVALUATION_ONLY);
            savedRequestedEntry("typed-token");

            ReferenceLetterUploadContextDTO context = api.getAndRead(
                String.format(CONTEXT_URL, "typed-token"),
                null,
                new TypeReference<>() {},
                200
            );

            assertThat(context.recommendationType()).isEqualTo(RecommendationType.EVALUATION_ONLY);
        }

        @Test
        void shouldReturn404WhenTokenIsUnknown() {
            api.getAndReturnBytes(String.format(CONTEXT_URL, "no-such-token"), null, 404);
        }
    }

    @Nested
    class UploadLetter {

        @Test
        void shouldStoreLetterWithAssessmentTransitionRequestToSubmitted() {
            savedRequestedEntry("upload-token");

            ReferenceRequestDTO updated = api.multipartPostAndRead(
                String.format(CONTEXT_URL, "upload-token"),
                List.of(pdf("letter.pdf")),
                assessmentParams(),
                new TypeReference<>() {},
                200
            );

            assertThat(updated.status()).isEqualTo(ReferenceRequestStatus.SUBMITTED);
            assertThat(updated.documentId()).isNotNull();
            Document doc = documentRepository.findById(updated.documentId()).orElseThrow();
            assertThat(doc.getUploadedBy()).isEqualTo(null);
            assertThat(updated.relationship()).isEqualTo(RefereeRelationship.RESEARCH_SUPERVISOR);
            assertThat(updated.ratingIntellectualAbility()).isEqualTo(PeerRating.TOP_FIVE_PERCENT);
            assertThat(updated.overallRecommendation()).isEqualTo(OverallRecommendation.STRONGLY_RECOMMEND);

            ReferenceRequest persisted = referenceRequestRepository.findById(updated.referenceRequestId()).orElseThrow();
            assertThat(persisted.getStatus()).isEqualTo(ReferenceRequestStatus.SUBMITTED);
            assertThat(persisted.getDocumentId()).isEqualTo(updated.documentId());
            assertThat(persisted.getRelationship()).isEqualTo(RefereeRelationship.RESEARCH_SUPERVISOR);
            assertThat(persisted.getAcquaintanceDepth()).isEqualTo(AcquaintanceDepth.VERY_WELL);
            assertThat(persisted.getRatingIntellectualAbility()).isEqualTo(PeerRating.TOP_FIVE_PERCENT);
            assertThat(persisted.getRatingCollaboration()).isEqualTo(PeerRating.CANNOT_JUDGE);
            assertThat(persisted.getOverallRecommendation()).isEqualTo(OverallRecommendation.STRONGLY_RECOMMEND);
        }

        @Test
        void shouldReject400WhenAssessmentIsIncomplete() {
            savedRequestedEntry("missing-answers-token");
            Map<String, String> incomplete = assessmentParams();
            incomplete.remove("overallRecommendation");

            api.multipartPostAndRead(
                String.format(CONTEXT_URL, "missing-answers-token"),
                List.of(pdf("letter.pdf")),
                incomplete,
                new TypeReference<>() {},
                400
            );
        }

        @Test
        void shouldStoreLetterWithoutAssessmentWhenJobIsLetterOnly() {
            setJobRecommendationType(RecommendationType.LETTER_ONLY);
            savedRequestedEntry("letter-only-token");

            ReferenceRequestDTO updated = api.multipartPostAndRead(
                String.format(CONTEXT_URL, "letter-only-token"),
                List.of(pdf("letter.pdf")),
                Map.of(),
                new TypeReference<>() {},
                200
            );

            assertThat(updated.status()).isEqualTo(ReferenceRequestStatus.SUBMITTED);
            assertThat(updated.documentId()).isNotNull();

            ReferenceRequest persisted = referenceRequestRepository.findById(updated.referenceRequestId()).orElseThrow();
            assertThat(persisted.getDocumentId()).isNotNull();
            assertThat(persisted.getRelationship()).isNull();
            assertThat(persisted.getOverallRecommendation()).isNull();
        }

        @Test
        void shouldStoreAssessmentWithoutLetterWhenJobIsEvaluationOnly() {
            setJobRecommendationType(RecommendationType.EVALUATION_ONLY);
            savedRequestedEntry("evaluation-only-token");

            ReferenceRequestDTO updated = api.multipartPostAndRead(
                String.format(CONTEXT_URL, "evaluation-only-token"),
                List.of(),
                assessmentParams(),
                new TypeReference<>() {},
                200
            );

            assertThat(updated.status()).isEqualTo(ReferenceRequestStatus.SUBMITTED);
            assertThat(updated.documentId()).isNull();

            ReferenceRequest persisted = referenceRequestRepository.findById(updated.referenceRequestId()).orElseThrow();
            assertThat(persisted.getDocumentId()).isNull();
            assertThat(persisted.getRelationship()).isEqualTo(RefereeRelationship.RESEARCH_SUPERVISOR);
            assertThat(persisted.getOverallRecommendation()).isEqualTo(OverallRecommendation.STRONGLY_RECOMMEND);
        }

        @Test
        void shouldReject400WhenLetterMissingForLetterRequiringJob() {
            savedRequestedEntry("no-letter-token");

            api.multipartPostAndRead(
                String.format(CONTEXT_URL, "no-letter-token"),
                List.of(),
                assessmentParams(),
                new TypeReference<>() {},
                400
            );
        }

        @ParameterizedTest(name = "Should reject 400 when {0}")
        @MethodSource("invalidRequestScenarios")
        void shouldReject400WhenRequestIsInvalid(
            String scenarioName,
            BiConsumer<ReferenceLetterUploadResourceTest, ReferenceRequest> requestSetup
        ) {
            String token = "invalid-token";
            ReferenceRequest entry = savedRequestedEntry(token);

            // Pass explicit outer class instance
            requestSetup.accept(ReferenceLetterUploadResourceTest.this, entry);
            referenceRequestRepository.save(entry);

            api.multipartPostAndRead(
                String.format(CONTEXT_URL, token),
                List.of(pdf("letter.pdf")),
                assessmentParams(),
                new TypeReference<>() {},
                400
            );
        }

        private static Stream<Arguments> invalidRequestScenarios() {
            return Stream.of(
                // Token & Status Checks
                Arguments.of(
                    "token already submitted",
                    (BiConsumer<ReferenceLetterUploadResourceTest, ReferenceRequest>) (_, entry) ->
                        entry.setStatus(ReferenceRequestStatus.SUBMITTED)
                ),
                Arguments.of(
                    "token is expired",
                    (BiConsumer<ReferenceLetterUploadResourceTest, ReferenceRequest>) (_, entry) ->
                        entry.setTokenExpiresAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(1))
                ),
                Arguments.of(
                    "reference was cancelled",
                    (BiConsumer<ReferenceLetterUploadResourceTest, ReferenceRequest>) (_, entry) ->
                        entry.setStatus(ReferenceRequestStatus.CANCELLED)
                ),
                // Recommendation Type Mismatches
                Arguments.of(
                    "invalid payload sent for EVALUATION_ONLY job",
                    (BiConsumer<ReferenceLetterUploadResourceTest, ReferenceRequest>) (test, _) ->
                        test.setJobRecommendationType(RecommendationType.EVALUATION_ONLY)
                ),
                Arguments.of(
                    "invalid payload sent for LETTER_ONLY job",
                    (BiConsumer<ReferenceLetterUploadResourceTest, ReferenceRequest>) (test, _) ->
                        test.setJobRecommendationType(RecommendationType.LETTER_ONLY)
                )
            );
        }
    }

    @Nested
    class DeclineRequest {

        @Test
        void shouldTransitionRequestToDeclined() {
            savedRequestedEntry("decline-token");

            ReferenceRequestDTO updated = api.postAndRead(
                String.format(DECLINE_URL, "decline-token"),
                null,
                ReferenceRequestDTO.class,
                200
            );

            assertThat(updated.status()).isEqualTo(ReferenceRequestStatus.DECLINED);

            ReferenceRequest persisted = referenceRequestRepository.findById(updated.referenceRequestId()).orElseThrow();
            assertThat(persisted.getStatus()).isEqualTo(ReferenceRequestStatus.DECLINED);
        }

        @Test
        void shouldReject400WhenAlreadySubmitted() {
            ReferenceRequest entry = savedRequestedEntry("submitted-token");
            entry.setStatus(ReferenceRequestStatus.SUBMITTED);
            referenceRequestRepository.save(entry);

            api.postAndReturnBytes(String.format(DECLINE_URL, "submitted-token"), null, 400);
        }

        @Test
        void shouldReject400WhenExpired() {
            ReferenceRequest entry = savedRequestedEntry("lapsed-token");
            entry.setTokenExpiresAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(1));
            referenceRequestRepository.save(entry);

            api.postAndReturnBytes(String.format(DECLINE_URL, "lapsed-token"), null, 400);
        }

        @Test
        void shouldReturn404WhenTokenIsUnknown() {
            api.postAndReturnBytes(String.format(DECLINE_URL, "no-such-token"), null, 404);
        }
    }
}
