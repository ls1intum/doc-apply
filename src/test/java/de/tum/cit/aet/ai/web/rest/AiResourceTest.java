package de.tum.cit.aet.ai.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.ai.constants.ComplianceAction;
import de.tum.cit.aet.ai.constants.ComplianceCategory;
import de.tum.cit.aet.ai.domain.ComplianceIssue;
import de.tum.cit.aet.ai.dto.TranslateComplianceDTO;
import de.tum.cit.aet.ai.service.AiFeatureToggleService;
import de.tum.cit.aet.ai.service.AiService;
import de.tum.cit.aet.ai.web.AiResource;
import de.tum.cit.aet.job.constants.Campus;
import de.tum.cit.aet.job.constants.JobState;
import de.tum.cit.aet.job.constants.SubjectArea;
import de.tum.cit.aet.job.dto.JobFormDTO;
import de.tum.cit.aet.utility.MvcTestClient;
import de.tum.cit.aet.utility.security.JwtPostProcessors;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
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
