package de.tum.cit.aet.ai.service;

import static de.tum.cit.aet.core.constants.GenderBiasWordLists.*;

import de.tum.cit.aet.ai.constants.AiUsageFeature;
import de.tum.cit.aet.ai.domain.ComplianceIssue;
import de.tum.cit.aet.ai.dto.ExtractedApplicationDataDTO;
import de.tum.cit.aet.ai.dto.ExtractedCertificateDataDTO;
import de.tum.cit.aet.application.service.ApplicationService;
import de.tum.cit.aet.core.documents.service.DocumentService;
import de.tum.cit.aet.core.dto.GenderBiasAnalysisResponse;
import de.tum.cit.aet.core.exception.BadRequestException;
import de.tum.cit.aet.core.exception.InternalServerException;
import de.tum.cit.aet.core.exception.PDFExtractionException;
import de.tum.cit.aet.core.service.CurrentUserService;
import de.tum.cit.aet.core.service.GenderBiasAnalysisService;
import de.tum.cit.aet.core.util.CountryCodeNormalizer;
import de.tum.cit.aet.core.util.DateNormalizer;
import de.tum.cit.aet.job.dto.JobFormDTO;
import de.tum.cit.aet.job.service.JobService;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import javax.imageio.ImageIO;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.jsoup.Jsoup;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.ResponseEntity;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@Service
@Slf4j
public class AiService {

    // Document & page limit for AI extraction
    private static final int MAX_DOCS = 5;
    private static final int MAX_PAGES_PER_DOC = 5;

    // Upper bound for a single blocking extraction call to the AI provider
    private static final Duration EXTRACTION_AI_CALL_TIMEOUT = Duration.ofSeconds(60);

    @Value("classpath:prompts/JobDescriptionGeneration.st")
    private Resource jobGenerationResource;

    @Value("classpath:prompts/TranslateText.st")
    private Resource translationResource;

    @Value("classpath:prompts/ExtractCvData.st")
    private Resource cVExtractionResource;

    @Value("classpath:prompts/ExtractCertificateData.st")
    private Resource certificateExtractionResource;

    @Value("classpath:prompts/AnalyzeComplianceText.st")
    private Resource complianceResource;

    private final ChatClient chatClient;

    private final JobService jobService;

    private final ApplicationService applicationService;

    private final DocumentService documentService;

    private final CurrentUserService currentUserService;

    private final GenderBiasAnalysisService genderBiasAnalysisService;

    private final ComplianceScoreService complianceScoreService;

    private final AiFeatureToggleService aiFeatureToggleService;

    private final AiUsageEventService aiUsageEventService;

    public AiService(
        ChatClient.Builder chatClientBuilder,
        JobService jobService,
        ApplicationService applicationService,
        DocumentService documentService,
        CurrentUserService currentUserService,
        GenderBiasAnalysisService genderBiasAnalysisService,
        ComplianceScoreService complianceScoreService,
        AiFeatureToggleService aiFeatureToggleService,
        AiUsageEventService aiUsageEventService
    ) {
        this.chatClient = chatClientBuilder.build();
        this.jobService = jobService;
        this.applicationService = applicationService;
        this.documentService = documentService;
        this.currentUserService = currentUserService;
        this.genderBiasAnalysisService = genderBiasAnalysisService;
        this.complianceScoreService = complianceScoreService;
        this.aiFeatureToggleService = aiFeatureToggleService;
        this.aiUsageEventService = aiUsageEventService;
    }

    /**
     * Token usage captured from a chat response, used for cost analytics. Fields may be {@code null}
     * when the provider does not report usage (e.g. some streaming models).
     */
    private record AiUsageMetrics(Integer inputTokens, Integer outputTokens) {
        private static final AiUsageMetrics EMPTY = new AiUsageMetrics(null, null);

        /**
         * Extracts token usage from a chat response.
         *
         * @param response the chat response, possibly {@code null}
         * @return the captured metrics, or {@link #EMPTY} when no usage is available
         */
        static AiUsageMetrics from(ChatResponse response) {
            Usage usage = response != null ? response.getMetadata().getUsage() : null;
            if (usage == null) {
                return EMPTY;
            }
            return new AiUsageMetrics(usage.getPromptTokens(), usage.getCompletionTokens());
        }
    }

    /**
     * Records a usage event for the analytics dashboard without ever disrupting the AI feature
     * itself: any persistence failure is swallowed and logged.
     *
     * @param feature the AI feature that was triggered
     * @param success whether the underlying AI call completed successfully
     * @param userId  the triggering user, or {@code null} if it could not be resolved
     * @param metrics token usage captured from the AI response
     */
    private void recordAiUsageSafely(AiUsageFeature feature, boolean success, UUID userId, AiUsageMetrics metrics) {
        try {
            aiUsageEventService.record(feature, success, userId, metrics.inputTokens(), metrics.outputTokens());
        } catch (Exception e) {
            log.warn("Failed to record AI usage event for feature {}", feature, e);
        }
    }

    /**
     * Wires token-usage capture and analytics recording onto a streaming chat response, exposing only
     * the generated text chunks to the caller. Usage typically arrives in the final streamed chunk, so
     * the last response carrying token counts is retained and recorded on completion (or on error).
     *
     * @param responses the streamed chat responses
     * @param feature   the AI feature being recorded
     * @param userId    the triggering user, captured on the request thread; may be {@code null}
     * @return a Flux of generated text chunks
     */
    private Flux<String> recordAndStream(Flux<ChatResponse> responses, AiUsageFeature feature, UUID userId) {
        AtomicReference<ChatResponse> usageResponse = new AtomicReference<>();
        return responses
            .doOnNext(response -> {
                Usage usage = response.getMetadata().getUsage();
                if (usage.getTotalTokens() > 0) {
                    usageResponse.set(response);
                }
            })
            .mapNotNull(response -> response.getResult() != null ? response.getResult().getOutput().getText() : null)
            .doOnComplete(() -> {
                aiFeatureToggleService.recordSuccess();
                recordAiUsageSafely(feature, true, userId, AiUsageMetrics.from(usageResponse.get()));
            })
            .doOnError(_ -> {
                aiFeatureToggleService.recordFailure();
                recordAiUsageSafely(feature, false, userId, AiUsageMetrics.from(usageResponse.get()));
            })
            .delayElements(Duration.ofMillis(35));
    }

    /**
     * Generates a job application draft using streaming for faster perceived response time.
     * Returns a Flux that emits content chunks as they are generated.
     * After streaming completes, automatically translates the content to the other language.
     *
     * @param jobFormDTO          the job form data containing description, requirements, and tasks
     * @param descriptionLanguage the language for the generated job description ("de" or "en")
     * @return Flux of content chunks as they are generated
     */
    public Flux<String> generateJobApplicationDraftStream(JobFormDTO jobFormDTO, String descriptionLanguage) {
        // Resolve the triggering user on the request thread; the stream hooks below run on reactor
        // threads where the request-scoped security context is no longer available.
        UUID triggeredBy = currentUserService.getUserIdIfAvailable().orElse(null);

        String input = "de".equals(descriptionLanguage) ? jobFormDTO.jobDescriptionDE() : jobFormDTO.jobDescriptionEN();

        Set<String> inclusive = "de".equals(descriptionLanguage) ? GERMAN_INCLUSIVE : ENGLISH_INCLUSIVE;
        Set<String> nonInclusive = "de".equals(descriptionLanguage) ? GERMAN_NON_INCLUSIVE : ENGLISH_NON_INCLUSIVE;
        final String locationText = jobFormDTO.location() != null ? jobFormDTO.location().correctLanguageValue(descriptionLanguage) : "";

        Flux<ChatResponse> responses = chatClient
            .prompt()
            .user(u ->
                u
                    .text(jobGenerationResource)
                    .param("descriptionLanguage", descriptionLanguage)
                    .param("jobDescription", input)
                    .param("title", jobFormDTO.title() != null ? jobFormDTO.title() : "")
                    .param("researchArea", jobFormDTO.researchArea() != null ? jobFormDTO.researchArea() : "")
                    .param(
                        "subjectArea",
                        jobFormDTO.subjectArea() != null ? jobFormDTO.subjectArea().correctLanguageValue(descriptionLanguage) : ""
                    )
                    .param("location", locationText)
                    .param("inclusiveWords", String.join(", ", inclusive))
                    .param("nonInclusiveWords", String.join(", ", nonInclusive))
            )
            .stream()
            .chatResponse();

        return recordAndStream(responses, AiUsageFeature.JOB_DESCRIPTION_GENERATION, triggeredBy);
    }

    /**
     * Streams the translation of a job description text using SSE.
     * Returns a Flux that emits content chunks as they are generated.
     *
     * @param text   the text to translate
     * @param toLang the target language ("de" or "en")
     * @return Flux of content chunks as they are generated
     */
    public Flux<String> translateTextStream(String text, String toLang) {
        // Resolve the triggering user on the request thread; the stream hooks run on reactor threads.
        UUID triggeredBy = currentUserService.getUserIdIfAvailable().orElse(null);

        Set<String> inclusive = "de".equals(toLang) ? GERMAN_INCLUSIVE : ENGLISH_INCLUSIVE;
        Set<String> nonInclusive = "de".equals(toLang) ? GERMAN_NON_INCLUSIVE : ENGLISH_NON_INCLUSIVE;

        Flux<ChatResponse> responses = chatClient
            .prompt()
            .user(u ->
                u
                    .text(translationResource)
                    .param("text", text)
                    .param("targetLanguage", toLang)
                    .param("inclusiveWords", String.join(", ", inclusive))
                    .param("nonInclusiveWords", String.join(", ", nonInclusive))
            )
            .stream()
            .chatResponse();

        return recordAndStream(responses, AiUsageFeature.TRANSLATION, triggeredBy);
    }

    /**
     * Extracts applicant data from the provided PDF files by converting them to images
     * first, since the Azure OpenAI endpoint only accepts image inputs.
     * 1) Load the PDFs and render each page as a PNG image
     * 2) Send the images to the LLM with the extraction prompt
     *
     * @param pdfFiles the PDF file resources to be analyzed
     * @return the extracted data as a structured DTO
     */
    private ExtractedApplicationDataDTO extractPdfData(List<Resource> pdfFiles, boolean isCv) {
        UUID triggeredBy = currentUserService.getUserIdIfAvailable().orElse(null);
        List<ByteArrayResource> pageImages = new ArrayList<>();

        Resource prompt = isCv ? cVExtractionResource : certificateExtractionResource;
        Class<?> targetClass = isCv ? ExtractedApplicationDataDTO.class : ExtractedCertificateDataDTO.class;

        try {
            int docsToProcess = Math.min(pdfFiles.size(), MAX_DOCS);
            for (int i = 0; i < docsToProcess; i++) {
                Resource pdfFile = pdfFiles.get(i);
                try (PDDocument document = Loader.loadPDF(pdfFile.getContentAsByteArray())) {
                    // 1) Render each PDF page as a PNG image
                    PDFRenderer pdfRenderer = new PDFRenderer(document);
                    int pagesToProcess = Math.min(document.getNumberOfPages(), MAX_PAGES_PER_DOC);

                    for (int j = 0; j < pagesToProcess; j++) {
                        BufferedImage image = pdfRenderer.renderImageWithDPI(j, 300);
                        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
                        ImageIO.write(image, "png", byteArrayOutputStream);
                        pageImages.add(new ByteArrayResource(byteArrayOutputStream.toByteArray()));
                    }
                }
            }

            // 2) Send the images to the LLM with the extraction prompt, capturing token usage alongside the result
            Object result;
            try {
                ResponseEntity<ChatResponse, ?> responseEntity = Mono.fromCallable(() ->
                    chatClient
                        .prompt()
                        .user(u -> {
                            u.text(prompt);
                            for (ByteArrayResource pageImage : pageImages) {
                                u.media(MediaType.IMAGE_PNG, pageImage);
                            }
                        })
                        .call()
                        .responseEntity(targetClass)
                )
                    .subscribeOn(Schedulers.boundedElastic())
                    .timeout(EXTRACTION_AI_CALL_TIMEOUT)
                    .block();
                result = responseEntity.entity();
                aiFeatureToggleService.recordSuccess();
                recordAiUsageSafely(AiUsageFeature.DOCUMENT_EXTRACTION, true, triggeredBy, AiUsageMetrics.from(responseEntity.response()));
            } catch (Exception e) {
                aiFeatureToggleService.recordFailure();
                recordAiUsageSafely(AiUsageFeature.DOCUMENT_EXTRACTION, false, triggeredBy, AiUsageMetrics.EMPTY);
                throw e;
            }

            if (isCv) {
                return normalizeStructuredFields((ExtractedApplicationDataDTO) result);
            } else {
                return ExtractedApplicationDataDTO.onlyEducationDTO((ExtractedCertificateDataDTO) result);
            }
        } catch (IOException e) {
            throw new PDFExtractionException("PDF conversion failed", e);
        }
    }

    /**
     * Returns a copy of the given DTO with country, nationality, and dateOfBirth
     * normalized to canonical formats (ISO alpha-2 lowercase / ISO YYYY-MM-DD).
     * Unrecognized values become {@code null} so the frontend dropdown / date
     * picker stays empty rather than displaying garbage.
     */
    private ExtractedApplicationDataDTO normalizeStructuredFields(ExtractedApplicationDataDTO extracted) {
        if (extracted == null) {
            return null;
        }
        return new ExtractedApplicationDataDTO(
            extracted.firstName(),
            extracted.lastName(),
            extracted.phoneNumber(),
            extracted.website(),
            extracted.linkedinUrl(),
            extracted.gender(),
            CountryCodeNormalizer.normalize(extracted.nationality()),
            CountryCodeNormalizer.normalize(extracted.country()),
            DateNormalizer.normalize(extracted.dateOfBirth()),
            extracted.street(),
            extracted.city(),
            extracted.postalCode(),
            extracted.education()
        );
    }

    /**
     * Extracts applicant data from a combination of persisted document UUIDs and uploaded multipart files.
     * Both inputs are optional but at least one must contain documents.
     *
     * @param applicationId the ID of the application to update (only used if saveData is true)
     * @param docIds        list of document UUID strings referencing persisted documents
     * @param files         uploaded multipart PDF files
     * @param isCv          whether the documents are CVs or certificates
     * @param saveData      whether to persist extracted data into the application
     * @return the extracted data as a structured DTO
     */
    public ExtractedApplicationDataDTO extractAndPersistPdfData(
        String applicationId,
        List<String> docIds,
        List<MultipartFile> files,
        boolean isCv,
        boolean saveData
    ) {
        currentUserService.markAiConsentForCurrentUser();

        List<Resource> docs = new ArrayList<>();

        // 1) Download documents from UUIDs if provided
        if (docIds != null) {
            for (String docId : docIds) {
                docs.add(documentService.downloadDocument(UUID.fromString(docId)));
            }
        }

        // 2) Convert multipart files to Resource objects and add to the list if provided
        if (files != null) {
            for (MultipartFile file : files) {
                try {
                    docs.add(new ByteArrayResource(file.getBytes()));
                } catch (IOException e) {
                    throw new PDFExtractionException("Failed to read uploaded file", e);
                }
            }
        }

        if (docs.isEmpty()) {
            throw new BadRequestException("No documents provided for extraction");
        }

        // 3) Extract data from the PDFs via AI
        ExtractedApplicationDataDTO extracted = extractPdfData(docs, isCv);

        // 4) Persist the extracted data into the application if requested
        if (extracted != null && saveData && applicationId != null && !applicationId.isBlank()) {
            applicationService.applyExtractedPdfData(applicationId, extracted);
        }

        return extracted;
    }

    /**
     * This method serves as the entry point for localized analysis for the job description
     * in its currently selected language. It performs data sanitization by
     * extracting plain text from HTML content using JSoup to ensure the analysis algorithms
     * are not distorted by markup tags. Following sanitization, it triggers the primary gender bias analysis and
     * delegates the compliance check to the core analysis engine. This enforces DE/EN-specific feedback rules
     * before shared fallback logic, so immediate feedback always matches the active language.
     *
     * @param jobFormDTO The data transfer object containing the current state of the job posting.
     * @param lang The language identifier (de/en) currently active in the editor.
     * @param userLang controls the language of explanation texts in the returned issues.
     * @return A list of compliance issues containing the combined legal and linguistic findings.
     */
    public List<ComplianceIssue> analyzeCurrentJobDescription(JobFormDTO jobFormDTO, String lang, String userLang) {
        String raw = "de".equals(lang) ? jobFormDTO.jobDescriptionDE() : jobFormDTO.jobDescriptionEN();
        String input = raw != null ? Jsoup.parse(raw).text() : "";
        GenderBiasAnalysisResponse genderAnalysis = genderBiasAnalysisService.analyzeText(input, lang);
        return analyzeJobDescription(jobFormDTO.title(), jobFormDTO.jobId(), input, lang, userLang, genderAnalysis, null);
    }

    /**
     * Analyzes the job description using the compliance prompt
     * Passes the selected description language, the job description text,
     * and optionally the job title to the AI model.
     * Executes a hybrid compliance analysis using a dual-track processing model.
     * 1. Immediately calculates the gender bias scores using rule-based dictionary matching (GenderBiasAnalysisService).
     * 2. Asynchronous LLM-based audit for legal risks (AGG violations,transparency requirements) via CompletableFuture
     * to minimize latency. The results are merged using a geometric mean to ensure that a failure in one
     * dimension (e.g., severe legal risk) significantly impacts the total score.
     *
     * @param title the job form title
     * @param jobId Unique identifier for the job.
     * @param text Extracted raw text of the job description.
     * @param lang the analysis language, expected to be `de` or `en`
     * @param userLang controls the language of explanation texts in the returned issues.
     * @param analysis Result of the primary linguistic gender analysis.
     * @param translatedAnalysis Second analysis of the translated counterpart.
     * @return A list containing all identified compliance issues.
     */

    public List<ComplianceIssue> analyzeJobDescription(
        String title,
        UUID jobId,
        String text,
        String lang,
        String userLang,
        GenderBiasAnalysisResponse analysis,
        GenderBiasAnalysisResponse translatedAnalysis
    ) {
        List<ComplianceIssue> complianceIssues;
        if (aiFeatureToggleService.isAiAvailable()) {
            try {
                complianceIssues = chatClient
                    .prompt()
                    .user(u ->
                        u
                            .text(complianceResource)
                            .param("descriptionLanguage", lang)
                            .param("userLang", userLang)
                            .param("jobDescription", text)
                            .param("title", title != null ? title : "")
                    )
                    .call()
                    .entity(new ParameterizedTypeReference<>() {});
                complianceIssues.forEach(issue -> issue.setLanguage(lang));
                aiFeatureToggleService.recordSuccess();
            } catch (Exception e) {
                aiFeatureToggleService.recordFailure();
                throw new InternalServerException("Compliance analysis parsing failed", e);
            }
        } else {
            // AI is disabled: skip the LLM-based legal analysis but keep rule-based gender scoring.
            complianceIssues = List.of();
        }

        int genderScore = complianceScoreService.calculateGenderScore(analysis, translatedAnalysis);

        int legalScore = complianceScoreService.calculateLegalScore(complianceIssues);
        // geometric means
        int combinedScore = (int) Math.round(Math.sqrt((double) genderScore * legalScore));

        jobService.updateAiAnalysis(jobId, combinedScore, complianceIssues, lang);

        return complianceIssues;
    }
}
