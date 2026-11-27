package de.tum.cit.aet.application.service;

import de.tum.cit.aet.application.domain.dto.ApplicationDocumentIdsDTO;
import de.tum.cit.aet.application.domain.dto.DocumentInformationHolderDTO;
import de.tum.cit.aet.core.constants.DocumentType;
import de.tum.cit.aet.core.documents.domain.ApplicantDocument;
import de.tum.cit.aet.core.documents.service.DocumentService;
import de.tum.cit.aet.core.exception.EntityNotFoundException;
import de.tum.cit.aet.core.exception.InvalidParameterException;
import de.tum.cit.aet.core.service.CurrentUserService;
import de.tum.cit.aet.usermanagement.domain.Applicant;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.dto.ApplicantDTO;
import de.tum.cit.aet.usermanagement.repository.ApplicantRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.AllArgsConstructor;
import org.apache.commons.lang3.NotImplementedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@AllArgsConstructor
public class ApplicantService {

    private final ApplicantRepository applicantRepository;
    private final UserRepository userRepository;
    private final DocumentService documentService;
    private final CurrentUserService currentUserService;

    public Applicant findOrCreateApplicant(UUID userId) {
        return applicantRepository.findById(userId).orElseGet(() -> createApplicant(userId));
    }

    /**
     * Looks up an applicant by user id without creating one when missing.
     *
     * @param userId the user id of the applicant
     * @return the applicant if present, otherwise empty
     */
    public Optional<Applicant> findByUserId(UUID userId) {
        return applicantRepository.findById(userId);
    }

    /**
     * Returns whether an applicant exists for the given user id.
     *
     * @param userId the user id to check
     * @return true if an applicant exists, false otherwise
     */
    public boolean existsByUserId(UUID userId) {
        return applicantRepository.existsById(userId);
    }

    /**
     * Retrieves the current user's applicant profile with all personal information.
     * Creates an empty applicant profile if none exists yet.
     *
     * @return the ApplicantDTO with current user and applicant data
     */
    @Transactional
    public ApplicantDTO getApplicantProfile() {
        UUID userId = currentUserService.getUserId();
        if (userId == null) {
            throw new InvalidParameterException("UserId must not be null.");
        }

        return ApplicantDTO.getFromEntity(findOrCreateApplicant(userId));
    }

    /**
     * Updates the current user's applicant profile with personal information.
     * Writes directly to {@code User} and {@code Applicant} entities.
     *
     * @param dto the updated applicant data
     * @return the updated ApplicantDTO
     */
    @Transactional
    public ApplicantDTO updateApplicantProfile(ApplicantDTO dto) {
        UUID userId = currentUserService.getUserId();
        if (userId == null) {
            throw new InvalidParameterException("UserId must not be null.");
        }

        User user = userRepository.findById(userId).orElseThrow(() -> EntityNotFoundException.forId("User", userId));
        Applicant applicant = findOrCreateApplicant(userId);

        applyPersonalInformationData(user, applicant, dto);
        applyDocumentSettingsData(applicant, dto);
        userRepository.save(user);
        applicantRepository.save(applicant);

        return ApplicantDTO.getFromEntity(applicant);
    }

    /**
     * Updates only the current user's personal information segment.
     *
     * @param dto the updated applicant personal information
     * @return the updated ApplicantDTO
     */
    @Transactional
    public ApplicantDTO updateApplicantPersonalInformation(ApplicantDTO dto) {
        UUID userId = currentUserService.getUserId();
        if (userId == null) {
            throw new InvalidParameterException("UserId must not be null.");
        }

        User user = userRepository.findById(userId).orElseThrow(() -> EntityNotFoundException.forId("User", userId));
        Applicant applicant = findOrCreateApplicant(userId);

        applyPersonalInformationData(user, applicant, dto);
        userRepository.save(user);
        applicantRepository.save(applicant);

        return ApplicantDTO.getFromEntity(applicant);
    }

    /**
     * Updates only the current user's degree/document settings segment.
     *
     * @param dto the updated applicant document settings
     * @return the updated ApplicantDTO
     */
    @Transactional
    public ApplicantDTO updateApplicantDocumentSettings(ApplicantDTO dto) {
        UUID userId = currentUserService.getUserId();
        if (userId == null) {
            throw new InvalidParameterException("UserId must not be null.");
        }

        Applicant applicant = findOrCreateApplicant(userId);
        applyDocumentSettingsData(applicant, dto);
        applicantRepository.save(applicant);

        return ApplicantDTO.getFromEntity(applicant);
    }

    /**
     * Uploads applicant-profile documents of a given type and returns the resulting document list.
     *
     * @param documentType the type of documents to upload
     * @param files        the files to upload
     * @return the updated document list for that type
     */
    @Transactional
    public Set<DocumentInformationHolderDTO> uploadApplicantProfileDocuments(DocumentType documentType, List<MultipartFile> files) {
        UUID userId = currentUserService.getUserId();
        if (userId == null) {
            throw new InvalidParameterException("UserId must not be null.");
        }

        Applicant applicant = findOrCreateApplicant(userId);

        switch (documentType) {
            case BACHELOR_TRANSCRIPT, MASTER_TRANSCRIPT, REFERENCE:
                uploadTranscripts(files, documentType, applicant);
                break;
            case CV:
                uploadCV(files.getFirst(), applicant);
                break;
            default:
                throw new NotImplementedException(String.format("The type %s is not supported yet", documentType.name()));
        }

        return getApplicantDocumentInformation(applicant, documentType);
    }

    /**
     * Retrieves the current applicant profile's document IDs grouped by document type.
     * Creates an empty applicant profile if none exists yet.
     *
     * @return an {@link ApplicationDocumentIdsDTO} containing the applicant profile documents
     */
    @Transactional
    public ApplicationDocumentIdsDTO getApplicantProfileDocumentIds() {
        UUID userId = currentUserService.getUserId();
        if (userId == null) {
            throw new InvalidParameterException("UserId must not be null.");
        }

        Applicant applicant = findOrCreateApplicant(userId);

        ApplicationDocumentIdsDTO dto = new ApplicationDocumentIdsDTO();
        dto.setBachelorDocumentIds(getApplicantDocumentInformation(applicant, DocumentType.BACHELOR_TRANSCRIPT));
        dto.setMasterDocumentIds(getApplicantDocumentInformation(applicant, DocumentType.MASTER_TRANSCRIPT));
        dto.setReferenceDocumentIds(getApplicantDocumentInformation(applicant, DocumentType.REFERENCE));
        dto.setCvDocumentId(getApplicantDocumentInformation(applicant, DocumentType.CV).stream().findFirst().orElse(null));
        return dto;
    }

    /**
     * Deletes an applicant-profile document.
     *
     * @param documentId the id of the document to delete
     */
    public void deleteApplicantProfileDocument(UUID documentId) {
        UUID userId = currentUserService.getUserId();
        if (userId == null) {
            throw new InvalidParameterException("UserId must not be null.");
        }

        documentService.deleteApplicantOwnedDocument(userId, documentId);
    }

    /**
     * Renames an applicant-profile document.
     *
     * @param documentId the id of the document to rename
     * @param newName    the new name to set
     */
    public void renameApplicantProfileDocument(UUID documentId, String newName) {
        UUID userId = currentUserService.getUserId();
        if (userId == null) {
            throw new InvalidParameterException("UserId must not be null.");
        }

        documentService.renameApplicantDocument(userId, documentId, newName);
    }

    /**
     * Retrieves all CV documents for the given applicant.
     *
     * @param applicant the applicant to retrieve CVs for
     * @return set of CV documents
     */
    public Set<ApplicantDocument> getCVs(Applicant applicant) {
        return documentService.listForApplicantByType(applicant, DocumentType.CV);
    }

    /**
     * Retrieves all reference documents for the given applicant.
     *
     * @param applicant the applicant to retrieve references for
     * @return set of reference documents
     */
    public Set<ApplicantDocument> getReferences(Applicant applicant) {
        return documentService.listForApplicantByType(applicant, DocumentType.REFERENCE);
    }

    /**
     * Retrieves all bachelor transcript documents for the given applicant.
     *
     * @param applicant the applicant to retrieve bachelor transcripts for
     * @return set of bachelor transcript documents
     */
    public Set<ApplicantDocument> getBachelorTranscripts(Applicant applicant) {
        return documentService.listForApplicantByType(applicant, DocumentType.BACHELOR_TRANSCRIPT);
    }

    /**
     * Retrieves all master transcript documents for the given applicant.
     *
     * @param applicant the applicant to retrieve master transcripts for
     * @return set of master transcript documents
     */
    public Set<ApplicantDocument> getMasterTranscripts(Applicant applicant) {
        return documentService.listForApplicantByType(applicant, DocumentType.MASTER_TRANSCRIPT);
    }

    /**
     * Uploads a single CV document for the given applicant.
     *
     * @param cv        the uploaded CV file
     * @param applicant the applicant the CV belongs to
     */
    public void uploadCV(MultipartFile cv, Applicant applicant) {
        String name = Optional.ofNullable(cv.getOriginalFilename()).orElse("<empty>.pdf");
        documentService.uploadApplicantDocument(cv, DocumentType.CV, name, applicant);
    }

    /**
     * Uploads multiple documents of the given type for the applicant.
     *
     * @param files     the uploaded files
     * @param type      the type of the documents
     * @param applicant the applicant the documents belong to
     */
    public void uploadTranscripts(List<MultipartFile> files, DocumentType type, Applicant applicant) {
        for (MultipartFile file : files) {
            String name = Optional.ofNullable(file.getOriginalFilename()).orElse("<empty>.pdf");
            documentService.uploadApplicantDocument(file, type, name, applicant);
        }
    }

    Set<DocumentInformationHolderDTO> getApplicantDocumentInformation(Applicant applicant, DocumentType documentType) {
        return documentService
            .listForApplicantByType(applicant, documentType)
            .stream()
            .map(DocumentInformationHolderDTO::fromDocument)
            .collect(Collectors.toSet());
    }

    void applyPersonalInformationData(User user, Applicant applicant, ApplicantDTO dto) {
        if (dto.user() != null) {
            if (dto.user().firstName() != null) {
                user.setFirstName(dto.user().firstName());
            }
            if (dto.user().lastName() != null) {
                user.setLastName(dto.user().lastName());
            }
            if (dto.user().email() != null) {
                user.setEmail(dto.user().email());
            }
            user.setGender(dto.user().gender());
            user.setNationality(dto.user().nationality());
            user.setBirthday(dto.user().birthday());
            user.setPhoneNumber(dto.user().phoneNumber());
            user.setWebsite(dto.user().website());
            user.setLinkedinUrl(dto.user().linkedinUrl());
        }

        applicant.setStreet(dto.street());
        applicant.setPostalCode(dto.postalCode());
        applicant.setCity(dto.city());
        applicant.setCountry(dto.country());
    }

    void applyDocumentSettingsData(Applicant applicant, ApplicantDTO dto) {
        applicant.setBachelorDegreeName(dto.bachelorDegreeName());
        applicant.setBachelorGradeUpperLimit(dto.bachelorGradeUpperLimit());
        applicant.setBachelorGradeLowerLimit(dto.bachelorGradeLowerLimit());
        applicant.setBachelorGrade(dto.bachelorGrade());
        applicant.setBachelorUniversity(dto.bachelorUniversity());

        applicant.setMasterDegreeName(dto.masterDegreeName());
        applicant.setMasterGradeUpperLimit(dto.masterGradeUpperLimit());
        applicant.setMasterGradeLowerLimit(dto.masterGradeLowerLimit());
        applicant.setMasterGrade(dto.masterGrade());
        applicant.setMasterUniversity(dto.masterUniversity());

        applicant.setNoBachelorDegree(dto.noBachelorDegree());
        applicant.setNoMasterDegree(dto.noMasterDegree());
        applicant.setDegreeStatusExplanation(resolveDegreeStatusExplanation(dto, false));
    }

    /**
     * Returns the explanation of the degree status to store for the given applicant data. The explanation only
     * belongs to an applicant who has ticked that they have no Bachelor's or no Master's degree, so it is dropped
     * when neither box is ticked.
     *
     * @param dto      the applicant data with the degree status
     * @param required whether a ticked box needs an explanation, which is the case when an application is submitted
     * @return the trimmed explanation, or null when there is none to store
     * @throws InvalidParameterException if the explanation is too long, or missing although it is required
     */
    String resolveDegreeStatusExplanation(ApplicantDTO dto, boolean required) {
        if (!dto.noBachelorDegree() && !dto.noMasterDegree()) {
            return null;
        }
        String explanation = dto.degreeStatusExplanation() == null ? "" : dto.degreeStatusExplanation().trim();
        if (explanation.length() > ApplicantDTO.MAX_DEGREE_STATUS_EXPLANATION_LENGTH) {
            throw new InvalidParameterException(
                "The degree status explanation must not exceed " + ApplicantDTO.MAX_DEGREE_STATUS_EXPLANATION_LENGTH + " characters."
            );
        }
        if (explanation.isEmpty()) {
            if (required) {
                throw new InvalidParameterException("Explain your degree status when you have no Bachelor's or no Master's degree.");
            }
            return null;
        }
        return explanation;
    }

    private Applicant createApplicant(UUID userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> EntityNotFoundException.forId("User", userId));
        Applicant applicant = new Applicant();
        applicant.setUser(user);
        return applicantRepository.save(applicant);
    }
}
