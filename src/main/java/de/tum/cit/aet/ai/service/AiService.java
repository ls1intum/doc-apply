package de.tum.cit.aet.ai.service;

import de.tum.cit.aet.ai.constants.ComplianceCategory;
import de.tum.cit.aet.ai.domain.BiasedIssue;
import de.tum.cit.aet.ai.domain.ComplianceIssue;
import de.tum.cit.aet.ai.dto.ExtractedApplicationDataDTO;
import de.tum.cit.aet.ai.dto.ExtractedCertificateDataDTO;
import de.tum.cit.aet.ai.util.ComplianceScoreCalculator;
import de.tum.cit.aet.application.service.ApplicationService;
import de.tum.cit.aet.core.constants.GenderBiasWordLists;
import de.tum.cit.aet.core.constants.GenderCategory;
import de.tum.cit.aet.core.documents.service.DocumentService;
import de.tum.cit.aet.core.exception.BadRequestException;
import de.tum.cit.aet.core.exception.InternalServerException;
import de.tum.cit.aet.core.exception.PDFExtractionException;
import de.tum.cit.aet.core.service.CurrentUserService;
import de.tum.cit.aet.core.util.CountryCodeNormalizer;
import de.tum.cit.aet.core.util.DateNormalizer;
import de.tum.cit.aet.job.dto.JobFormDTO;
import de.tum.cit.aet.job.service.JobService;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.imageio.ImageIO;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.jsoup.Jsoup;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Flux;

@Service
@Slf4j
public class AiService {

    // Document & page limit for AI extraction
    private static final int MAX_DOCS = 5;
    private static final int MAX_PAGES_PER_DOC = 5;

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

    private final AiFeatureToggleService aiFeatureToggleService;

    public AiService(
        ChatClient.Builder chatClientBuilder,
        JobService jobService,
        ApplicationService applicationService,
        DocumentService documentService,
        CurrentUserService currentUserService,
        GenderBiasAnalysisService genderBiasAnalysisService,
        AiFeatureToggleService aiFeatureToggleService
    ) {
        this.chatClient = chatClientBuilder.build();
        this.jobService = jobService;
        this.applicationService = applicationService;
        this.documentService = documentService;
        this.currentUserService = currentUserService;
        this.genderBiasAnalysisService = genderBiasAnalysisService;
        this.aiFeatureToggleService = aiFeatureToggleService;
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
        String input = "de".equals(descriptionLanguage) ? jobFormDTO.jobDescriptionDE() : jobFormDTO.jobDescriptionEN();

        Set<String> inclusive = GenderBiasWordLists.getWords(descriptionLanguage, GenderCategory.INCLUSIVE);
        Set<String> nonInclusive = GenderBiasWordLists.getWords(descriptionLanguage, GenderCategory.NON_INCLUSIVE);
        final String locationText = jobFormDTO.location() != null ? jobFormDTO.location().correctLanguageValue(descriptionLanguage) : "";

        return chatClient
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
            .content()
            .doOnComplete(() -> aiFeatureToggleService.recordSuccess())
            .doOnError(e -> aiFeatureToggleService.recordFailure())
            .delayElements(Duration.ofMillis(35));
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
        Set<String> inclusive = GenderBiasWordLists.getWords(toLang, GenderCategory.INCLUSIVE);
        Set<String> nonInclusive = GenderBiasWordLists.getWords(toLang, GenderCategory.NON_INCLUSIVE);

        return chatClient
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
            .content()
            .doOnComplete(() -> aiFeatureToggleService.recordSuccess())
            .doOnError(e -> aiFeatureToggleService.recordFailure())
            .delayElements(Duration.ofMillis(35));
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

            // 2) Send the images to the LLM with the extraction prompt
            Object result;
            try {
                result = chatClient
                    .prompt()
                    .user(u -> {
                        u.text(prompt);
                        for (ByteArrayResource pageImage : pageImages) {
                            u.media(MediaType.IMAGE_PNG, pageImage);
                        }
                    })
                    .call()
                    .entity(targetClass);
                aiFeatureToggleService.recordSuccess();
            } catch (Exception e) {
                aiFeatureToggleService.recordFailure();
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
        // first lang
        String firstRaw = "de".equals(lang) ? jobFormDTO.jobDescriptionDE() : jobFormDTO.jobDescriptionEN();
        String firstInput = firstRaw != null ? Jsoup.parse(firstRaw).text() : "";
        if (firstInput.isBlank()) {
            return List.of();
        }
        List<BiasedIssue> originalOccurrences = genderBiasAnalysisService.analyzeOccurrences(firstInput, lang);
        Set<BiasedIssue> originalAnalysis = new HashSet<>(originalOccurrences);
        // second lang
        String targetLang = "de".equals(lang) ? "en" : "de";
        String secondRaw = "de".equals(targetLang) ? jobFormDTO.jobDescriptionDE() : jobFormDTO.jobDescriptionEN();
        String secondInput = secondRaw != null ? Jsoup.parse(secondRaw).text() : "";
        List<BiasedIssue> targetOccurrences = secondInput.isBlank()
            ? null
            : genderBiasAnalysisService.analyzeOccurrences(secondInput, targetLang);
        Set<BiasedIssue> targetAnalysis = targetOccurrences == null ? null : new HashSet<>(targetOccurrences);
        int genderScore = ComplianceScoreCalculator.calculateGenderScore(
            types(originalOccurrences),
            types(targetOccurrences),
            firstInput,
            secondInput
        );
        return analyzeJobDescription(jobFormDTO.title(), jobFormDTO.jobId(), firstInput, lang, userLang, originalAnalysis, targetAnalysis, genderScore);
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
        Set<BiasedIssue> analysis,
        Set<BiasedIssue> translatedAnalysis,
        int genderScore
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

        int legalScore = ComplianceScoreCalculator.calculateLegalScore(categories(complianceIssues));
        // geometric means
        int combinedScore = (int) Math.round(Math.sqrt((double) genderScore * legalScore));

        jobService.updateAiAnalysis(jobId, combinedScore, complianceIssues, analysis, lang);

        return complianceIssues;
    }

    private static List<GenderCategory> types(Collection<BiasedIssue> issues) {
        return issues == null ? null : issues.stream().map(BiasedIssue::getType).toList();
    }

    private static List<ComplianceCategory> categories(List<ComplianceIssue> issues) {
        return issues == null ? null : issues.stream().map(ComplianceIssue::getCategory).toList();
    }
}
