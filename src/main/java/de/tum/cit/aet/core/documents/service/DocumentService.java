package de.tum.cit.aet.core.documents.service;

import de.tum.cit.aet.application.constants.ApplicationState;
import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.core.constants.DocumentType;
import de.tum.cit.aet.core.constants.FileExtension;
import de.tum.cit.aet.core.documents.domain.ApplicantDocument;
import de.tum.cit.aet.core.documents.domain.ApplicationDocument;
import de.tum.cit.aet.core.documents.domain.Document;
import de.tum.cit.aet.core.documents.repository.DocumentRepository;
import de.tum.cit.aet.core.exception.AccessDeniedException;
import de.tum.cit.aet.core.exception.EntityNotFoundException;
import de.tum.cit.aet.core.exception.UploadException;
import de.tum.cit.aet.core.service.CurrentUserService;
import de.tum.cit.aet.core.util.OptionalUtils;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.usermanagement.domain.Applicant;
import de.tum.cit.aet.usermanagement.domain.User;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.EnumSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.apache.commons.io.FilenameUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

/**
 * Unified document service replacing the legacy {@code DocumentService} + {@code DocumentDictionaryService}.
 *
 * One row per document. {@link ApplicantDocument} rows live on the applicant profile;
 * {@link ApplicationDocument} rows are snapshot copies created when the applicant submits a job application.
 * Both reference the same hash-named file on disk; deletion removes the file only when no other row references it.
 */
@Service
public class DocumentService {

    private static final EnumSet<FileExtension> ALLOWED_EXTENSIONS = EnumSet.allOf(FileExtension.class);

    private final DocumentRepository documentRepository;
    private final CurrentUserService currentUserService;
    private final Path root;
    private final long maxFileSize;
    private final MessageDigest sha256;

    /**
     * Initialises the service and ensures the storage root directory exists on disk.
     *
     * @param documentRepository the JPA repository for the unified Document model
     * @param currentUserService the authenticated-user service used for ownership checks
     * @param rootDir            the storage root directory for uploaded documents
     * @param maxFileSize        the maximum allowed upload size in bytes
     * @throws NoSuchAlgorithmException if SHA-256 is unavailable on the JVM
     * @throws IllegalStateException    if the storage root cannot be created
     */
    public DocumentService(
        DocumentRepository documentRepository,
        CurrentUserService currentUserService,
        @Value("${aet.storage.root:storage/docs}") String rootDir,
        @Value("${aet.storage.max-size-bytes:26214400}") long maxFileSize
    ) throws NoSuchAlgorithmException {
        this.documentRepository = documentRepository;
        this.currentUserService = currentUserService;
        this.root = Paths.get(rootDir).toAbsolutePath().normalize();
        this.maxFileSize = maxFileSize;
        this.sha256 = MessageDigest.getInstance("SHA-256");

        try {
            Files.createDirectories(root);
        } catch (IOException ioe) {
            throw new IllegalStateException("Cannot create storage root: " + root, ioe);
        }
    }

    // ---------------------------------------------------------------------
    // Upload
    // ---------------------------------------------------------------------

    /**
     * Uploads a document owned by an applicant's profile.
     *
     * @param file      the multipart file to be stored
     * @param type      the type of the document (e.g. CV, REFERENCE)
     * @param name      the user-facing display name of the document
     * @param applicant the applicant who owns the document
     * @return the persisted {@link ApplicantDocument}
     */
    public ApplicantDocument uploadApplicantDocument(MultipartFile file, DocumentType type, String name, Applicant applicant) {
        StoredFile stored = storeFile(file);
        ApplicantDocument applicantDocument = new ApplicantDocument();
        populateBase(applicantDocument, stored, type, name, currentUserService.getUser());
        applicantDocument.setApplicant(applicant);
        return documentRepository.save(applicantDocument);
    }

    /**
     * Uploads a document attached directly to an application.
     *
     * @param file        the multipart file to be stored
     * @param type        the type of the document (e.g. CV, REFERENCE)
     * @param name        the user-facing display name of the document
     * @param application the application the document belongs to
     * @return the persisted {@link ApplicationDocument}
     */
    public ApplicationDocument uploadApplicationDocument(MultipartFile file, DocumentType type, String name, Application application) {
        return uploadApplicationDocument(file, type, name, application, currentUserService.getUser());
    }

    /**
     * Uploads a document attached directly to an application on behalf of an explicit uploader.
     * Used for token-authenticated flows (e.g. external reference letter upload) where the caller
     * is not a logged-in user. The uploader may be {@code null} when the submitter has no platform
     * account (a referee), in which case the row is stored with no {@code uploaded_by} owner.
     *
     * @param file        the multipart file to be stored
     * @param type        the type of the document
     * @param name        the user-facing display name of the document
     * @param application the application the document belongs to
     * @param uploader    the user attributed as the uploader, or {@code null} for an external submitter
     * @return the persisted {@link ApplicationDocument}
     */
    public ApplicationDocument uploadApplicationDocument(
        MultipartFile file,
        DocumentType type,
        String name,
        Application application,
        User uploader
    ) {
        StoredFile stored = storeFile(file);
        ApplicationDocument applicationDocument = new ApplicationDocument();
        populateBase(applicationDocument, stored, type, name, uploader);
        applicationDocument.setApplication(application);
        return documentRepository.save(applicationDocument);
    }

    /**
     * Copies all applicant-owned documents of the given types into application-scoped snapshot rows.
     * The new rows reference the same {@code path} on disk as the source applicant documents,
     * so no file content is duplicated — only ownership rows are created.
     *
     * @param applicant   the applicant whose profile documents should be copied
     * @param application the application that will receive the snapshot rows
     * @param types       the document types to include in the copy (e.g. CV, REFERENCE, transcripts)
     * @return the list of newly created {@link ApplicationDocument} rows
     */
    public List<ApplicationDocument> copyApplicantDocumentsToApplication(
        Applicant applicant,
        Application application,
        Set<DocumentType> types
    ) {
        // 1) Fetch every applicant-profile document for the given applicant
        Set<ApplicantDocument> sources = documentRepository.findAllApplicantDocuments(applicant.getUserId());

        // 2) For each source matching the requested types, build an ApplicationDocument copy that shares the path
        return sources
            .stream()
            .filter(src -> types.contains(src.getDocumentType()))
            .map(src -> {
                ApplicationDocument copy = new ApplicationDocument();
                copy.setDocumentType(src.getDocumentType());
                copy.setName(src.getName());
                copy.setPath(src.getPath());
                copy.setMimeType(src.getMimeType());
                copy.setSizeBytes(src.getSizeBytes());
                copy.setUploadedBy(src.getUploadedBy());
                copy.setApplication(application);
                return documentRepository.save(copy);
            })
            .toList();
    }

    // ---------------------------------------------------------------------
    // Download
    // ---------------------------------------------------------------------

    /**
     * Downloads a document by its ID, performing access control based on owner type.
     *
     * @param documentId the UUID of the document to download
     * @return the file as a Spring {@link Resource}
     * @throws EntityNotFoundException if the document does not exist
     * @throws AccessDeniedException   if the current user is not allowed to read the document
     */
    public Resource downloadDocument(UUID documentId) {
        Document document = findOrThrow(documentId);
        verifyAccess(document);
        return loadResource(document);
    }

    /**
     * Loads the underlying file resource for a document WITHOUT performing access control.
     * Intended for trusted internal callers (e.g., the export ZIP writer running as a scheduled job).
     *
     * @param document the document whose binary should be loaded
     * @return the file as a Spring {@link Resource}
     */
    public Resource loadResourceForExport(Document document) {
        return loadResource(document);
    }

    /**
     * Resolves the file extension for the given document based on its mime type.
     *
     * @param document the document to inspect
     * @return the matching {@link FileExtension}
     * @throws IllegalArgumentException if the mime type is missing or unsupported
     */
    public FileExtension resolveFileExtension(Document document) {
        if (document.getMimeType() == null) {
            throw new IllegalArgumentException("Document must have a mime type");
        }
        return switch (document.getMimeType()) {
            case "application/pdf" -> FileExtension.PDF;
            default -> throw new IllegalArgumentException("Unsupported mime type: " + document.getMimeType());
        };
    }

    // ---------------------------------------------------------------------
    // Listing
    // ---------------------------------------------------------------------

    /**
     * Returns all documents owned by an applicant's profile.
     *
     * @param applicant the applicant whose documents should be listed
     * @return the set of profile-owned documents
     */
    public Set<ApplicantDocument> listForApplicant(Applicant applicant) {
        return documentRepository.findAllApplicantDocuments(applicant.getUserId());
    }

    /**
     * Returns the applicant-profile documents of a specific type.
     *
     * @param applicant the applicant whose documents should be listed
     * @param type      the document type to filter by
     * @return the matching set of profile-owned documents
     */
    public Set<ApplicantDocument> listForApplicantByType(Applicant applicant, DocumentType type) {
        return documentRepository.findApplicantDocumentsByType(applicant.getUserId(), type);
    }

    /**
     * Returns all documents attached to a specific application.
     *
     * @param application the application whose documents should be listed
     * @return the set of application-scoped documents
     */
    public Set<ApplicationDocument> listForApplication(Application application) {
        return documentRepository.findAllApplicationDocuments(application.getApplicationId());
    }

    /**
     * Returns the application-scoped documents of a specific type.
     *
     * @param application the application whose documents should be listed
     * @param type        the document type to filter by
     * @return the matching set of application-scoped documents
     */
    public Set<ApplicationDocument> listForApplicationByType(Application application, DocumentType type) {
        return documentRepository.findApplicationDocumentsByType(application.getApplicationId(), type);
    }

    /**
     * Looks up a document by its ID without performing any access checks.
     *
     * @param documentId the UUID of the document to look up
     * @return the {@link Document} entity
     * @throws EntityNotFoundException if the document does not exist
     */
    public Document findById(UUID documentId) {
        return findOrThrow(documentId);
    }

    /**
     * Returns the application's owning applicant's user id for an {@link ApplicationDocument},
     * or empty if the given id is not an {@link ApplicationDocument}.
     *
     * @param documentId the document id
     * @return the application's applicant user id, if any
     */
    public Optional<UUID> findApplicationOwnerUserId(UUID documentId) {
        return documentRepository.findApplicationOwnerUserId(documentId);
    }

    /**
     * Returns the {@link ApplicationState} of the application owning an {@link ApplicationDocument}.
     *
     * @param documentId the document id
     * @return the state of the owning application, if the document is application-scoped
     */
    public Optional<ApplicationState> findApplicationStateForDocument(UUID documentId) {
        return documentRepository.findApplicationStateForDocument(documentId);
    }

    /**
     * Persists changes to an applicant-profile document.
     *
     * @param document the modified document to save
     * @return the persisted (and possibly merged) {@link ApplicantDocument}
     */
    public ApplicantDocument saveApplicantDocument(ApplicantDocument document) {
        return documentRepository.save(document);
    }

    /**
     * Persists changes to an application-scoped document.
     *
     * @param document the modified document to save
     * @return the persisted (and possibly merged) {@link ApplicationDocument}
     */
    public ApplicationDocument saveApplicationDocument(ApplicationDocument document) {
        return documentRepository.save(document);
    }

    // ---------------------------------------------------------------------
    // Mutation: rename, delete
    // ---------------------------------------------------------------------

    /**
     * Renames an applicant-profile document. Caller must own the document.
     *
     * @param applicantUserId the owning applicant's user id
     * @param documentId      the id of the document to rename
     * @param newName         the new display name
     * @throws EntityNotFoundException if the document does not exist or is not owned by the applicant
     */
    public void renameApplicantDocument(UUID applicantUserId, UUID documentId, String newName) {
        ApplicantDocument applicantDocument = assertApplicantOwned(applicantUserId, documentId);
        applicantDocument.setName(newName);
        documentRepository.save(applicantDocument);
    }

    /**
     * Deletes a document by id and removes the underlying file when nothing else references it.
     * Performs an access-control check based on the document's owner type.
     *
     * @param documentId the id of the document to delete
     * @throws EntityNotFoundException if the document does not exist
     * @throws AccessDeniedException   if the current user is not allowed to delete the document
     */
    public void deleteById(UUID documentId) {
        Document document = findOrThrow(documentId);
        verifyDeletePermission(document);
        deleteRowAndOrphanedFile(document);
    }

    /**
     * Deletes an applicant-owned document. Used internally for sync flows where the caller has
     * already verified ownership.
     *
     * @param applicantUserId the owning applicant's user id
     * @param documentId      the id of the document to delete
     * @throws EntityNotFoundException if the document does not exist or is not owned by the applicant
     */
    public void deleteApplicantOwnedDocument(UUID applicantUserId, UUID documentId) {
        ApplicantDocument applicantDocument = assertApplicantOwned(applicantUserId, documentId);
        deleteRowAndOrphanedFile(applicantDocument);
    }

    /**
     * Deletes every applicant-profile document for the given applicant and removes any orphaned
     * files from disk. Used by retention and account-deletion flows.
     *
     * @param applicantUserId the owning applicant's user id
     */
    public void deleteAllByApplicantId(UUID applicantUserId) {
        // 1) Fetch the docs first because we need each path for orphan-file cleanup
        Set<ApplicantDocument> applicantDocuments = documentRepository.findAllApplicantDocuments(applicantUserId);

        // 2) Bulk delete the rows; Hibernate batches via hibernate.jdbc.batch_size
        documentRepository.deleteAll(applicantDocuments);

        // 3) Remove each file from disk if no other Document row still references that path
        for (ApplicantDocument applicantDocument : applicantDocuments) {
            removeFileIfOrphan(applicantDocument.getPath(), applicantDocument.getDocumentId());
        }
    }

    /**
     * Deletes every document attached to the given application and removes any orphaned
     * files from disk. Used by retention and application-deletion flows.
     *
     * @param applicationId the id of the application whose documents should be removed
     */
    public void deleteAllByApplicationId(UUID applicationId) {
        // 1) Fetch the docs first because we need each path for orphan-file cleanup
        Set<ApplicationDocument> applicationDocuments = documentRepository.findAllApplicationDocuments(applicationId);

        // 2) Bulk delete the rows; Hibernate batches via hibernate.jdbc.batch_size
        documentRepository.deleteAll(applicationDocuments);

        // 3) Remove each file from disk if no other Document row still references that path
        for (ApplicationDocument applicationDocument : applicationDocuments) {
            removeFileIfOrphan(applicationDocument.getPath(), applicationDocument.getDocumentId());
        }
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    /**
     * Loads a document by id or throws if it does not exist.
     */
    private Document findOrThrow(UUID documentId) {
        return OptionalUtils.getOrThrow(documentRepository.findById(documentId), () ->
            EntityNotFoundException.forId("Document", documentId)
        );
    }

    /**
     * Loads a document and asserts it is an {@link ApplicantDocument} owned by the given applicant.
     *
     * @throws EntityNotFoundException if the document does not exist, is not applicant-owned, or
     *                                 is owned by a different applicant
     */
    /**
     * Loads the document and asserts it is an {@link ApplicantDocument} owned by the given applicant.
     * Ownership is checked via a scalar repository query rather than entity-graph traversal so that
     * the method does not require an open transaction.
     *
     * @throws EntityNotFoundException if the document does not exist, is not applicant-owned, or
     *                                 is owned by a different applicant
     */
    private ApplicantDocument assertApplicantOwned(UUID applicantUserId, UUID documentId) {
        Document document = findOrThrow(documentId);
        if (!(document instanceof ApplicantDocument applicantDocument)) {
            throw EntityNotFoundException.forId("ApplicantDocument", documentId, applicantUserId);
        }
        UUID ownerUserId = OptionalUtils.getOrThrow(documentRepository.findApplicantOwnerUserId(documentId), () ->
            EntityNotFoundException.forId("ApplicantDocument", documentId, applicantUserId)
        );
        if (!ownerUserId.equals(applicantUserId)) {
            throw EntityNotFoundException.forId("ApplicantDocument", documentId, applicantUserId);
        }
        return applicantDocument;
    }

    /**
     * Verifies the current user is allowed to read the given document.
     * Access rules:
     * - Application-scoped: professors and employees with job access; otherwise the owning applicant or admin.
     * - Applicant-scoped: the owning applicant or admin.
     *
     * Uses dedicated repository queries to fetch only the access-check data so the method does not
     * require an open transaction.
     */
    private void verifyAccess(Document document) {
        UUID documentId = document.getDocumentId();

        // 1) Application-scoped document: staff with job access OR the owning applicant / admin
        if (document instanceof ApplicationDocument) {
            if (currentUserService.isProfessor() || currentUserService.isEmployee()) {
                Job job = OptionalUtils.getOrThrow(documentRepository.findJobForApplicationDocument(documentId), () ->
                    EntityNotFoundException.forId("Job", documentId)
                );
                currentUserService.verifyJobAccess(job);
                return;
            }
            // A confidential reference letter stays hidden from the owning applicant; only staff (above) and admins see it.
            if (!currentUserService.isAdmin() && documentRepository.findReferenceLetterConfidentialByDocumentId(documentId).orElse(false)) {
                throw new AccessDeniedException("This reference letter is confidential and cannot be accessed by the applicant.");
            }
            UUID ownerUserId = OptionalUtils.getOrThrow(documentRepository.findApplicationOwnerUserId(documentId), () ->
                EntityNotFoundException.forId("ApplicationDocument", documentId)
            );
            currentUserService.isCurrentUserOrAdmin(ownerUserId);
            return;
        }

        // 2) Applicant-scoped document: only the owning applicant or admin
        if (document instanceof ApplicantDocument) {
            UUID ownerUserId = OptionalUtils.getOrThrow(documentRepository.findApplicantOwnerUserId(documentId), () ->
                EntityNotFoundException.forId("ApplicantDocument", documentId)
            );
            currentUserService.isCurrentUserOrAdmin(ownerUserId);
            return;
        }

        // 3) Reject anything without a known owner association
        throw new AccessDeniedException("Cannot verify access for document without owner association");
    }

    /**
     * Verifies the current user is allowed to delete the given document.
     * Both subtypes require the owning applicant or an admin. Uses scalar repository queries
     * so the method does not require an open transaction.
     */
    private void verifyDeletePermission(Document document) {
        UUID documentId = document.getDocumentId();
        if (document instanceof ApplicationDocument) {
            UUID ownerUserId = OptionalUtils.getOrThrow(documentRepository.findApplicationOwnerUserId(documentId), () ->
                EntityNotFoundException.forId("ApplicationDocument", documentId)
            );
            currentUserService.isCurrentUserOrAdmin(ownerUserId);
        } else if (document instanceof ApplicantDocument) {
            UUID ownerUserId = OptionalUtils.getOrThrow(documentRepository.findApplicantOwnerUserId(documentId), () ->
                EntityNotFoundException.forId("ApplicantDocument", documentId)
            );
            currentUserService.isCurrentUserOrAdmin(ownerUserId);
        } else {
            throw new AccessDeniedException("Cannot verify delete permission for document without owner association");
        }
    }

    /**
     * Deletes the document row and removes the underlying file if no other row references its path.
     */
    private void deleteRowAndOrphanedFile(Document document) {
        String path = document.getPath();
        UUID id = document.getDocumentId();
        documentRepository.delete(document);
        removeFileIfOrphan(path, id);
    }

    /**
     * Removes the file at {@code storedPath} from disk only when no other Document row
     * (excluding the just-deleted one identified by {@code excludeId}) references it.
     *
     * @param storedPath the absolute or storage-root-relative path of the file to potentially remove
     * @param excludeId  the id of the document already deleted (and therefore not counted)
     * @throws UncheckedIOException if the file deletion fails for an I/O reason
     */
    private void removeFileIfOrphan(String storedPath, UUID excludeId) {
        // 1) Skip removal if any other document row still references this path
        long others = documentRepository.countOtherReferencesByPath(storedPath, excludeId);
        if (others > 0) {
            return;
        }

        // 2) Resolve the path against the storage root and delete if present
        try {
            Files.deleteIfExists(resolveStoredPath(storedPath));
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to delete orphaned document file at " + storedPath, e);
        }
    }

    /**
     * Copies the immutable storage attributes from {@code stored} onto a new Document row,
     * and stamps the type, display name, and uploader.
     */
    private void populateBase(Document document, StoredFile stored, DocumentType type, String name, User uploader) {
        document.setDocumentType(type);
        document.setName(name);
        document.setPath(stored.path);
        document.setMimeType(stored.mimeType);
        document.setSizeBytes(stored.sizeBytes);
        document.setUploadedBy(uploader);
    }

    /**
     * Validates the upload, computes its content hash, and writes it to the storage root if not already there.
     *
     * @param file the multipart upload to persist on disk
     * @return a {@link StoredFile} record carrying the on-disk path, mime type, and size
     * @throws UploadException if the file is invalid or cannot be stored
     */
    private StoredFile storeFile(MultipartFile file) {
        // 1) Validate basic upload constraints (non-empty, allowed extension, size limit)
        validate(file);
        try {
            FileExtension ext = parseExtension(file);

            // 2) Hash the content to derive a deterministic filename, deduplicating identical bytes on disk
            String hash = computeFileHash(file);
            String storageFilename = hash + '.' + ext.getExtension();
            Path target = root.resolve(storageFilename);

            // 3) Only write if the target does not already exist (content hashes match means same bytes)
            if (Files.notExists(target)) {
                try (InputStream in = file.getInputStream()) {
                    Files.copy(in, target);
                }
            }

            String mime = Optional.ofNullable(file.getContentType()).orElse("application/octet-stream");
            return new StoredFile(target.toString(), mime, file.getSize());
        } catch (IOException ioe) {
            throw new UploadException("Cannot store file", ioe);
        }
    }

    /**
     * Loads the file backing a document as a Spring {@link Resource}.
     *
     * @throws UploadException if the file cannot be read
     */
    private Resource loadResource(Document document) {
        try {
            Path path = resolveStoredPath(document.getPath());
            Resource resource = new FileSystemResource(path);
            if (!resource.exists()) {
                throw new NoSuchFileException("Binary not found on disk: " + path);
            }
            if (!resource.isReadable()) {
                throw new NoSuchFileException("Binary not readable on disk: " + path);
            }
            return resource;
        } catch (IOException e) {
            throw new UploadException("Could not load document", e);
        }
    }

    /**
     * Resolves a stored path string to an absolute path inside the storage root.
     *
     * @throws IllegalStateException if the resolved path lies outside the configured storage root
     */
    private Path resolveStoredPath(String storedPath) {
        // 1) Convert the stored string to a path; resolve relative paths against either the storage root
        //    (for single-name relative paths like "abc.pdf") or the working directory (for nested relative paths)
        Path path = Paths.get(storedPath);
        if (!path.isAbsolute()) {
            if (path.getNameCount() == 1) {
                path = root.resolve(path);
            } else {
                Path workingDir = Paths.get("").toAbsolutePath();
                path = workingDir.resolve(path);
            }
        }

        // 2) Normalise and reject anything outside the configured storage root (path-traversal guard)
        path = path.toAbsolutePath().normalize();
        Path normalizedRoot = root.toAbsolutePath().normalize();
        if (!path.startsWith(normalizedRoot)) {
            throw new IllegalStateException("Stored path lies outside storage root: " + path);
        }
        return path;
    }

    /**
     * Validates that the upload is non-empty, has a filename, and does not exceed the size limit.
     *
     * @throws UploadException on any rule violation
     */
    private void validate(MultipartFile file) {
        if (file.isEmpty() || !StringUtils.hasText(file.getOriginalFilename())) {
            throw new UploadException("Empty file or missing filename");
        }
        if (file.getSize() > maxFileSize) {
            throw new UploadException("File exceeds maximum size of " + maxFileSize + " bytes");
        }
    }

    /**
     * Parses the file extension from the upload's original filename and verifies it is allowed.
     *
     * @throws UploadException if the extension is missing, unparseable, or not in the allow-list
     */
    private FileExtension parseExtension(MultipartFile file) {
        String extension = FilenameUtils.getExtension(file.getOriginalFilename());
        try {
            if (!StringUtils.hasText(extension)) {
                throw new UploadException("Empty file or missing extension");
            }
            FileExtension ext = FileExtension.valueOf(extension.toUpperCase());
            if (!ALLOWED_EXTENSIONS.contains(ext)) {
                throw new UploadException("File extension not allowed: ." + extension);
            }
            return ext;
        } catch (IllegalArgumentException e) {
            throw new UploadException("Unsupported file type: ." + extension);
        }
    }

    /**
     * Streams the file through SHA-256 to compute its content hash without loading it fully into memory.
     */
    private String computeFileHash(MultipartFile file) throws IOException {
        sha256.reset();
        try (DigestInputStream in = new DigestInputStream(file.getInputStream(), sha256)) {
            in.transferTo(OutputStream.nullOutputStream());
        }
        return HexFormat.of().withLowerCase().formatHex(sha256.digest());
    }

    /** Snapshot of an upload after it has been validated, hashed, and written to disk. */
    private record StoredFile(String path, String mimeType, long sizeBytes) {}
}
