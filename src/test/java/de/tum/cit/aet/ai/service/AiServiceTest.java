package de.tum.cit.aet.ai.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import de.tum.cit.aet.ai.constants.ComplianceAction;
import de.tum.cit.aet.ai.constants.ComplianceCategory;
import de.tum.cit.aet.ai.domain.ComplianceIssue;
import de.tum.cit.aet.ai.dto.MapComplianceIssuesRequestDTO;
import de.tum.cit.aet.application.service.ApplicationService;
import de.tum.cit.aet.core.documents.service.DocumentService;
import de.tum.cit.aet.core.dto.GenderBiasAnalysisResponse;
import de.tum.cit.aet.core.exception.InternalServerException;
import de.tum.cit.aet.core.service.CurrentUserService;
import de.tum.cit.aet.core.service.GenderBiasAnalysisService;
import de.tum.cit.aet.job.constants.Campus;
import de.tum.cit.aet.job.constants.JobState;
import de.tum.cit.aet.job.constants.RecommendationType;
import de.tum.cit.aet.job.constants.SubjectArea;
import de.tum.cit.aet.job.dto.JobFormDTO;
import de.tum.cit.aet.job.service.JobService;
import java.util.List;
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
    private ComplianceScoreService complianceScoreService;
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
        complianceScoreService = mock(ComplianceScoreService.class);
        aiFeatureToggleService = mock(AiFeatureToggleService.class);
        AiUsageEventService aiUsageEventService = mock(AiUsageEventService.class);

        aiService = new AiService(
            chatClientBuilder,
            jobService,
            applicationService,
            documentService,
            currentUserService,
            genderBiasAnalysisService,
            complianceScoreService,
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
            GenderBiasAnalysisResponse analysis = mock(GenderBiasAnalysisResponse.class);
            List<ComplianceIssue> aiIssues = List.of(createComplianceIssue("issue text", LANG_EN));

            when(aiFeatureToggleService.isAiAvailable()).thenReturn(true);
            when(chatClient.prompt().user(any(Consumer.class)).call().entity(any(ParameterizedTypeReference.class))).thenReturn(aiIssues);
            when(complianceScoreService.calculateGenderScore(analysis, null)).thenReturn(80);
            when(complianceScoreService.calculateLegalScore(any())).thenReturn(100);

            // Act
            List<ComplianceIssue> result = aiService.analyzeJobDescription(
                "Job Title",
                JOB_ID,
                "description text",
                LANG_EN,
                USER_LANG,
                analysis,
                null
            );

            assertThat(result)
                .hasSize(1)
                .first()
                .satisfies(issue -> assertThat(issue.getLanguage()).isEqualTo(LANG_EN));

            // Verify: combinedScore = sqrt(80 * 100) = sqrt(8000) ≈ 89
            verify(jobService).updateAiAnalysis(eq(JOB_ID), eq(89), eq(aiIssues), eq(LANG_EN));
            verify(aiFeatureToggleService).recordSuccess();
            verify(aiFeatureToggleService, never()).recordFailure();
        }

        @Test
        void shouldSkipLlmAnalysisAndUseGenderScoreOnlyWhenAiUnavailable() {
            // Arrange
            GenderBiasAnalysisResponse analysis = mock(GenderBiasAnalysisResponse.class);

            when(aiFeatureToggleService.isAiAvailable()).thenReturn(false);
            when(complianceScoreService.calculateGenderScore(analysis, null)).thenReturn(75);
            when(complianceScoreService.calculateLegalScore(List.of())).thenReturn(100);

            List<ComplianceIssue> result = aiService.analyzeJobDescription(
                "Job Title",
                JOB_ID,
                "description text",
                LANG_EN,
                USER_LANG,
                analysis,
                null
            );

            assertThat(result).isEmpty();

            // combinedScore = sqrt(75 * 100) ≈ 87
            verify(jobService).updateAiAnalysis(eq(JOB_ID), eq(87), eq(List.of()), eq(LANG_EN));
            verify(chatClient, never()).prompt();
            verify(aiFeatureToggleService, never()).recordSuccess();
        }

        @Test
        void shouldThrowInternalServerExceptionAndRecordFailureWhenLlmCallFails() {
            // Arrange
            GenderBiasAnalysisResponse analysis = mock(GenderBiasAnalysisResponse.class);

            when(aiFeatureToggleService.isAiAvailable()).thenReturn(true);
            when(chatClient.prompt().user(any(Consumer.class)).call().entity(any(ParameterizedTypeReference.class))).thenThrow(
                new RuntimeException("LLM error")
            );

            assertThatThrownBy(() ->
                aiService.analyzeJobDescription("Job Title", JOB_ID, "description text", LANG_EN, USER_LANG, analysis, null)
            )
                .isInstanceOf(InternalServerException.class)
                .hasMessageContaining("Compliance analysis parsing failed");

            verify(aiFeatureToggleService).recordFailure();
            verify(jobService, never()).updateAiAnalysis(any(UUID.class), anyInt(), anyList(), anyString());
        }

        @Test
        void shouldHandleNullTitleGracefully() {
            // Arrange
            GenderBiasAnalysisResponse analysis = mock(GenderBiasAnalysisResponse.class);
            when(aiFeatureToggleService.isAiAvailable()).thenReturn(true);
            when(chatClient.prompt().user(any(Consumer.class)).call().entity(any(ParameterizedTypeReference.class))).thenReturn(List.of());
            when(complianceScoreService.calculateGenderScore(any(), any())).thenReturn(100);
            when(complianceScoreService.calculateLegalScore(any())).thenReturn(100);

            // Act
            List<ComplianceIssue> result = aiService.analyzeJobDescription(null, JOB_ID, "description", LANG_EN, USER_LANG, analysis, null);

            assertThat(result).isEmpty();
            verify(jobService).updateAiAnalysis(eq(JOB_ID), eq(100), eq(List.of()), eq(LANG_EN));
        }

        @Test
        void shouldCombineGenderAndLegalScoreUsingGeometricMean() {
            GenderBiasAnalysisResponse analysis = mock(GenderBiasAnalysisResponse.class);
            when(aiFeatureToggleService.isAiAvailable()).thenReturn(true);
            when(chatClient.prompt().user(any(Consumer.class)).call().entity(any(ParameterizedTypeReference.class))).thenReturn(List.of());
            when(complianceScoreService.calculateGenderScore(any(), any())).thenReturn(64);
            when(complianceScoreService.calculateLegalScore(any())).thenReturn(36);

            // Act
            aiService.analyzeJobDescription("Title", JOB_ID, "text", LANG_EN, USER_LANG, analysis, null);

            // Assert: geometric mean of 64 and 36 = sqrt(64*36) = sqrt(2304) = 48
            verify(jobService).updateAiAnalysis(eq(JOB_ID), eq(48), eq(List.of()), eq(LANG_EN));
        }
    }

    // ===== ANALYZE CURRENT JOB DESCRIPTION =====
    @Nested
    class AnalyzeCurrentJobDescriptionTests {

        @Test
        void shouldUseGermanDescriptionWhenLanguageIsDe() {
            JobFormDTO jobFormDTO = createJobFormDTO("Title", "<p>English text</p>", "<p>Deutscher Text</p>");
            GenderBiasAnalysisResponse analysis = mock(GenderBiasAnalysisResponse.class);
            when(genderBiasAnalysisService.analyzeText(eq("Deutscher Text"), eq(LANG_DE))).thenReturn(analysis);
            when(aiFeatureToggleService.isAiAvailable()).thenReturn(false);
            when(complianceScoreService.calculateGenderScore(any(), any())).thenReturn(80);
            when(complianceScoreService.calculateLegalScore(any())).thenReturn(100);

            aiService.analyzeCurrentJobDescription(jobFormDTO, LANG_DE, USER_LANG);

            // Assert: gender service called with HTML-stripped German text
            verify(genderBiasAnalysisService).analyzeText(eq("Deutscher Text"), eq(LANG_DE));
        }

        @Test
        void shouldUseEnglishDescriptionWhenLanguageIsEn() {
            // Arrange
            JobFormDTO jobFormDTO = createJobFormDTO("Title", "<p>English text</p>", "<p>Deutscher Text</p>");
            GenderBiasAnalysisResponse analysis = mock(GenderBiasAnalysisResponse.class);
            when(genderBiasAnalysisService.analyzeText(eq("English text"), eq(LANG_EN))).thenReturn(analysis);
            when(aiFeatureToggleService.isAiAvailable()).thenReturn(false);
            when(complianceScoreService.calculateGenderScore(any(), any())).thenReturn(80);
            when(complianceScoreService.calculateLegalScore(any())).thenReturn(100);

            aiService.analyzeCurrentJobDescription(jobFormDTO, LANG_EN, USER_LANG);

            // Assert: gender service called with HTML-stripped English text
            verify(genderBiasAnalysisService).analyzeText(eq("English text"), eq(LANG_EN));
        }

        @Test
        void shouldHandleNullDescriptionGracefully() {
            JobFormDTO jobFormDTO = createJobFormDTO("Title", null, null);
            GenderBiasAnalysisResponse analysis = mock(GenderBiasAnalysisResponse.class);
            when(genderBiasAnalysisService.analyzeText(eq(""), eq(LANG_EN))).thenReturn(analysis);
            when(aiFeatureToggleService.isAiAvailable()).thenReturn(false);
            when(complianceScoreService.calculateGenderScore(any(), any())).thenReturn(100);
            when(complianceScoreService.calculateLegalScore(any())).thenReturn(100);

            aiService.analyzeCurrentJobDescription(jobFormDTO, LANG_EN, USER_LANG);

            verify(genderBiasAnalysisService).analyzeText(eq(""), eq(LANG_EN));
        }
    }

    // ===== MAP COMPLIANCE ISSUES =====
    @Nested
    class MapComplianceIssuesTests {

        @Test
        void shouldReturnEmptyAndClearTargetIssuesWhenSourceIssuesEmpty() {
            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO(LANG_DE, JOB_ID, "translated text", List.of());

            // Act
            List<ComplianceIssue> result = aiService.mapComplianceIssues(request);

            assertThat(result).isEmpty();
            verify(jobService).updateComplianceIssues(JOB_ID, List.of(), LANG_DE);
            verifyNoMoreInteractions(jobService);
            verify(chatClient, never()).prompt();
        }

        @Test
        void shouldMapIssuesAndPersistWhenAiIsAvailable() {
            ComplianceIssue source = createComplianceIssue("source text", LANG_EN);
            List<String> mappedTexts = List.of("Gemappter Text");
            when(chatClient.prompt().user(any(Consumer.class)).call().entity(any(ParameterizedTypeReference.class))).thenReturn(
                mappedTexts
            );

            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO(
                LANG_DE,
                JOB_ID,
                "Der Gemappter Text steht hier.",
                List.of(source)
            );

            List<ComplianceIssue> result = aiService.mapComplianceIssues(request);

            assertThat(result)
                .hasSize(1)
                .first()
                .satisfies(mapped -> {
                    assertThat(mapped.getId()).isEqualTo(source.getId());
                    assertThat(mapped.getCategory()).isEqualTo(source.getCategory());
                    assertThat(mapped.getText()).isEqualTo("Gemappter Text");
                    assertThat(mapped.getArticle()).isEqualTo(source.getArticle());
                    assertThat(mapped.getExplanation()).isEqualTo(source.getExplanation());
                    assertThat(mapped.getAction()).isEqualTo(source.getAction());
                    assertThat(mapped.getLanguage()).isEqualTo(LANG_DE);
                });

            verify(jobService).updateComplianceIssues(eq(JOB_ID), eq(result), eq(LANG_DE));
            verify(aiFeatureToggleService).recordSuccess();
        }

        @Test
        void shouldThrowExceptionAndRecordFailureWhenLlmCallFails() {
            when(chatClient.prompt().user(any(Consumer.class)).call().entity(any(ParameterizedTypeReference.class))).thenThrow(
                new RuntimeException("LLM error")
            );

            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO(
                LANG_DE,
                JOB_ID,
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
            // Source has 2 issues but LLM returns only 1 mapped text
            when(chatClient.prompt().user(any(Consumer.class)).call().entity(any(ParameterizedTypeReference.class))).thenReturn(
                List.of("Nur ein Text")
            );

            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO(
                LANG_DE,
                JOB_ID,
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
            when(chatClient.prompt().user(any(Consumer.class)).call().entity(any(ParameterizedTypeReference.class))).thenReturn(null);

            MapComplianceIssuesRequestDTO request = new MapComplianceIssuesRequestDTO(
                LANG_DE,
                JOB_ID,
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
            null
        );
    }
}
