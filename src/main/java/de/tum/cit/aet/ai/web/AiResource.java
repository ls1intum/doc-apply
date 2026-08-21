package de.tum.cit.aet.ai.web;

import de.tum.cit.aet.ai.domain.ComplianceIssue;
import de.tum.cit.aet.ai.dto.ExtractedApplicationDataDTO;
import de.tum.cit.aet.ai.dto.MapComplianceIssuesRequestDTO;
import de.tum.cit.aet.ai.dto.TranslateComplianceDTO;
import de.tum.cit.aet.ai.service.AiFeatureToggleService;
import de.tum.cit.aet.ai.service.AiService;
import de.tum.cit.aet.core.security.annotations.ApplicantOrAdmin;
import de.tum.cit.aet.core.security.annotations.ProfessorOrEmployeeOrAdmin;
import de.tum.cit.aet.job.dto.JobFormDTO;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Flux;

/**
 * REST controller for AI-related endpoints.
 * Provides endpoints for AI-powered features such as job description generation and translation.
 */
@RestController
@RequestMapping("api/ai/")
@Slf4j
@Profile("!openapi")
public class AiResource {

    private final AiService aiService;
    private final AiFeatureToggleService aiFeatureToggleService;

    public AiResource(AiService aiService, AiFeatureToggleService aiFeatureToggleService) {
        this.aiService = aiService;
        this.aiFeatureToggleService = aiFeatureToggleService;
    }

    /**
     * Generate a job application draft using streaming for faster perceived response time.
     * Returns Server-Sent Events (SSE) that emit content chunks as they are generated.
     * Optionally translates the generated content to the other language after streaming if jobId is provided.
     *
     * @param descriptionLanguage the language for the generated job description ("de" or "en")
     * @param jobForm             the job form data used to build the AI prompt
     * @return a Flux of content chunks streamed as Server-Sent Events, or 503 if AI is unavailable
     */
    @ProfessorOrEmployeeOrAdmin
    @PutMapping(value = "generateJobApplicationDraftStream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<Flux<String>> generateJobApplicationDraftStream(
        @RequestBody JobFormDTO jobForm,
        @RequestParam("lang") String descriptionLanguage
    ) {
        if (!aiFeatureToggleService.isAiAvailable()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        log.info("PUT /api/ai/generateJobApplicationDraftStream - Streaming request received (lang={})", descriptionLanguage);
        return ResponseEntity.ok(aiService.generateJobApplicationDraftStream(jobForm, descriptionLanguage));
    }

    /**
     * Stream-translate a job description text using SSE.
     * Returns Server-Sent Events that emit content chunks as they are generated.
     *
     * @param toLang  the target language for translation ("de" or "en")
     * @param request A DTO containing the text to translate
     * @return a Flux of content chunks streamed as Server-Sent Events, or 503 if AI is unavailable
     */
    @ProfessorOrEmployeeOrAdmin
    @PutMapping(value = "translateJobDescriptionStream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<Flux<String>> translateJobDescriptionStream(
        @RequestParam("toLang") String toLang,
        @Valid @RequestBody TranslateComplianceDTO request
    ) {
        if (!aiFeatureToggleService.isAiAvailable()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        log.info("PUT /api/ai/translateJobDescriptionStream - Streaming translation request received (toLang={})", toLang);
        return ResponseEntity.ok(aiService.translateTextStream(request.text(), toLang));
    }

    /**
     * Maps compliance text snippets from original lang to target lang during stream-translate.
     *
     * @param request A DTO containing the text to translate
     * @return a ResponseEntity of mapped snippets for target compliance analysis
     */
    @ProfessorOrEmployeeOrAdmin
    @PostMapping(value = "map-compliance-issues", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<ComplianceIssue>> mapComplianceIssues(@Valid @RequestBody MapComplianceIssuesRequestDTO request) {
        if (!aiFeatureToggleService.isAiAvailable()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        log.info("POST /api/ai/map-compliance-issues - Compliance snippet-mapping request received (toLang={})", request.toLang());
        return ResponseEntity.ok(aiService.mapComplianceIssues(request));
    }

    /**
     * Extracts applicant data from PDF files using AI and persists the extracted
     * values into the application entity.
     *
     * @param applicationId the ID of the application to update
     * @param docIds        the IDs of the document dictionary entries for the PDFs
     * @param files         the raw PDF files to be processed
     * @param isCv          whether the documents are CVs or certificates
     * @param saveData      whether to persist the extracted data into the application
     * @return a ResponseEntity containing the extracted data
     */
    @ApplicantOrAdmin
    @PutMapping(value = "extractPdfData", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ExtractedApplicationDataDTO> extractPdfData(
        @RequestParam(value = "applicationId", required = false) String applicationId,
        @RequestParam(value = "docIds", required = false) List<String> docIds,
        @RequestPart(value = "files", required = false) List<MultipartFile> files,
        @RequestParam(value = "isCv", defaultValue = "true") boolean isCv,
        @RequestParam(value = "saveData", defaultValue = "false") boolean saveData
    ) {
        if (!aiFeatureToggleService.isAiAvailable()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        int fileCount = files == null ? 0 : files.size();
        log.info(
            "PUT /api/ai/extractPdfData - PDF extraction request received (applicationId={}, docIds={}, fileCount={}, isCV={}, saveData={})",
            applicationId,
            docIds,
            fileCount,
            isCv,
            saveData
        );
        return ResponseEntity.ok(aiService.extractAndPersistPdfData(applicationId, docIds, files, isCv, saveData));
    }

    /**
     * Analyzes the job description in real time for compliance violations
     * and provides corresponding feedback.
     *
     * @param jobForm the job form data used as the basis for the analysis
     * @param descriptionLanguage the language of the job description, `de` or `en`
     * @param userLanguage        the language in which issue explanations should be returned
     * @return a ResponseEntity containing detected compliance findings
     */

    @ProfessorOrEmployeeOrAdmin
    @PostMapping(value = "analyze-job-description", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<ComplianceIssue>> analyzeJobDescriptionForCompliance(
        @RequestBody JobFormDTO jobForm,
        @RequestParam("lang") String descriptionLanguage,
        @RequestParam(defaultValue = "en") String userLanguage
    ) {
        // Service skips LLM calls internally when AI is disabled, rule-based gender bias analysis and score computation remain enabled
        log.info("POST /api/ai/analyzeJobDescription - Compliance analysis request received (toLang={})", descriptionLanguage);
        return ResponseEntity.ok(aiService.analyzeCurrentJobDescription(jobForm, descriptionLanguage, userLanguage));
    }
}
