package de.tum.cit.aet.core.documents.repository;

import de.tum.cit.aet.application.constants.ApplicationState;
import de.tum.cit.aet.core.constants.DocumentType;
import de.tum.cit.aet.core.documents.domain.ApplicantDocument;
import de.tum.cit.aet.core.documents.domain.ApplicationDocument;
import de.tum.cit.aet.core.documents.domain.Document;
import de.tum.cit.aet.core.repository.TumApplyJpaRepository;
import de.tum.cit.aet.job.domain.Job;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Repository for the unified Document model.
 *
 * The hierarchy uses Single Table Inheritance:
 * - {@link Document} (abstract base, mapped to the {@code documents} table)
 * - {@link ApplicantDocument} (discriminator {@code APPLICANT})
 * - {@link ApplicationDocument} (discriminator {@code APPLICATION})
 */
@Repository
public interface DocumentRepository extends TumApplyJpaRepository<Document, UUID> {
    /**
     * Returns every applicant-profile document owned by the given applicant, of any type.
     *
     * @param applicantUserId the owning applicant's user id
     * @return the matching set of applicant documents
     */
    @Query("SELECT d FROM ApplicantDocument d WHERE d.applicant.userId = :applicantUserId")
    Set<ApplicantDocument> findAllApplicantDocuments(@Param("applicantUserId") UUID applicantUserId);

    /**
     * Returns the applicant-profile documents of a specific type for the given applicant.
     *
     * @param applicantUserId the owning applicant's user id
     * @param documentType    the document type to filter by
     * @return the matching set of applicant documents
     */
    @Query("SELECT d FROM ApplicantDocument d WHERE d.applicant.userId = :applicantUserId AND d.documentType = :documentType")
    Set<ApplicantDocument> findApplicantDocumentsByType(
        @Param("applicantUserId") UUID applicantUserId,
        @Param("documentType") DocumentType documentType
    );

    /**
     * Returns every document attached to the given application, of any type.
     *
     * @param applicationId the application id
     * @return the matching set of application documents
     */
    @Query("SELECT d FROM ApplicationDocument d WHERE d.application.applicationId = :applicationId")
    Set<ApplicationDocument> findAllApplicationDocuments(@Param("applicationId") UUID applicationId);

    /**
     * Returns the application-scoped documents of a specific type for the given application.
     *
     * @param applicationId the application id
     * @param documentType  the document type to filter by
     * @return the matching set of application documents
     */
    @Query("SELECT d FROM ApplicationDocument d WHERE d.application.applicationId = :applicationId AND d.documentType = :documentType")
    Set<ApplicationDocument> findApplicationDocumentsByType(
        @Param("applicationId") UUID applicationId,
        @Param("documentType") DocumentType documentType
    );

    /**
     * Counts how many other Document rows reference the same on-disk file as the document
     * identified by {@code excludeId}. Used by the orphan-file cleanup logic to decide
     * whether the underlying file may be deleted from disk.
     *
     * @param path      the on-disk path to count references for
     * @param excludeId the id of the document being deleted (excluded from the count)
     * @return the number of remaining references to {@code path}
     */
    @Query("SELECT COUNT(d) FROM Document d WHERE d.path = :path AND d.documentId <> :excludeId")
    long countOtherReferencesByPath(@Param("path") String path, @Param("excludeId") UUID excludeId);

    /**
     * Returns every document uploaded by the given user, regardless of subtype. Used by the
     * user-data export to bundle all uploads belonging to that user.
     *
     * @param userId the uploader's user id
     * @return the list of documents uploaded by the user
     */
    @Query("SELECT d FROM Document d WHERE d.uploadedBy.userId = :userId")
    List<Document> findByUploadedByUserId(@Param("userId") UUID userId);

    /**
     * Returns the non-confidential reference letter documents attached to the given applicant's
     * applications. Reference letters carry no {@code uploaded_by} owner (the referee has no platform
     * account), so they are located via the owning application rather than the uploader query. Confidential
     * letters are excluded so they stay hidden from the applicant, including in their own data export.
     *
     * @param userId the applicant's user id
     * @return the applicant's non-confidential reference letter documents
     */
    @Query(
        """
        SELECT d FROM ApplicationDocument d
        WHERE d.documentType = de.tum.cit.aet.core.constants.DocumentType.REFERENCE_LETTER
          AND d.application.applicant.userId = :userId
          AND d.application.referenceLettersConfidential = false
        """
    )
    List<Document> findNonConfidentialReferenceLettersForApplicant(@Param("userId") UUID userId);

    /**
     * Returns the owning applicant's user id for the given {@link ApplicantDocument}.
     * Used by access checks to avoid traversing lazy associations outside a session.
     *
     * @param documentId the id of the applicant document
     * @return the owning applicant's user id, or empty if the document is not an {@link ApplicantDocument}
     */
    @Query("SELECT d.applicant.userId FROM ApplicantDocument d WHERE d.documentId = :documentId")
    Optional<UUID> findApplicantOwnerUserId(@Param("documentId") UUID documentId);

    /**
     * Returns the application's owning applicant's user id for the given {@link ApplicationDocument}.
     * Used by access checks to avoid traversing lazy associations outside a session.
     *
     * @param documentId the id of the application document
     * @return the application's applicant user id, or empty if the document is not an {@link ApplicationDocument}
     */
    @Query("SELECT d.application.applicant.userId FROM ApplicationDocument d WHERE d.documentId = :documentId")
    Optional<UUID> findApplicationOwnerUserId(@Param("documentId") UUID documentId);

    /**
     * Returns the {@link Job} associated with an {@link ApplicationDocument}, with the supervising
     * professor and research group eagerly fetched so callers can run staff access checks without
     * triggering lazy loads outside a session.
     *
     * @param documentId the id of the application document
     * @return the associated job, eagerly populated
     */
    @Query(
        """
        SELECT j FROM ApplicationDocument d
        JOIN d.application a
        JOIN a.job j
        LEFT JOIN FETCH j.supervisingProfessor
        LEFT JOIN FETCH j.researchGroup
        WHERE d.documentId = :documentId
        """
    )
    Optional<Job> findJobForApplicationDocument(@Param("documentId") UUID documentId);

    /**
     * Returns the {@link ApplicationState} of the application owning an {@link ApplicationDocument}.
     * Used by editability checks to avoid traversing lazy associations outside a session.
     *
     * @param documentId the id of the application document
     * @return the state of the owning application
     */
    @Query("SELECT a.state FROM ApplicationDocument d JOIN d.application a WHERE d.documentId = :documentId")
    Optional<ApplicationState> findApplicationStateForDocument(@Param("documentId") UUID documentId);

    /**
     * Returns the owning application's confidentiality waiver for the reference letter linked to the
     * given document, or empty when no reference request points to it. Used by access checks to hide a
     * confidential letter from the owning applicant while keeping it visible to the supervising professor.
     *
     * @param documentId the id of the application document
     * @return the confidentiality flag, or empty when the document is not a submitted reference letter
     */
    @Query("SELECT r.application.referenceLettersConfidential FROM ReferenceRequest r WHERE r.documentId = :documentId")
    Optional<Boolean> findReferenceLetterConfidentialByDocumentId(@Param("documentId") UUID documentId);
}
