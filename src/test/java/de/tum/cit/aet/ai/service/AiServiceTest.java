package de.tum.cit.aet.ai.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import de.tum.cit.aet.ai.constants.ComplianceAction;
import de.tum.cit.aet.ai.constants.ComplianceCategory;
import de.tum.cit.aet.ai.domain.BiasedIssue;
import de.tum.cit.aet.ai.domain.ComplianceIssue;
import de.tum.cit.aet.ai.dto.JobAnalysisDTO;
import de.tum.cit.aet.ai.dto.MapComplianceIssuesRequestDTO;
import de.tum.cit.aet.application.service.ApplicationService;
import de.tum.cit.aet.core.constants.GenderCategory;
import de.tum.cit.aet.core.documents.service.DocumentService;
import de.tum.cit.aet.core.exception.InternalServerException;
import de.tum.cit.aet.core.service.CurrentUserService;
import de.tum.cit.aet.job.constants.Campus;
import de.tum.cit.aet.job.constants.JobState;
import de.tum.cit.aet.job.constants.RecommendationType;
import de.tum.cit.aet.job.constants.SubjectArea;
import de.tum.cit.aet.job.dto.JobFormDTO;
import de.tum.cit.aet.job.service.JobService;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.core.ParameterizedTypeReference;

class AiServiceTest {

    private static final UUID JOB_ID = UUID.fromString("00000000-0000-0000-0000-000000000444");
    private static final String LANG_DE = "de";
    private static final String LANG_EN = "en";
    private static final String USER_LANG = "en";

    private JobService jobService;
    private AiFeatureToggleService aiFeatureToggleService;
    private GenderBiasAnalysisService genderBiasAnalysisService;
    private ChatClient chatClient;

    private AiService aiService;

    @BeforeEach
    void setUp() {
        ChatClient.Builder chatClientBuilder = mock(ChatClient.Builder.class);
        chatClient = mock(ChatClient.class, RETURNS_DEEP_STUBS);
        when(chatClientBuilder.build()).thenReturn(chatClient);

        jobService = mock(JobService.class);
        ApplicationService applicationService = mock(ApplicationService.class);
        DocumentService documentService = mock(DocumentService.class);
        CurrentUserService currentUserService = mock(CurrentUserService.class);
        genderBiasAnalysisService = mock(GenderBiasAnalysisService.class);
        aiFeatureToggleService = mock(AiFeatureToggleService.class);
        AiUsageEventService aiUsageEventService = mock(AiUsageEventService.class);

        aiService = new AiService(
            chatClientBuilder,
            jobService,
            applicationService,
            documentService,
            currentUserService,
            genderBiasAnalysisService,
            aiFeatureToggleService,
            aiUsageEventService
        );
    }

    // ===== ANALYZE JOB DESCRIPTION =====
    @Nested
    class AnalyzeJobDescriptionTests {

        @Test
        void shouldRunComplianceAnalysisAndPersistScoreWhenAiIsAvailable() {
            // Arrange
            Set<BiasedIssue> analysis = Set.of(new BiasedIssue(LANG_EN, "supportive", GenderCategory.INCLUSIVE));
            List<ComplianceIssue> aiIssues = List.of(createComplianceIssue("issue text", LANG_EN));
            JobAnalysisDTO persistedAnalysis = new JobAnalysisDTO(89, aiIssues, analysis);

            when(aiFeatureToggleService.isAiAvailable()).thenReturn(true);
            when(chatClient.prompt().user(any(Consumer.class)).call().entity(any(ParameterizedTypeReference.class))).thenReturn(aiIssues);
            when(jobService.updateAiAnalysis(JOB_ID, 80, aiIssues, analysis, LANG_EN)).thenReturn(persistedAnalysis);

            // Act
            JobAnalysisDTO result = aiService.analyzeJobDescription(
                "Job Title",
                JOB_ID,
                "description text",
                LANG_EN,
                USER_LANG,
                analysis,
                80
            );

            assertThat(result.complianceIssues())
                .hasSize(1)
                .first()
                .satisfies(issue -> assertThat(issue.getLanguage()).isEqualTo(LANG_EN));

            verify(jobService).updateAiAnalysis(eq(JOB_ID), eq(80), eq(aiIssues), eq(analysis), eq(LANG_EN));
            verify(aiFeatureToggleService).recordSuccess();
            verify(aiFeatureToggleService, never()).recordFailure();
        }

        @Test
        void shouldSkipLlmAnalysisAndUseGenderScoreOnlyWhenAiUnavailable() {
            // Arrange
            Set<BiasedIssue> analysis = Set.of(new BiasedIssue(LANG_EN, "supportive", GenderCategory.INCLUSIVE));
            JobAnalysisDTO persistedAnalysis = new JobAnalysisDTO(87, List.of(), analysis);

            when(aiFeatureToggleService.isAiAvailable()).thenReturn(false);
            when(jobService.updateAiAnalysis(JOB_ID, 75, List.of(), analysis, LANG_EN)).thenReturn(persistedAnalysis);

            JobAnalysisDTO result = aiService.analyzeJobDescription(
                "Job Title",
                JOB_ID,
                "description text",
                LANG_EN,
                USER_LANG,
                analysis,
                75
            );

            assertThat(result.complianceIssues()).isEmpty();

            verify(jobService).updateAiAnalysis(eq(JOB_ID), eq(75), eq(List.of()), eq(analysis), eq(LANG_EN));
            verify(chatClient, never()).prompt();
            verify(aiFeatureToggleService, never()).recordSuccess();
        }

        @Test
        void shouldThrowInternalServerExceptionAndRecordFailureWhenLlmCallFails() {
            // Arrange
            Set<BiasedIssue> analysis = Set.of(new BiasedIssue(LANG_EN, "supportive", GenderCategory.INCLUSIVE));

            when(aiFeatureToggleService.isAiAvailable()).thenReturn(true);
            when(chatClient.prompt().user(any(Consumer.class)).call().entity(any(ParameterizedTypeReference.class))).thenThrow(
                new RuntimeException("LLM error")
            );

            assertThatThrownBy(() ->
                aiService.analyzeJobDescription("Job Title", JOB_ID, "description text", LANG_EN, USER_LANG, analysis, 80)
            )
                .isInstanceOf(InternalServerException.class)
                .hasMessageContaining("Compliance analysis parsing failed");

            verify(aiFeatureToggleService).recordFailure();
            verify(jobService, never()).updateAiAnalysis(any(UUID.class), any(), anyList(), any(), anyString());
        }

        @Test
        void shouldHandleNullTitleGracefully() {
            // Arrange
            Set<BiasedIssue> analysis = Set.of(new BiasedIssue(LANG_EN, "supportive", GenderCategory.INCLUSIVE));
            JobAnalysisDTO persistedAnalysis = new JobAnalysisDTO(100, List.of(), analysis);
            when(aiFeatureToggleService.isAiAvailable()).thenReturn(true);
            when(chatClient.prompt().user(any(Consumer.class)).call().entity(any(ParameterizedTypeReference.class))).thenReturn(List.of());
            when(jobService.updateAiAnalysis(JOB_ID, 100, List.of(), analysis, LANG_EN)).thenReturn(persistedAnalysis);

            // Act
            JobAnalysisDTO result = aiService.analyzeJobDescription(null, JOB_ID, "description", LANG_EN, USER_LANG, analysis, 100);

            assertThat(result.complianceIssues()).isEmpty();
            verify(jobService).updateAiAnalysis(eq(JOB_ID), eq(100), eq(List.of()), eq(analysis), eq(LANG_EN));
        }
    }

    // ===== ANALYZE CURRENT JOB DESCRIPTION =====
    @Nested
    class AnalyzeCurrentJobDescriptionTests {

        @Test
        void shouldUseGermanDescriptionWhenLanguageIsDe() {
            JobFormDTO jobFormDTO = createJobFormDTO("Title", "<p>English text</p>", "<p>Deutscher Text</p>");
            when(genderBiasAnalysisService.analyzeOccurrences(eq("Deutscher Text"), eq(LANG_DE))).thenReturn(List.of());
            when(genderBiasAnalysisService.analyzeOccurrences(eq("English text"), eq(LANG_EN))).thenReturn(List.of());
            when(aiFeatureToggleService.isAiAvailable()).thenReturn(false);

            aiService.analyzeCurrentJobDescription(jobFormDTO, LANG_DE, USER_LANG);

            // Assert: gender service called with HTML-stripped German text
            verify(genderBiasAnalysisService).analyzeOccurrences(eq("Deutscher Text"), eq(LANG_DE));
        }

        @Test
        void shouldUseEnglishDescriptionWhenLanguageIsEn() {
            // Arrange
            JobFormDTO jobFormDTO = createJobFormDTO("Title", "<p>English text</p>", "<p>Deutscher Text</p>");
            when(genderBiasAnalysisService.analyzeOccurrences(eq("English text"), eq(LANG_EN))).thenReturn(List.of());
            when(genderBiasAnalysisService.analyzeOccurrences(eq("Deutscher Text"), eq(LANG_DE))).thenReturn(List.of());
            when(aiFeatureToggleService.isAiAvailable()).thenReturn(false);

            aiService.analyzeCurrentJobDescription(jobFormDTO, LANG_EN, USER_LANG);

            // Assert: gender service called with HTML-stripped English text
            verify(genderBiasAnalysisService).analyzeOccurrences(eq("English text"), eq(LANG_EN));
        }

        @Test
        void shouldHandleNullDescriptionGracefully() {
            JobFormDTO jobFormDTO = createJobFormDTO("Title", null, null);
            when(aiFeatureToggleService.isAiAvailable()).thenReturn(false);

            aiService.analyzeCurrentJobDescription(jobFormDTO, LANG_EN, USER_LANG);

            verifyNoInteractions(genderBiasAnalysisService);
        }
    }

    // ===== MAP COMPLIANCE ISSUES =====
    @Nested
    class MapComplianceIssuesTests {

        @Test
        void shouldReturnEmptyAndClearTargetIssuesWhenSourceIssuesEmpty() {
            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO(
                LANG_DE,
                JOB_ID,
                "source text",
                "translated text",
                List.of()
            );

            // Act
            List<ComplianceIssue> result = aiService.mapComplianceIssues(request);

            assertThat(result).isEmpty();
            verify(jobService).updateComplianceIssues(JOB_ID, List.of(), LANG_DE);
            verifyNoMoreInteractions(jobService);
            verify(chatClient, never()).prompt();
        }

        @Test
        void shouldReturnEmptyWhenComplianceIssuesIsNull() {
            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO(
                LANG_DE,
                JOB_ID,
                "source text",
                "translated text",
                null
            );

            List<ComplianceIssue> result = aiService.mapComplianceIssues(request);

            assertThat(result).isEmpty();
            verifyNoInteractions(jobService);
            verify(chatClient, never()).prompt();
        }

        @Test
        void shouldReturnEmptyWhenTranslatedTextMissing() {
            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO(
                LANG_DE,
                JOB_ID,
                "source text",
                " ",
                List.of(createComplianceIssue("source text", LANG_EN))
            );

            List<ComplianceIssue> result = aiService.mapComplianceIssues(request);

            assertThat(result).isEmpty();
            verify(jobService, never()).updateComplianceIssues(any(UUID.class), any(), anyString());
            verify(chatClient, never()).prompt();
        }

        @Test
        void shouldReturnEmptyWhenTranslatedTextIsNull() {
            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO(
                LANG_DE,
                JOB_ID,
                "source text",
                null,
                List.of(createComplianceIssue("source text", LANG_EN))
            );

            List<ComplianceIssue> result = aiService.mapComplianceIssues(request);

            assertThat(result).isEmpty();
            verify(jobService, never()).updateComplianceIssues(any(UUID.class), any(), anyString());
        }

        @Test
        void shouldReturnEmptyWhenAiUnavailable() {
            when(aiFeatureToggleService.isAiAvailable()).thenReturn(false);

            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO(
                LANG_DE,
                JOB_ID,
                "source text",
                "translated text",
                List.of(createComplianceIssue("source text", LANG_EN))
            );

            List<ComplianceIssue> result = aiService.mapComplianceIssues(request);

            assertThat(result).isEmpty();
            verify(chatClient, never()).prompt();
            verify(jobService, never()).updateComplianceIssues(any(UUID.class), any(), anyString());
        }

        @Test
        void shouldMapIssuesAndPersistWhenAiIsAvailable() {
            List<String> mappedTexts = List.of("Gemappter Text", "Sichere Formulierung");
            when(aiFeatureToggleService.isAiAvailable()).thenReturn(true);
            when(chatClient.prompt().user(any(Consumer.class)).call().entity(any(ParameterizedTypeReference.class))).thenReturn(
                mappedTexts
            );

            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO(
                LANG_DE,
                JOB_ID,
                "source text",
                "translated text",
                List.of(createComplianceIssue("source text", LANG_EN))
            );

            List<ComplianceIssue> result = aiService.mapComplianceIssues(request);

            assertThat(result)
                .hasSize(1)
                .extracting(ComplianceIssue::getText, ComplianceIssue::getSuggestion, ComplianceIssue::getLanguage)
                .containsExactly(tuple("Gemappter Text", "Sichere Formulierung", LANG_DE));

            verify(jobService).updateComplianceIssues(eq(JOB_ID), eq(result), eq(LANG_DE));
            verify(aiFeatureToggleService).recordSuccess();
        }

        @Test
        void shouldIgnoreBlankSnippetsWithoutDiscardingValidMappings() {
            when(aiFeatureToggleService.isAiAvailable()).thenReturn(true);
            when(chatClient.prompt().user(any(Consumer.class)).call().entity(any(ParameterizedTypeReference.class))).thenReturn(
                List.of("jungen, dynamischen", "erfahrenen, vielfältigen")
            );
            ComplianceIssue validIssue = createComplianceIssue("young, dynamic", LANG_EN);
            ComplianceIssue blankIssue = createComplianceIssue("", LANG_EN);

            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO(
                LANG_DE,
                JOB_ID,
                "young, dynamic candidate",
                "jungen, dynamischen Kandidaten",
                List.of(validIssue, blankIssue)
            );

            List<ComplianceIssue> result = aiService.mapComplianceIssues(request);

            assertThat(result)
                .hasSize(1)
                .extracting(ComplianceIssue::getText, ComplianceIssue::getLanguage)
                .containsExactly(tuple("jungen, dynamischen", LANG_DE));
            verify(jobService).updateComplianceIssues(JOB_ID, result, LANG_DE);
        }

        @Test
        void shouldPreserveOriginalMetadataWhenMapping() {
            ComplianceIssue source = createComplianceIssue("source text", LANG_EN);
            when(aiFeatureToggleService.isAiAvailable()).thenReturn(true);
            when(chatClient.prompt().user(any(Consumer.class)).call().entity(any(ParameterizedTypeReference.class))).thenReturn(
                List.of("Gemappter Text", "Sichere Formulierung")
            );

            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO(
                LANG_DE,
                JOB_ID,
                "source text",
                "translated text",
                List.of(source)
            );

            List<ComplianceIssue> result = aiService.mapComplianceIssues(request);

            // Assert: category, article, explanation, action preserved
            assertThat(result)
                .hasSize(1)
                .first()
                .satisfies(mapped -> {
                    assertThat(mapped.getCategory()).isEqualTo(source.getCategory());
                    assertThat(mapped.getArticle()).isEqualTo(source.getArticle());
                    assertThat(mapped.getExplanation()).isEqualTo(source.getExplanation());
                    assertThat(mapped.getAction()).isEqualTo(source.getAction());
                    assertThat(mapped.getText()).isEqualTo("Gemappter Text");
                    assertThat(mapped.getSuggestion()).isEqualTo("Sichere Formulierung");
                    assertThat(mapped.getLanguage()).isEqualTo(LANG_DE);
                });
        }

        @Test
        void shouldThrowExceptionAndRecordFailureWhenLlmCallFails() {
            when(aiFeatureToggleService.isAiAvailable()).thenReturn(true);
            when(chatClient.prompt().user(any(Consumer.class)).call().entity(any(ParameterizedTypeReference.class))).thenThrow(
                new RuntimeException("LLM error")
            );

            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO(
                LANG_DE,
                JOB_ID,
                "source text",
                "translated text",
                List.of(createComplianceIssue("source text", LANG_EN))
            );

            assertThatThrownBy(() -> aiService.mapComplianceIssues(request))
                .isInstanceOf(InternalServerException.class)
                .hasMessageContaining("Compliance issue mapping failed");

            verify(aiFeatureToggleService).recordFailure();
            verify(jobService, never()).updateComplianceIssues(any(UUID.class), any(), anyString());
        }

        @Test
        void shouldThrowExceptionWhenMappingReturnsWrongNumberOfSnippets() {
            when(aiFeatureToggleService.isAiAvailable()).thenReturn(true);
            // Source has 2 issues but LLM returns only 1 mapped text
            when(chatClient.prompt().user(any(Consumer.class)).call().entity(any(ParameterizedTypeReference.class))).thenReturn(
                List.of("Nur ein Text")
            );

            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO(
                LANG_DE,
                JOB_ID,
                "source text",
                "translated text",
                List.of(createComplianceIssue("source 1", LANG_EN), createComplianceIssue("source 2", LANG_EN))
            );
            assertThatThrownBy(() -> aiService.mapComplianceIssues(request))
                .isInstanceOf(InternalServerException.class)
                .hasMessageContaining("invalid number of snippets");

            verify(aiFeatureToggleService).recordFailure();
            verify(jobService, never()).updateComplianceIssues(any(UUID.class), any(), anyString());
        }

        @Test
        void shouldThrowExceptionWhenMappingReturnsNull() {
            when(aiFeatureToggleService.isAiAvailable()).thenReturn(true);
            when(chatClient.prompt().user(any(Consumer.class)).call().entity(any(ParameterizedTypeReference.class))).thenReturn(null);

            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO(
                LANG_DE,
                JOB_ID,
                "source text",
                "translated text",
                List.of(createComplianceIssue("source text", LANG_EN))
            );

            assertThatThrownBy(() -> aiService.mapComplianceIssues(request))
                .isInstanceOf(InternalServerException.class)
                .hasMessageContaining("invalid number of snippets");

            verify(aiFeatureToggleService).recordFailure();
        }
    }

    // ===== HELPER METHODS =====

    /**
     * Creates a ComplianceIssue with default test values.
     *
     * @param text     the snippet text identifying the issue location in the description
     * @param language the language code ("de" or "en") tagged onto the issue
     * @return a new ComplianceIssue with CRITICAL_AGG category and REPLACE action
     */
    private ComplianceIssue createComplianceIssue(String text, String language) {
        return new ComplianceIssue(
            "1",
            ComplianceCategory.CRITICAL_AGG,
            text,
            "§ 1 AGG",
            "Discriminatory sentence",
            ComplianceAction.REPLACE,
            "safe wording",
            language
        );
    }

    /**
     * Creates a JobFormDTO for testing.
     *
     * @param title         the job title
     * @param descriptionEN the English job description (HTML allowed, may be null)
     * @param descriptionDE the German job description (HTML allowed, may be null)
     * @return a JobFormDTO with the given fields set and other fields holding default test values
     */
    private JobFormDTO createJobFormDTO(String title, String descriptionEN, String descriptionDE) {
        return new JobFormDTO(
            JOB_ID,
            title,
            "AI",
            SubjectArea.COMPUTER_SCIENCE,
            null,
            Campus.MUNICH,
            null,
            null,
            null,
            null,
            null,
            null,
            0,
            (RecommendationType) null,
            descriptionEN,
            descriptionDE,
            JobState.DRAFT,
            null,
            true,
            false,
            null,
            null,
            null
        );
    }
}
