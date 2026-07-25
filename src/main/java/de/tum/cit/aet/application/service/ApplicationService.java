package de.tum.cit.aet.application.service;

import static de.tum.cit.aet.application.domain.dto.ApplicationForApplicantDTO.getFromEntity;

import de.tum.cit.aet.ai.dto.ExtractedApplicationDataDTO;
import de.tum.cit.aet.ai.dto.ExtractedCertificateDataDTO;
import de.tum.cit.aet.application.constants.ApplicationState;
import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.application.domain.dto.*;
import de.tum.cit.aet.application.repository.ApplicationRepository;
import de.tum.cit.aet.core.constants.DocumentType;
import de.tum.cit.aet.core.constants.Language;
import de.tum.cit.aet.core.documents.domain.ApplicantDocument;
import de.tum.cit.aet.core.documents.domain.ApplicationDocument;
import de.tum.cit.aet.core.documents.domain.Document;
import de.tum.cit.aet.core.documents.service.DocumentService;
import de.tum.cit.aet.core.dto.PageDTO;
import de.tum.cit.aet.core.dto.SortDTO;
import de.tum.cit.aet.core.exception.EntityNotFoundException;
import de.tum.cit.aet.core.exception.InvalidParameterException;
import de.tum.cit.aet.core.exception.OperationNotAllowedException;
import de.tum.cit.aet.core.service.CurrentUserService;
import de.tum.cit.aet.core.util.HtmlSanitizer;
import de.tum.cit.aet.core.util.PageUtil;
import de.tum.cit.aet.core.util.StringUtil;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.job.repository.JobRepository;
import de.tum.cit.aet.notification.constants.EmailType;
import de.tum.cit.aet.notification.service.AsyncEmailSender;
import de.tum.cit.aet.notification.service.mail.Email;
import de.tum.cit.aet.reference.dto.ReferenceRequestDTO;
import de.tum.cit.aet.reference.service.ReferenceRequestService;
import de.tum.cit.aet.usermanagement.domain.Applicant;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.dto.ApplicantDTO;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Consumer;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.AllArgsConstructor;
import org.apache.commons.lang3.NotImplementedException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@AllArgsConstructor
@Service
public class ApplicationService {

    private static final Set<DocumentType> PROFILE_SYNCED_DOCUMENT_TYPES = EnumSet.of(
        DocumentType.CV,
        DocumentType.REFERENCE,
        DocumentType.BACHELOR_TRANSCRIPT,
        DocumentType.MASTER_TRANSCRIPT,
        DocumentType.CUSTOM
    );

    private final ApplicationRepository applicationRepository;
    private final JobRepository jobRepository;
    private final UserRepository userRepository;

    private final DocumentService documentService;
    private final ApplicantService applicantService;
    private final CurrentUserService currentUserService;
    private final AsyncEmailSender sender;
    private final ReferenceRequestService referenceRequestService;

    /**
     * Creates a new job application for the given applicant and job.
     * If an application already exists for the applicant and job, an exception is thrown.
     *
     * @param jobId the id of the job
     * @return the created ApplicationForApplicantDTO
     * @throws OperationNotAllowedException if the applicant has already applied for the job
     */
    @Transactional
    public ApplicationForApplicantDTO createApplication(UUID jobId) {
        // 1) Resolve the job
        Job job = jobRepository.findById(jobId).orElseThrow(() -> EntityNotFoundException.forId("Job", jobId));

        UUID userId = currentUserService.getUserId();

        // 2) Anonymous preview: return a transient stub for unauthenticated callers
        if (userId == null) {
            Application application = new Application();
            application.setJob(job);
            application.setState(ApplicationState.SAVED);
            return getFromEntity(application);
        }

        // 3) Idempotency: if the applicant already has an application for this job, return it
        Application existingApplication = applicationRepository.getByApplicantByUserIdAndJobId(userId, jobId);
        if (existingApplication != null) {
            return attachReferences(getFromEntity(existingApplication), existingApplication.getApplicationId());
        }
        Applicant applicant = applicantService.findOrCreateApplicant(userId);

        // 4) Build the new application shell
        Application newApplication = new Application();
        newApplication.setApplicant(applicant);
        newApplication.setJob(job);
        newApplication.setState(ApplicationState.SAVED);
        newApplication.setInternalComments(new HashSet<>());

        // 5) Snapshot the applicant's current profile data onto the application
        User user = applicant.getUser();
        newApplication.setApplicantFirstName(user.getFirstName());
        newApplication.setApplicantLastName(user.getLastName());
        newApplication.setApplicantEmail(user.getEmail());
        newApplication.setApplicantGender(user.getGender());
        newApplication.setApplicantNationality(user.getNationality());
        newApplication.setApplicantBirthday(user.getBirthday());
        newApplication.setApplicantPhoneNumber(user.getPhoneNumber());
        newApplication.setApplicantWebsite(user.getWebsite());
        newApplication.setApplicantLinkedinUrl(user.getLinkedinUrl());

        newApplication.setApplicantStreet(applicant.getStreet());
        newApplication.setApplicantPostalCode(applicant.getPostalCode());
        newApplication.setApplicantCity(applicant.getCity());
        newApplication.setApplicantCountry(applicant.getCountry());

        newApplication.setApplicantBachelorDegreeName(applicant.getBachelorDegreeName());
        newApplication.setApplicantBachelorGradeUpperLimit(applicant.getBachelorGradeUpperLimit());
        newApplication.setApplicantBachelorGradeLowerLimit(applicant.getBachelorGradeLowerLimit());
        newApplication.setApplicantBachelorGrade(applicant.getBachelorGrade());
        newApplication.setApplicantBachelorUniversity(applicant.getBachelorUniversity());

        newApplication.setApplicantMasterDegreeName(applicant.getMasterDegreeName());
        newApplication.setApplicantMasterGradeUpperLimit(applicant.getMasterGradeUpperLimit());
        newApplication.setApplicantMasterGradeLowerLimit(applicant.getMasterGradeLowerLimit());
        newApplication.setApplicantMasterGrade(applicant.getMasterGrade());
        newApplication.setApplicantMasterUniversity(applicant.getMasterUniversity());

        // 6) Persist the application
        Application savedApplication = applicationRepository.save(newApplication);

        // 7) Prefill profile documents (CV, transcripts, references) onto the new application
        documentService.copyApplicantDocumentsToApplication(applicant, savedApplication, PROFILE_SYNCED_DOCUMENT_TYPES);

        return getFromEntity(savedApplication);
    }

    /**
     * Retrieves an application by its ID.
     *
     * @param applicationId the UUID of the application
     * @return the ApplicationForApplicantDTO with the given ID
     */
    public ApplicationForApplicantDTO getApplicationById(UUID applicationId) {
        return attachReferences(assertCanViewApplicationDTO(applicationId), applicationId);
    }

    /**
     * Enriches an applicant application DTO with its reference requests so the applicant view can
     * carry the reference list without a separate client round-trip. Returns the DTO unchanged for a
     * transient application that has not been persisted yet.
     *
     * @param dto           the base application DTO built from the scalar application data
     * @param applicationId the owning application id, or null for a transient application
     * @return the DTO enriched with its reference requests, ordered by creation time
     */
    private ApplicationForApplicantDTO attachReferences(ApplicationForApplicantDTO dto, UUID applicationId) {
        if (applicationId == null) {
            return dto;
        }
        boolean includeReferenceLetterDocumentIds = currentUserService.isAdmin() || !dto.referenceLettersConfidential();
        List<ReferenceRequestDTO> references = referenceRequestService
            .findAllByApplicationIdOrdered(applicationId)
            .stream()
            .map(referenceRequest -> ReferenceRequestDTO.fromEntity(referenceRequest, includeReferenceLetterDocumentIds))
            .toList();
        return dto.withReferences(references);
    }

    /**
     * Updates an existing application with new information.
     * Updates are stored in the application's snapshot fields, not in the applicant entity.
     * When the application is sent, the snapshot data is synced back to the applicant profile.
     *
     * Rich-text fields (motivation, specialSkills, projects) are sanitized on write
     * to remove unsafe HTML before persisting.
     *
     * @param updateApplicationDTO DTO containing updated application data
     * @return the updated ApplicationForApplicantDTO
     */
    @Transactional
    public ApplicationForApplicantDTO updateApplication(UpdateApplicationDTO updateApplicationDTO) {
        Application application = assertCanManageApplication(updateApplicationDTO.applicationId());
        boolean isSubmitting = ApplicationState.SENT.equals(updateApplicationDTO.applicationState());
        application.setState(updateApplicationDTO.applicationState());
        application.setDesiredStartDate(updateApplicationDTO.desiredDate());
        application.setProjects(HtmlSanitizer.sanitize(updateApplicationDTO.projects()));
        application.setSpecialSkills(HtmlSanitizer.sanitize(updateApplicationDTO.specialSkills()));
        application.setMotivation(HtmlSanitizer.sanitize(updateApplicationDTO.motivation()));
        if (updateApplicationDTO.referenceLettersConfidential() != null) {
            application.setReferenceLettersConfidential(updateApplicationDTO.referenceLettersConfidential());
        }
        if (isSubmitting) {
            application.setAppliedAt(LocalDateTime.now());
        }

        ApplicantDTO applicantDTO = updateApplicationDTO.applicant();
        application.setApplicantFirstName(applicantDTO.user().firstName());
        application.setApplicantLastName(applicantDTO.user().lastName());
        application.setApplicantEmail(applicantDTO.user().email());
        application.setApplicantGender(applicantDTO.user().gender());
        application.setApplicantNationality(applicantDTO.user().nationality());
        application.setApplicantBirthday(applicantDTO.user().birthday());
        application.setApplicantPhoneNumber(applicantDTO.user().phoneNumber());
        application.setApplicantWebsite(applicantDTO.user().website());
        application.setApplicantLinkedinUrl(applicantDTO.user().linkedinUrl());

        application.setApplicantStreet(applicantDTO.street());
        application.setApplicantPostalCode(applicantDTO.postalCode());
        application.setApplicantCity(applicantDTO.city());
        application.setApplicantCountry(applicantDTO.country());
        application.setApplicantBachelorDegreeName(applicantDTO.bachelorDegreeName());
        application.setApplicantBachelorGradeUpperLimit(applicantDTO.bachelorGradeUpperLimit());
        application.setApplicantBachelorGradeLowerLimit(applicantDTO.bachelorGradeLowerLimit());
        application.setApplicantBachelorGrade(applicantDTO.bachelorGrade());
        application.setApplicantBachelorUniversity(applicantDTO.bachelorUniversity());
        application.setApplicantMasterDegreeName(applicantDTO.masterDegreeName());
        application.setApplicantMasterGradeUpperLimit(applicantDTO.masterGradeUpperLimit());
        application.setApplicantMasterGradeLowerLimit(applicantDTO.masterGradeLowerLimit());
        application.setApplicantMasterGrade(applicantDTO.masterGrade());
        application.setApplicantMasterUniversity(applicantDTO.masterUniversity());

        application = applicationRepository.save(application);

        if (isSubmitting) {
            syncSnapshotDataToApplicant(application);
            syncDocumentsToApplicantProfile(application);
            confirmApplicationToApplicant(application);
            confirmApplicationToProfessor(application);
            referenceRequestService.dispatchInvitations(application);
        }
        return ApplicationForApplicantDTO.getFromEntity(application);
    }

    /**
     * Syncs snapshot data from the application back to the applicant profile.
     * Ensures the applicant's profile is updated with the latest data when an application is sent.
     *
     * @param application the application containing the snapshot data to sync
     */
    private void syncSnapshotDataToApplicant(Application application) {
        Applicant applicant = application.getApplicant();
        User user = applicant.getUser();

        ApplicantDTO dto = ApplicantDTO.getFromApplicationSnapshot(application);
        applicantService.applyPersonalInformationData(user, applicant, dto);
        applicantService.applyDocumentSettingsData(applicant, dto);
    }

    /**
     * Syncs documents from application back to the applicant's profile after submission.
     * For each profile-synced document type, deletes the applicant's existing rows and replaces
     * them with copies of the application's rows. The submitted application becomes the source
     * of truth for that applicant's profile documents going forward.
     */
    private void syncDocumentsToApplicantProfile(Application application) {
        Applicant applicant = application.getApplicant();

        for (DocumentType documentType : PROFILE_SYNCED_DOCUMENT_TYPES) {
            syncDocumentsByType(application, applicant, documentType);
        }
    }

    /**
     * Syncs documents of a specific type from the application to the applicant profile.
     * Replaces existing documents in the applicant profile with those from the application.
     *
     * The replacement is intentional: after submission, the profile becomes the source for
     * prefilling future applications with the latest confirmed document set.
     *
     * @param application  the application containing the documents
     * @param applicant    the applicant whose profile should receive the documents
     * @param documentType the type of documents to sync
     */
    private void syncDocumentsByType(Application application, Applicant applicant, DocumentType documentType) {
        Set<ApplicationDocument> applicationDocuments = documentService.listForApplicationByType(application, documentType);
        Set<ApplicantDocument> applicantDocuments = documentService.listForApplicantByType(applicant, documentType);

        // 1) Delete the applicant's existing documents of this type
        for (ApplicantDocument applicantDocument : applicantDocuments) {
            documentService.deleteApplicantOwnedDocument(applicant.getUserId(), applicantDocument.getDocumentId());
        }

        // 2) Copy each application document into a new applicant-scoped row, sharing the same on-disk path
        for (ApplicationDocument applicationDocument : applicationDocuments) {
            ApplicantDocument copy = new ApplicantDocument();
            copy.setDocumentType(applicationDocument.getDocumentType());
            copy.setName(applicationDocument.getName());
            copy.setPath(applicationDocument.getPath());
            copy.setMimeType(applicationDocument.getMimeType());
            copy.setSizeBytes(applicationDocument.getSizeBytes());
            copy.setUploadedBy(applicationDocument.getUploadedBy());
            copy.setApplicant(applicant);
            documentService.saveApplicantDocument(copy);
        }
    }

    /**
     * Sends a confirmation email to the applicant after a successful submission.
     *
     * @param application the application that was just sent
     */
    private void confirmApplicationToApplicant(Application application) {
        User user = application.getApplicant().getUser();
        Email email = Email.builder()
            .to(user)
            .language(Language.fromCode(user.getSelectedLanguage()))
            .emailType(EmailType.APPLICATION_SENT)
            .content(application)
            .researchGroup(application.getJob().getResearchGroup())
            .build();
        sender.sendAsync(email);
    }

    /**
     * Sends a notification email to the supervising professor of the job.
     *
     * @param application the application that was just sent
     */
    private void confirmApplicationToProfessor(Application application) {
        User supervisingProfessor = application.getJob().getSupervisingProfessor();
        Email email = Email.builder()
            .to(supervisingProfessor)
            .language(Language.fromCode(supervisingProfessor.getSelectedLanguage()))
            .emailType(EmailType.APPLICATION_RECEIVED)
            .content(application)
            .researchGroup(application.getJob().getResearchGroup())
            .build();
        sender.sendAsync(email);
    }

    /**
     * Withdraws an application by setting its state to WITHDRAWN.
     *
     * @param applicationId the UUID of the application to withdraw
     */
    public void withdrawApplication(UUID applicationId) {
        Application application = assertCanManageApplication(applicationId);
        User user = application.getApplicant().getUser();
        Job job = application.getJob();

        application.setState(ApplicationState.WITHDRAWN);
        application = applicationRepository.save(application);

        referenceRequestService.cancelPendingForWithdrawnApplication(application);

        Email email = Email.builder()
            .to(user)
            .language(Language.fromCode(user.getSelectedLanguage()))
            .emailType(EmailType.APPLICATION_WITHDRAWN)
            .content(application)
            .researchGroup(job.getResearchGroup())
            .build();

        sender.sendAsync(email);
    }

    /**
     * Deletes an application by its ID.
     *
     * @param applicationId the UUID of the application to delete
     */
    public void deleteApplication(UUID applicationId) {
        assertCanManageApplication(applicationId);
        applicationRepository.deleteById(applicationId);
    }

    /**
     * Deletes an application document by its ID.
     *
     * @param documentId the ID of the document to delete
     */
    public void deleteDocument(UUID documentId) {
        assertCanManageApplicationDocument(documentId);
        assertApplicationDocumentEditable(documentId);
        documentService.deleteById(documentId);
    }

    /**
     * Retrieves a paginated list of application overviews for the current applicant.
     *
     * @param pageDTO the pagination information
     * @param sortDTO the sorting configuration
     * @return a page of application overview DTOs
     */
    public Page<ApplicationOverviewDTO> getAllApplications(PageDTO pageDTO, SortDTO sortDTO) {
        UUID userId = currentUserService.getUserId();
        Pageable pageable = PageUtil.createPageRequest(pageDTO, sortDTO, PageUtil.ColumnMapping.APPLICANT_APPLICATIONS, true);
        return applicationRepository.findApplicationsByApplicant(userId, pageable);
    }

    /**
     * Returns a paginated list of applications across every research group for admin views.
     * Supports optional filters for state, research group, supervising professor, and job,
     * plus a search string matching applicant full name or job title.
     *
     * @param pageDTO     pagination configuration
     * @param adminFilter DTO containing all optionally filterable fields
     * @param sortDTO     sorting configuration
     * @param searchQuery search string for applicant name or job title
     * @return a page of {@link AdminApplicationOverviewDTO} matching the criteria
     */
    public Page<AdminApplicationOverviewDTO> getAllApplicationsForAdmin(
        PageDTO pageDTO,
        AdminApplicationsFilterDTO adminFilter,
        SortDTO sortDTO,
        String searchQuery
    ) {
        Pageable pageable = PageUtil.createPageRequest(pageDTO, sortDTO, PageUtil.ColumnMapping.APPLICANT_APPLICATIONS, true);
        return applicationRepository.findAllApplicationsForAdmin(
            mapStateFilter(adminFilter.states()),
            nullIfEmpty(adminFilter.researchGroupIds()),
            nullIfEmpty(adminFilter.supervisingProfessorIds()),
            nullIfEmpty(adminFilter.jobIds()),
            StringUtil.normalizeSearchQuery(searchQuery),
            pageable
        );
    }

    /**
     * Maps a list of {@link ApplicationState} string values to enum values.
     * Returns {@code null} when the input is {@code null} or empty so the calling
     * JPQL query can short-circuit the {@code IS NULL} branch.
     */
    private static List<ApplicationState> mapStateFilter(List<String> states) {
        if (states == null || states.isEmpty()) {
            return null;
        }
        return states.stream().map(ApplicationState::valueOf).filter(Objects::nonNull).toList();
    }

    /**
     * Returns {@code null} when the list is {@code null} or empty, otherwise the list itself.
     * Used to feed empty filters to JPQL queries that compare against {@code :param IS NULL}.
     */
    private static <T> List<T> nullIfEmpty(List<T> list) {
        return (list == null || list.isEmpty()) ? null : list;
    }

    /**
     * Retrieves all applications submitted by the given applicant user.
     *
     * @param applicantUserId the user id of the applicant
     * @return list of applications belonging to the applicant
     */
    public List<Application> findAllByApplicantUserId(UUID applicantUserId) {
        return applicationRepository.findAllByApplicantId(applicantUserId);
    }

    /**
     * Retrieves all CV documents attached to the given application.
     *
     * @param application the application to retrieve CVs for
     * @return set of CV documents
     */
    public Set<ApplicationDocument> getCVs(Application application) {
        return documentService.listForApplicationByType(application, DocumentType.CV);
    }

    /**
     * Retrieves all reference documents attached to the given application.
     *
     * @param application the application to retrieve references for
     * @return set of reference documents
     */
    public Set<ApplicationDocument> getReferences(Application application) {
        return documentService.listForApplicationByType(application, DocumentType.REFERENCE);
    }

    /**
     * Retrieves all bachelor transcript documents attached to the given application.
     *
     * @param application the application to retrieve bachelor transcripts for
     * @return set of bachelor transcript documents
     */
    public Set<ApplicationDocument> getBachelorTranscripts(Application application) {
        return documentService.listForApplicationByType(application, DocumentType.BACHELOR_TRANSCRIPT);
    }

    /**
     * Retrieves all master transcript documents attached to the given application.
     *
     * @param application the application to retrieve master transcripts for
     * @return set of master transcript documents
     */
    public Set<ApplicationDocument> getMasterTranscripts(Application application) {
        return documentService.listForApplicationByType(application, DocumentType.MASTER_TRANSCRIPT);
    }

    /**
     * Uploads a single CV document and attaches it to the application.
     *
     * @param cv          the uploaded CV file
     * @param application the application the CV belongs to
     */
    private void uploadCV(MultipartFile cv, Application application) {
        String name = Optional.ofNullable(cv.getOriginalFilename()).orElse("<empty>.pdf");
        documentService.uploadApplicationDocument(cv, DocumentType.CV, name, application);
    }

    /**
     * Uploads multiple transcript documents and attaches them to the application.
     *
     * @param transcripts the uploaded files
     * @param type        the type of the documents
     * @param application the application the documents belong to
     */
    private void uploadAdditionalTranscripts(List<MultipartFile> transcripts, DocumentType type, Application application) {
        for (MultipartFile file : transcripts) {
            String name = Optional.ofNullable(file.getOriginalFilename()).orElse("<empty>.pdf");
            documentService.uploadApplicationDocument(file, type, name, application);
        }
    }

    /**
     * Uploads documents for an application of the given type and returns the resulting list.
     *
     * @param applicationId the UUID of the application
     * @param documentType  the type of documents to upload
     * @param files         the files to upload
     * @return the document IDs after upload, grouped by type
     */
    public Set<DocumentInformationHolderDTO> getDocumentIdsOfApplicationAndType(
        UUID applicationId,
        DocumentType documentType,
        List<MultipartFile> files
    ) {
        Application application = assertCanManageApplication(applicationId);
        assertApplicationDocumentsEditable(application);

        switch (documentType) {
            case BACHELOR_TRANSCRIPT, MASTER_TRANSCRIPT, REFERENCE:
                uploadAdditionalTranscripts(files, documentType, application);
                break;
            case CV:
                uploadCV(files.getFirst(), application);
                break;
            default:
                throw new NotImplementedException(String.format("The type %s is not supported yet", documentType.name()));
        }
        return documentService
            .listForApplicationByType(application, documentType)
            .stream()
            .map(DocumentInformationHolderDTO::fromDocument)
            .collect(Collectors.toSet());
    }

    /**
     * Returns the document IDs grouped by category for the given application.
     *
     * @param applicationId the UUID of the application
     * @return an {@link ApplicationDocumentIdsDTO} containing the categorized document IDs
     * @throws IllegalArgumentException if {@code applicationId} is {@code null}
     */
    public ApplicationDocumentIdsDTO getDocumentIdsOfApplication(UUID applicationId) {
        Application application = assertCanViewApplication(applicationId);
        Set<ApplicationDocument> applicationDocuments = documentService.listForApplication(application);

        ApplicationDocumentIdsDTO dto = new ApplicationDocumentIdsDTO();
        Set<DocumentInformationHolderDTO> bachelor = new HashSet<>();
        Set<DocumentInformationHolderDTO> master = new HashSet<>();
        Set<DocumentInformationHolderDTO> reference = new HashSet<>();
        for (ApplicationDocument applicationDocument : applicationDocuments) {
            DocumentInformationHolderDTO info = DocumentInformationHolderDTO.fromDocument(applicationDocument);
            switch (applicationDocument.getDocumentType()) {
                case BACHELOR_TRANSCRIPT -> bachelor.add(info);
                case MASTER_TRANSCRIPT -> master.add(info);
                case REFERENCE -> reference.add(info);
                case CV -> dto.setCvDocumentId(info);
                default -> {
                    // Skip CUSTOM/others
                }
            }
        }
        dto.setBachelorDocumentIds(bachelor);
        dto.setMasterDocumentIds(master);
        dto.setReferenceDocumentIds(reference);
        return dto;
    }

    /**
     * Retrieves the detail DTO for the given application.
     *
     *
     * @param applicationId the UUID of the application
     * @return the {@link ApplicationDetailDTO}
     */
    public ApplicationDetailDTO getApplicationDetail(UUID applicationId) {
        if (applicationId == null) {
            throw new IllegalArgumentException("The applicationId may not be null.");
        }
        Application application = applicationRepository
            .findByIdWithApplicantJobAndReferences(applicationId)
            .orElseThrow(() -> EntityNotFoundException.forId("Application", applicationId));
        currentUserService.isCurrentUserOrAdmin(application.getApplicant().getUserId());
        boolean includeConfidentialReferenceContent = currentUserService.isAdmin() || !application.isReferenceLettersConfidential();
        return ApplicationDetailDTO.getFromEntity(application, application.getJob(), includeConfidentialReferenceContent);
    }

    /**
     * Renames an application document.
     *
     * @param documentId the ID of the document to rename
     * @param newName    the new name to set
     */
    public void renameDocument(UUID documentId, String newName) {
        ApplicationDocument applicationDocument = assertCanManageApplicationDocument(documentId);
        assertApplicationDocumentEditable(documentId);
        applicationDocument.setName(newName);
        documentService.saveApplicationDocument(applicationDocument);
    }

    /**
     * Asserts that the current user can manage the application with the given ID.
     *
     * @param applicationId the ID of the application to check
     * @return the application entity if the user can manage it
     */
    private Application assertCanManageApplication(UUID applicationId) {
        if (applicationId == null) {
            throw new InvalidParameterException("The applicationId may not be null.");
        }
        Application application = applicationRepository
            .findById(applicationId)
            .orElseThrow(() -> EntityNotFoundException.forId("Application", applicationId));
        currentUserService.isCurrentUserOrAdmin(application.getApplicant().getUserId());
        return application;
    }

    /**
     * Asserts that the current user can manage the application document with the given ID.
     *
     * @param documentId the ID of the application document to check
     * @return the application document entity if the user can manage it
     */
    private ApplicationDocument assertCanManageApplicationDocument(UUID documentId) {
        Document document = documentService.findById(documentId);
        if (!(document instanceof ApplicationDocument applicationDocument)) {
            throw new OperationNotAllowedException("Only application documents can be managed via this endpoint.");
        }
        UUID ownerUserId = documentService
            .findApplicationOwnerUserId(documentId)
            .orElseThrow(() -> EntityNotFoundException.forId("ApplicationDocument", documentId));
        currentUserService.isCurrentUserOrAdmin(ownerUserId);
        return applicationDocument;
    }

    /**
     * Asserts that the application is in a state where documents may still be modified.
     * Documents are only editable while the application is in {@link ApplicationState#SAVED}.
     * The state is fetched via a scalar repository query so this method does not need
     * to traverse lazy associations.
     *
     * @param application the application to check
     * @throws OperationNotAllowedException if the application has already been sent
     */
    private void assertApplicationDocumentsEditable(Application application) {
        if (!ApplicationState.SAVED.equals(application.getState())) {
            throw new OperationNotAllowedException("Documents can only be modified while the application is in SAVED state.");
        }
    }

    /**
     * Variant of {@link #assertApplicationDocumentsEditable(Application)} that resolves the
     * application state from the document id via a scalar query, avoiding lazy-association traversal.
     *
     * @param documentId the id of the application document whose owning application is checked
     * @throws OperationNotAllowedException if the application has already been sent
     * @throws EntityNotFoundException      if no application is associated with the document
     */
    private void assertApplicationDocumentEditable(UUID documentId) {
        ApplicationState state = documentService
            .findApplicationStateForDocument(documentId)
            .orElseThrow(() -> EntityNotFoundException.forId("ApplicationDocument", documentId));
        if (!ApplicationState.SAVED.equals(state)) {
            throw new OperationNotAllowedException("Documents can only be modified while the application is in SAVED state.");
        }
    }

    /**
     * Asserts that the current user can view the application with the given ID.
     * Allows access to:
     * - the application owner (applicant)
     * - admins
     * - any professor or employee with access to the underlying job
     *
     * @param applicationId the ID of the application to check
     * @return the application entity if the user can view it
     */
    private Application assertCanViewApplication(UUID applicationId) {
        if (applicationId == null) {
            throw new InvalidParameterException("The applicationId may not be null.");
        }
        Application application = applicationRepository
            .findById(applicationId)
            .orElseThrow(() -> EntityNotFoundException.forId("Application", applicationId));
        if (currentUserService.isProfessor() || currentUserService.isEmployee()) {
            currentUserService.verifyJobAccess(application.getJob());
            return application;
        }
        currentUserService.isCurrentUserOrAdmin(application.getApplicant().getUserId());
        return application;
    }

    /**
     * Asserts that the current user can view the application with the given ID,
     * returning the projection DTO directly from the repository.
     * Allows access to:
     * - the application owner (applicant)
     * - admins
     * - any professor or employee with access to the underlying job
     *
     * @param applicationId the ID of the application to check
     * @return the {@link ApplicationForApplicantDTO} if the user can view it
     */
    private ApplicationForApplicantDTO assertCanViewApplicationDTO(UUID applicationId) {
        if (applicationId == null) {
            throw new InvalidParameterException("The applicationId may not be null.");
        }

        ApplicationForApplicantDTO application = applicationRepository.findDtoById(applicationId);
        if (application == null) {
            throw EntityNotFoundException.forId("Application", applicationId);
        }

        if (currentUserService.isProfessor() || currentUserService.isEmployee()) {
            Application managedApplication = applicationRepository
                .findById(applicationId)
                .orElseThrow(() -> EntityNotFoundException.forId("Application", applicationId));
            currentUserService.verifyJobAccess(managedApplication.getJob());
            return application;
        }

        currentUserService.isCurrentUserOrAdmin(application.applicant().user().userId());
        return application;
    }

    /**
     * Applies AI-extracted PDF data to an application, only updating fields that
     * are currently null or blank. Existing values are never overwritten.
     *
     * @param applicationId the ID of the application to update
     * @param extracted     the extracted data from the AI service
     */
    public void applyExtractedPdfData(String applicationId, ExtractedApplicationDataDTO extracted) {
        Application application = assertCanManageApplication(UUID.fromString(applicationId));

        setIfEmpty(application::getApplicantFirstName, application::setApplicantFirstName, extracted.firstName());
        setIfEmpty(application::getApplicantLastName, application::setApplicantLastName, extracted.lastName());
        setIfEmpty(application::getApplicantPhoneNumber, application::setApplicantPhoneNumber, extracted.phoneNumber());
        setIfEmpty(application::getApplicantWebsite, application::setApplicantWebsite, extracted.website());
        setIfEmpty(application::getApplicantLinkedinUrl, application::setApplicantLinkedinUrl, extracted.linkedinUrl());
        setIfEmpty(application::getApplicantGender, application::setApplicantGender, extracted.gender());
        setIfEmpty(application::getApplicantNationality, application::setApplicantNationality, extracted.nationality());
        setIfEmpty(application::getApplicantCountry, application::setApplicantCountry, extracted.country());
        if (application.getApplicantBirthday() == null && extracted.dateOfBirth() != null && !extracted.dateOfBirth().isBlank()) {
            application.setApplicantBirthday(LocalDate.parse(extracted.dateOfBirth()));
        }
        setIfEmpty(application::getApplicantStreet, application::setApplicantStreet, extracted.street());
        setIfEmpty(application::getApplicantCity, application::setApplicantCity, extracted.city());
        setIfEmpty(application::getApplicantPostalCode, application::setApplicantPostalCode, extracted.postalCode());
        ExtractedCertificateDataDTO education = extracted.education();
        if (education != null) {
            setIfEmpty(
                application::getApplicantBachelorDegreeName,
                application::setApplicantBachelorDegreeName,
                education.bachelorDegreeName()
            );
            setIfEmpty(
                application::getApplicantBachelorUniversity,
                application::setApplicantBachelorUniversity,
                education.bachelorUniversity()
            );
            setIfEmpty(application::getApplicantBachelorGrade, application::setApplicantBachelorGrade, education.bachelorGrade());
            setIfEmpty(application::getApplicantMasterDegreeName, application::setApplicantMasterDegreeName, education.masterDegreeName());
            setIfEmpty(application::getApplicantMasterUniversity, application::setApplicantMasterUniversity, education.masterUniversity());
            setIfEmpty(application::getApplicantMasterGrade, application::setApplicantMasterGrade, education.masterGrade());
        }
        applicationRepository.save(application);
    }

    /**
     * Sets a value on the application only if the current value is null or blank
     * and the new value is non-null and non-blank.
     *
     * @param getter   supplier for the current field value
     * @param setter   consumer to set the new field value
     * @param newValue the value to set if the current value is empty
     */
    private void setIfEmpty(Supplier<String> getter, Consumer<String> setter, String newValue) {
        String current = getter.get();
        if ((current == null || current.isBlank()) && newValue != null && !newValue.isBlank()) {
            setter.accept(newValue);
        }
    }
}
