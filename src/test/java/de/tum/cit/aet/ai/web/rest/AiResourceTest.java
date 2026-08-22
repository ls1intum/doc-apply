package de.tum.cit.aet.ai.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.ai.constants.ComplianceAction;
import de.tum.cit.aet.ai.constants.ComplianceCategory;
import de.tum.cit.aet.ai.domain.ComplianceIssue;
import de.tum.cit.aet.ai.dto.MapComplianceIssuesRequestDTO;
import de.tum.cit.aet.ai.dto.TranslateComplianceDTO;
import de.tum.cit.aet.ai.service.AiFeatureToggleService;
import de.tum.cit.aet.ai.service.AiService;
import de.tum.cit.aet.ai.service.AiUsageEventService;
import de.tum.cit.aet.ai.service.ComplianceScoreService;
import de.tum.cit.aet.ai.web.AiResource;
import de.tum.cit.aet.application.service.ApplicationService;
import de.tum.cit.aet.core.documents.service.DocumentService;
import de.tum.cit.aet.core.service.CurrentUserService;
import de.tum.cit.aet.core.service.GenderBiasAnalysisService;
import de.tum.cit.aet.job.constants.Campus;
import de.tum.cit.aet.job.constants.JobState;
import de.tum.cit.aet.job.constants.SubjectArea;
import de.tum.cit.aet.job.dto.JobFormDTO;
import de.tum.cit.aet.job.service.JobService;
import de.tum.cit.aet.utility.MvcTestClient;
import de.tum.cit.aet.utility.security.JwtPostProcessors;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
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
    private final String MAP_COMPLIANCE_URL = "/api/ai/map-compliance-issues";

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

    // ===== MAP COMPLIANCE ISSUES =====
    @Nested
    class MapComplianceIssuesTests {

        private ChatClient chatClient;
        private JobService jobService;
        private AiFeatureToggleService mappingFeatureToggleService;

        @BeforeEach
        void setUpMappingService() {
            ChatClient.Builder chatClientBuilder = mock(ChatClient.Builder.class);
            chatClient = mock(ChatClient.class, RETURNS_DEEP_STUBS);
            when(chatClientBuilder.build()).thenReturn(chatClient);
            jobService = mock(JobService.class);
            mappingFeatureToggleService = mock(AiFeatureToggleService.class);
            AiService mappingService = new AiService(
                chatClientBuilder,
                jobService,
                mock(ApplicationService.class),
                mock(DocumentService.class),
                mock(CurrentUserService.class),
                mock(GenderBiasAnalysisService.class),
                mock(ComplianceScoreService.class),
                mappingFeatureToggleService,
                mock(AiUsageEventService.class)
            );
            ReflectionTestUtils.setField(aiResource, "aiService", mappingService);
        }

        @Test
        void shouldReturnMappedComplianceIssuesWhenProfessorMapsComplianceIssues() {
            List<ComplianceIssue> sourceIssues = List.of(createComplianceIssue("young and dynamic", "en"));
            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO("de", JOB_ID, "jung und dynamisch", sourceIssues);

            when(
                chatClient
                    .prompt()
                    .user(Mockito.<Consumer<ChatClient.PromptUserSpec>>any())
                    .call()
                    .entity(Mockito.<ParameterizedTypeReference<List<String>>>any())
            ).thenReturn(List.of("jung und dynamisch"));

            List<ComplianceIssue> response = api
                .with(JwtPostProcessors.jwtUser(PROFESSOR_USER_ID, "ROLE_PROFESSOR"))
                .postAndRead(MAP_COMPLIANCE_URL, request, new TypeReference<List<ComplianceIssue>>() {}, 200);

            assertThat(response)
                .hasSize(1)
                .first()
                .satisfies(mapped -> {
                    assertThat(mapped.getId()).isEqualTo(sourceIssues.getFirst().getId());
                    assertThat(mapped.getCategory()).isEqualTo(sourceIssues.getFirst().getCategory());
                    assertThat(mapped.getText()).isEqualTo("jung und dynamisch");
                    assertThat(mapped.getArticle()).isEqualTo(sourceIssues.getFirst().getArticle());
                    assertThat(mapped.getExplanation()).isEqualTo(sourceIssues.getFirst().getExplanation());
                    assertThat(mapped.getAction()).isEqualTo(sourceIssues.getFirst().getAction());
                    assertThat(mapped.getLanguage()).isEqualTo("de");
                });
            verify(jobService).updateComplianceIssues(
                eq(JOB_ID),
                argThat(issues -> issues.size() == 1 && "jung und dynamisch".equals(issues.getFirst().getText())),
                eq("de")
            );
            verify(mappingFeatureToggleService).recordSuccess();
        }

        @Test
        void shouldClearTargetIssuesWithoutCallingTheLlmWhenSourceIssuesAreEmpty() {
            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO("de", JOB_ID, "translated text", List.of());

            List<ComplianceIssue> response = api
                .with(JwtPostProcessors.jwtUser(PROFESSOR_USER_ID, "ROLE_PROFESSOR"))
                .postAndRead(MAP_COMPLIANCE_URL, request, new TypeReference<List<ComplianceIssue>>() {}, 200);

            assertThat(response).isEmpty();
            verify(jobService).updateComplianceIssues(JOB_ID, List.of(), "de");
            verify(chatClient, never()).prompt();
        }

        @Test
        void shouldReturnServerErrorAndRecordFailureWhenTheLlmCallFails() {
            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO(
                "de",
                JOB_ID,
                "translated text",
                List.of(createComplianceIssue("source text", "en"))
            );
            when(
                chatClient
                    .prompt()
                    .user(Mockito.<Consumer<ChatClient.PromptUserSpec>>any())
                    .call()
                    .entity(Mockito.<ParameterizedTypeReference<List<String>>>any())
            ).thenThrow(new RuntimeException("LLM error"));

            api
                .with(JwtPostProcessors.jwtUser(PROFESSOR_USER_ID, "ROLE_PROFESSOR"))
                .postAndRead(MAP_COMPLIANCE_URL, request, Void.class, 500);

            verify(mappingFeatureToggleService).recordFailure();
        }

        @Test
        void shouldReturnServerErrorWhenTheLlmReturnsTheWrongNumberOfSnippets() {
            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO(
                "de",
                JOB_ID,
                "translated text",
                List.of(createComplianceIssue("snippet one", "en"), createComplianceIssue("snippet two", "en"))
            );
            when(
                chatClient
                    .prompt()
                    .user(Mockito.<Consumer<ChatClient.PromptUserSpec>>any())
                    .call()
                    .entity(Mockito.<ParameterizedTypeReference<List<String>>>any())
            ).thenReturn(List.of("Nur ein Text"));

            api
                .with(JwtPostProcessors.jwtUser(PROFESSOR_USER_ID, "ROLE_PROFESSOR"))
                .postAndRead(MAP_COMPLIANCE_URL, request, Void.class, 500);

            verify(jobService, never()).updateComplianceIssues(any(UUID.class), any(), anyString());
        }

        @Test
        void shouldReturnServerErrorWhenTheLlmReturnsNull() {
            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO(
                "de",
                JOB_ID,
                "translated text",
                List.of(createComplianceIssue("source text", "en"))
            );
            when(
                chatClient
                    .prompt()
                    .user(Mockito.<Consumer<ChatClient.PromptUserSpec>>any())
                    .call()
                    .entity(Mockito.<ParameterizedTypeReference<List<String>>>any())
            ).thenReturn(null);

            api
                .with(JwtPostProcessors.jwtUser(PROFESSOR_USER_ID, "ROLE_PROFESSOR"))
                .postAndRead(MAP_COMPLIANCE_URL, request, Void.class, 500);

            verify(jobService, never()).updateComplianceIssues(any(UUID.class), any(), anyString());
        }

        @Test
        void shouldDropMappedSnippetsThatAreNotVerbatimInTheTranslatedText() {
            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO(
                "de",
                JOB_ID,
                "Der tatsächliche übersetzte Text.",
                List.of(createComplianceIssue("source text", "en"))
            );
            when(
                chatClient
                    .prompt()
                    .user(Mockito.<Consumer<ChatClient.PromptUserSpec>>any())
                    .call()
                    .entity(Mockito.<ParameterizedTypeReference<List<String>>>any())
            ).thenReturn(List.of("Erfundener Text"));

            List<ComplianceIssue> response = api
                .with(JwtPostProcessors.jwtUser(PROFESSOR_USER_ID, "ROLE_PROFESSOR"))
                .postAndRead(MAP_COMPLIANCE_URL, request, new TypeReference<List<ComplianceIssue>>() {}, 200);

            assertThat(response).isEmpty();
            verify(jobService).updateComplianceIssues(JOB_ID, List.of(), "de");
        }

        @Test
        void shouldReturnBadRequestWhenMappingRequestIsMissingJobId() {
            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO("de", null, "jung und dynamisch", List.of());

            api
                .with(JwtPostProcessors.jwtUser(PROFESSOR_USER_ID, "ROLE_PROFESSOR"))
                .postAndRead(MAP_COMPLIANCE_URL, request, Void.class, 400);
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
                    null,
                    "en"
                )
            );

            given(aiService.analyzeCurrentJobDescription(any(JobFormDTO.class), anyString(), anyString())).willReturn(expectedIssues);

            List<ComplianceIssue> response = api
                .with(JwtPostProcessors.jwtUser(PROFESSOR_USER_ID, "ROLE_PROFESSOR"))
                .postAndRead(ANALYZE_URL + "?lang=en", createValidJobForm(), new TypeReference<List<ComplianceIssue>>() {}, 200);

            assertThat(response).hasSize(1);
            assertThat(response.getFirst().getCategory()).isEqualTo(ComplianceCategory.CRITICAL_AGG);
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
    }

    private ComplianceIssue createComplianceIssue(String text, String language) {
        return new ComplianceIssue(
            "1",
            ComplianceCategory.CRITICAL_AGG,
            text,
            "§ 1 AGG",
            "Discriminatory sentence",
            ComplianceAction.REPLACE,
            null,
            language
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
            null
        );
    }
}
