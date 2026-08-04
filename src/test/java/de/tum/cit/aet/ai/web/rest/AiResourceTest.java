package de.tum.cit.aet.ai.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.ai.constants.ComplianceAction;
import de.tum.cit.aet.ai.constants.ComplianceCategory;
import de.tum.cit.aet.ai.domain.BiasedIssue;
import de.tum.cit.aet.ai.domain.ComplianceIssue;
import de.tum.cit.aet.ai.dto.TranslateComplianceDTO;
import de.tum.cit.aet.ai.dto.JobAnalysisDTO;
import de.tum.cit.aet.ai.service.AiFeatureToggleService;
import de.tum.cit.aet.ai.service.AiService;
import de.tum.cit.aet.ai.service.AiUsageEventService;
import de.tum.cit.aet.ai.service.GenderBiasAnalysisService;
import de.tum.cit.aet.ai.web.AiResource;
import de.tum.cit.aet.application.service.ApplicationService;
import de.tum.cit.aet.core.constants.GenderCategory;
import de.tum.cit.aet.core.documents.service.DocumentService;
import de.tum.cit.aet.core.service.CurrentUserService;
import de.tum.cit.aet.core.service.GenderBiasAnalyzer;
import de.tum.cit.aet.job.constants.Campus;
import de.tum.cit.aet.job.constants.JobState;
import de.tum.cit.aet.job.constants.SubjectArea;
import de.tum.cit.aet.job.dto.JobFormDTO;
import de.tum.cit.aet.job.service.JobService;
import de.tum.cit.aet.utility.MvcTestClient;
import de.tum.cit.aet.utility.security.JwtPostProcessors;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import reactor.core.publisher.Flux;
import tools.jackson.core.type.TypeReference;

class AiResourceTest extends AbstractResourceTest {

    private static final UUID PROFESSOR_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000111");
    private static final UUID APPLICANT_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000222");
    private static final UUID SUPERVISING_PROFESSOR_ID = UUID.fromString("00000000-0000-0000-0000-000000000333");
    private static final UUID JOB_ID = UUID.fromString("00000000-0000-0000-0000-000000000444");

    @Autowired
    private MvcTestClient api;

    @Autowired
    private AiResource aiResource;

    @Autowired
    private AiFeatureToggleService aiFeatureToggleService;

    private AiService aiService;

    private final String TRANSLATE_STREAM_URL = "/api/ai/translateJobDescriptionStream";
    private final String ANALYZE_URL = "/api/ai/analyze-job-description";

    private final String input = "Hello World";

    @BeforeEach
    void setUp() {
        aiService = Mockito.mock(AiService.class);
        ReflectionTestUtils.setField(aiResource, "aiService", aiService);
        aiFeatureToggleService.setEnabled(true);
        aiFeatureToggleService.resetCircuitBreaker();
    }

    // ===== TRANSLATE JOB DESCRIPTION STREAM =====
    @Nested
    class TranslateJobDescriptionStreamTests {

        @Test
        void shouldReturnStreamWhenProfessorTranslatesJobDescription() {
            String toLang = "de";
            TranslateComplianceDTO request = new TranslateComplianceDTO(input, null);

            given(aiService.translateTextStream(anyString(), anyString())).willReturn(Flux.just("Hallo", " Welt"));

            String url = TRANSLATE_STREAM_URL + "?toLang=" + toLang;
            api
                .with(JwtPostProcessors.jwtUser(PROFESSOR_USER_ID, "ROLE_PROFESSOR"))
                .putAndRead(url, request, Void.class, 200, MediaType.TEXT_EVENT_STREAM);
        }

        @Test
        void shouldReturnForbiddenWhenApplicantTranslatesJobDescription() {
            String url = TRANSLATE_STREAM_URL + "?toLang=de";
            TranslateComplianceDTO request = new TranslateComplianceDTO(input, null);
            api
                .with(JwtPostProcessors.jwtUser(APPLICANT_USER_ID, "ROLE_APPLICANT"))
                .putAndRead(url, request, Void.class, 403, MediaType.TEXT_EVENT_STREAM);
        }

        @Test
        void shouldReturnUnauthorizedWhenTranslateJobDescriptionWithoutAuthentication() {
            String url = TRANSLATE_STREAM_URL + "?toLang=de";
            TranslateComplianceDTO request = new TranslateComplianceDTO(input, null);
            api.withoutPostProcessors().putAndRead(url, request, Void.class, 401, MediaType.TEXT_EVENT_STREAM);
        }
    }

    // ===== ANALYZE JOB DESCRIPTION =====
    @Nested
    class AnalyzeJobDescriptionTests {

        @Test
        void shouldReturnComplianceIssuesWhenProfessorAnalyzesJobDescription() {
            List<ComplianceIssue> expectedIssues = List.of(
                new ComplianceIssue(
                    "1",
                    ComplianceCategory.CRITICAL_AGG,
                    "I don't allow disabled applicants",
                    "§ 1 AGG",
                    "Discriminatory sentence",
                    ComplianceAction.REPLACE,
                    "en"
                )
            );

            given(aiService.analyzeCurrentJobDescription(any(JobFormDTO.class), anyString(), anyString()))
                .willReturn(new JobAnalysisDTO(0, expectedIssues, Set.of()));

            JobAnalysisDTO response = api
                .with(JwtPostProcessors.jwtUser(PROFESSOR_USER_ID, "ROLE_PROFESSOR"))
                .postAndRead(ANALYZE_URL + "?lang=en", createValidJobForm(), JobAnalysisDTO.class, 200);

            assertThat(response.complianceIssues()).hasSize(1);
            assertThat(response.complianceIssues().getFirst().getCategory()).isEqualTo(ComplianceCategory.CRITICAL_AGG);
        }

        @Test
        void shouldReturnForbiddenWhenApplicantAnalyzesJobDescription() {
            api
                .with(JwtPostProcessors.jwtUser(APPLICANT_USER_ID, "ROLE_APPLICANT"))
                .postAndRead(ANALYZE_URL + "?lang=en", createValidJobForm(), Void.class, 403);
        }

        @Test
        void shouldReturnUnauthorizedWhenAnalyzeJobDescriptionWithoutAuthentication() {
            api.withoutPostProcessors().postAndRead(ANALYZE_URL + "?lang=en", createValidJobForm(), Void.class, 401);
        }

        @ParameterizedTest(name = "{0}")
        @MethodSource("de.tum.cit.aet.ai.web.rest.AiResourceTest#genderBiasAnalysisCases")
        void shouldAnalyzeGenderBiasThroughResourceWhenAiIsUnavailable(
            String label,
            String language,
            String description,
            int expectedGenderScore,
            List<ExpectedBiasedIssue> expectedIssues
        ) {
            assertGenderBiasAnalysisThroughResource(language, description, expectedGenderScore, expectedIssues);
        }

        @Test
        void shouldClearPersistedAnalysisWhenDescriptionIsBlank() {
            JobService jobService = Mockito.mock(JobService.class);
            given(jobService.updateAiAnalysis(JOB_ID, null, List.of(), Set.of(), "en"))
                .willReturn(new JobAnalysisDTO(null, List.of(), Set.of()));
            ReflectionTestUtils.setField(aiResource, "aiService", createRuleBasedAiService(jobService));

            api
                .with(JwtPostProcessors.jwtUser(PROFESSOR_USER_ID, "ROLE_PROFESSOR"))
                .postAndRead(ANALYZE_URL + "?lang=en", createJobForm("", "en"), JobAnalysisDTO.class, 200);

            Mockito.verify(jobService).updateAiAnalysis(JOB_ID, null, List.of(), Set.of(), "en");
        }

        @Test
        void shouldKeepScoreFromOtherLanguageWhenCurrentDescriptionIsBlank() {
            JobService jobService = Mockito.mock(JobService.class);
            given(jobService.updateAiAnalysis(JOB_ID, 100, List.of(), Set.of(), "en"))
                .willReturn(new JobAnalysisDTO(100, List.of(), Set.of()));
            ReflectionTestUtils.setField(aiResource, "aiService", createRuleBasedAiService(jobService));

            api
                .with(JwtPostProcessors.jwtUser(PROFESSOR_USER_ID, "ROLE_PROFESSOR"))
                .postAndRead(ANALYZE_URL + "?lang=en", createBilingualJobForm("", "kooperative"), JobAnalysisDTO.class, 200);

            Mockito.verify(jobService).updateAiAnalysis(JOB_ID, 100, List.of(), Set.of(), "en");
        }
    }

    private void assertGenderBiasAnalysisThroughResource(
        String language,
        String description,
        int expectedGenderScore,
        List<ExpectedBiasedIssue> expectedIssues
    ) {
        JobService jobService = Mockito.mock(JobService.class);
        given(jobService.updateAiAnalysis(Mockito.eq(JOB_ID), Mockito.anyInt(), Mockito.anyList(), Mockito.anySet(), Mockito.eq(language)))
            .willReturn(new JobAnalysisDTO(expectedGenderScore, List.of(), Set.of()));
        ReflectionTestUtils.setField(aiResource, "aiService", createRuleBasedAiService(jobService));

        JobAnalysisDTO response = api
            .with(JwtPostProcessors.jwtUser(PROFESSOR_USER_ID, "ROLE_PROFESSOR"))
            .postAndRead(
                ANALYZE_URL + "?lang=" + language,
                createJobForm(description, language),
                JobAnalysisDTO.class,
                200
            );

        assertThat(response.complianceIssues()).isNullOrEmpty();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ComplianceIssue>> complianceIssuesCaptor = ArgumentCaptor.forClass(List.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Set<BiasedIssue>> biasedIssuesCaptor = ArgumentCaptor.forClass(Set.class);

        Mockito.verify(jobService).updateAiAnalysis(
            Mockito.eq(JOB_ID),
            Mockito.eq(expectedGenderScore),
            complianceIssuesCaptor.capture(),
            biasedIssuesCaptor.capture(),
            Mockito.eq(language)
        );

        Set<BiasedIssue> biasedIssues = biasedIssuesCaptor.getValue();
        assertThat(complianceIssuesCaptor.getValue()).isEmpty();
        assertThat(biasedIssues).allSatisfy(issue -> assertThat(issue.getLanguage()).isEqualTo(language));
        assertThat(biasedIssues)
            .extracting(BiasedIssue::getWord, BiasedIssue::getType)
            .containsExactlyInAnyOrderElementsOf(
                expectedIssues
                    .stream()
                    .map(issue -> tuple(issue.word(), issue.type()))
                    .toList()
            );
    }

    private AiService createRuleBasedAiService(JobService jobService) {
        ChatClient.Builder chatClientBuilder = Mockito.mock(ChatClient.Builder.class);
        given(chatClientBuilder.build()).willReturn(Mockito.mock(ChatClient.class));

        AiFeatureToggleService disabledAiFeatureToggleService = Mockito.mock(AiFeatureToggleService.class);
        given(disabledAiFeatureToggleService.isAiAvailable()).willReturn(false);

        return new AiService(
            chatClientBuilder,
            jobService,
            Mockito.mock(ApplicationService.class),
            Mockito.mock(DocumentService.class),
            Mockito.mock(CurrentUserService.class),
            new GenderBiasAnalysisService(new GenderBiasAnalyzer()),
            disabledAiFeatureToggleService,
            Mockito.mock(AiUsageEventService.class)
        );
    }

    private JobFormDTO createValidJobForm() {
        return new JobFormDTO(
            JOB_ID,
            "Research Assistant",
            "AI",
            SubjectArea.COMPUTER_SCIENCE,
            SUPERVISING_PROFESSOR_ID,
            Campus.MUNICH,
            null,
            null,
            null,
            null,
            null,
            null,
            0,
            null,
            "I don't allow disabled applicants",
            "Ich erlaube keine Bewerber mit Behinderung",
            JobState.DRAFT,
            null,
            true,
            false,
            null,
            null,
            null
        );
    }

    private JobFormDTO createJobForm(String description, String language) {
        return createBilingualJobForm("en".equals(language) ? description : null, "de".equals(language) ? description : null);
    }

    private JobFormDTO createBilingualJobForm(String englishDescription, String germanDescription) {
        return new JobFormDTO(
            JOB_ID,
            "Research Assistant",
            "AI",
            SubjectArea.COMPUTER_SCIENCE,
            SUPERVISING_PROFESSOR_ID,
            Campus.MUNICH,
            null,
            null,
            null,
            null,
            null,
            null,
            0,
            null,
            englishDescription,
            germanDescription,
            JobState.DRAFT,
            null,
            true,
            false,
            null,
            null,
            null
        );
    }

    private record ExpectedBiasedIssue(String word, GenderCategory type) {}

    static Stream<Arguments> genderBiasAnalysisCases() {
        return Stream.of(
            Arguments.of(
                "English gender bias analysis",
                "en",
                "<p>We need a <strong>leader</strong>, another leader, and a supportive person.</p>",
                41,
                List.of(
                    new ExpectedBiasedIssue("leader", GenderCategory.NON_INCLUSIVE),
                    new ExpectedBiasedIssue("supportive", GenderCategory.INCLUSIVE)
                )
            ),
            Arguments.of(
                "German gender bias analysis",
                "de",
                "<p>Wir suchen eine durchsetzungsfähige und kooperative Person.</p>",
                71,
                List.of(
                    new ExpectedBiasedIssue("durchsetzungsfähige", GenderCategory.NON_INCLUSIVE),
                    new ExpectedBiasedIssue("kooperative", GenderCategory.INCLUSIVE)
                )
            )
        );
    }
}
