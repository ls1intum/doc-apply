package de.tum.cit.aet.application.web;

import de.tum.cit.aet.application.domain.dto.*;
import de.tum.cit.aet.application.service.ApplicationService;
import de.tum.cit.aet.core.constants.DocumentType;
import de.tum.cit.aet.core.dto.PageDTO;
import de.tum.cit.aet.core.dto.SortDTO;
import de.tum.cit.aet.core.security.annotations.Admin;
import de.tum.cit.aet.core.security.annotations.ApplicantOrAdmin;
import de.tum.cit.aet.core.security.annotations.Authenticated;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.NotImplementedException;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@RestController
@RequestMapping("/api/applications")
public class ApplicationResource {

    private final ApplicationService applicationService;

    @Autowired
    public ApplicationResource(ApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    /**
     * @param jobId The UUID of the Job
     * @return ApplicationForApplicantDTO as ResponseEntity, or 400 Bad Request if
     *         the createApplicationDTO is invalid
     */
    @ApplicantOrAdmin
    @PostMapping("/create/{jobId}")
    public ResponseEntity<ApplicationForApplicantDTO> createApplication(@PathVariable UUID jobId) {
        ApplicationForApplicantDTO applicationForApplicantDTO = applicationService.createApplication(jobId);
        return ResponseEntity.ok(applicationForApplicantDTO);
    }

    /**
     * @param application the updated application
     * @return updated ApplicationForApplicantDTO
     */
    @ApplicantOrAdmin
    @PutMapping
    public ResponseEntity<ApplicationForApplicantDTO> updateApplication(@RequestBody UpdateApplicationDTO application) {
        ApplicationForApplicantDTO updatedApplication = applicationService.updateApplication(application);
        return ResponseEntity.ok(updatedApplication);
    }

    /**
     * @param applicationId the UUID of the application
     * @return the ApplicationForApplicantDTO if found, otherwise 404 Not Found
     */
    @Authenticated
    @GetMapping("/{applicationId}")
    public ResponseEntity<ApplicationForApplicantDTO> getApplicationById(@PathVariable UUID applicationId) {
        ApplicationForApplicantDTO application = applicationService.getApplicationById(applicationId);
        return ResponseEntity.ok(application);
    }

    /**
     * @param applicationId the UUID of the application
     * @return 204 No Content when deletion is successful
     */
    @ApplicantOrAdmin
    @DeleteMapping("/{applicationId}")
    public ResponseEntity<Void> deleteApplication(@PathVariable UUID applicationId) {
        applicationService.deleteApplication(applicationId);
        return ResponseEntity.noContent().build();
    }

    /**
     * @param documentId id of the application document that will be deleted
     * @return 204 No Content when deletion is successful
     */
    @ApplicantOrAdmin
    @DeleteMapping("/documents/{documentId}")
    public ResponseEntity<Void> deleteDocumentFromApplication(@PathVariable UUID documentId) {
        log.info("DELETE /api/applications/documents/{} - Deleting application document", documentId);
        applicationService.deleteDocument(documentId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Renames a document associated with an application.
     *
     * @param documentId the UUID of the document to rename
     * @param newName    the new name to assign to the document
     * @return {@code 200 OK} if the rename operation was successful
     */
    @ApplicantOrAdmin
    @PutMapping("/documents/{documentId}/name")
    public ResponseEntity<Void> renameDocument(@PathVariable UUID documentId, @RequestParam String newName) {
        log.info("PUT /api/applications/documents/{}/name - Renaming application document", documentId);
        applicationService.renameDocument(documentId, newName);
        return ResponseEntity.ok().build();
    }

    /**
     * Withdraws a specific application.
     *
     * @param applicationId
     * @return the withdrawn ApplicationForApplicantDTO, or 404 Not Found if not
     *         found
     */
    @ApplicantOrAdmin
    @PutMapping("/withdraw/{applicationId}")
    public ResponseEntity<Void> withdrawApplication(@PathVariable UUID applicationId) {
        applicationService.withdrawApplication(applicationId);
        return ResponseEntity.ok().build();
    }

    /**
     * Retrieves a paginated list of application overviews for the current user.
     *
     * @param pageDTO the pagination configuration
     * @param sortDTO the sorting configuration
     * @return A page of {@link ApplicationOverviewDTO} representing the application
     *         overview data.
     */
    @ApplicantOrAdmin
    @GetMapping("/pages")
    public ResponseEntity<Page<ApplicationOverviewDTO>> getApplicationPages(
        @ParameterObject @Valid @ModelAttribute PageDTO pageDTO,
        @ParameterObject @Valid @ModelAttribute SortDTO sortDTO
    ) {
        return ResponseEntity.ok(applicationService.getAllApplications(pageDTO, sortDTO));
    }

    /**
     * {@code GET /api/applications/all} : Returns a paginated list of every application across
     * all applicants and research groups. Admin-only.
     *
     * @param pageDTO     pagination parameters including page number and size
     * @param adminFilter optional filters (states, researchGroupIds, supervisingProfessorIds, jobIds)
     * @param sortDTO     sorting parameter
     * @param searchQuery string to search for applicant name or job title
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} containing a
     *         {@link Page} of {@link AdminApplicationOverviewDTO}
     */
    @Admin
    @GetMapping("/all")
    public ResponseEntity<Page<AdminApplicationOverviewDTO>> getAllApplications(
        @ParameterObject @Valid @ModelAttribute PageDTO pageDTO,
        @ParameterObject @Valid @ModelAttribute AdminApplicationsFilterDTO adminFilter,
        @ParameterObject @Valid @ModelAttribute SortDTO sortDTO,
        @RequestParam(required = false) String searchQuery
    ) {
        log.info("GET /api/applications/all - Fetching all applications for admin");
        return ResponseEntity.ok(applicationService.getAllApplicationsForAdmin(pageDTO, adminFilter, sortDTO, searchQuery));
    }

    /**
     * Retrieves the detail intormation for applicants for their application
     *
     * @param applicationId
     * @return ApplicationDetailDTO of given ID
     */
    @ApplicantOrAdmin
    @GetMapping("/{applicationId}/detail")
    public ResponseEntity<ApplicationDetailDTO> getApplicationForDetailPage(@PathVariable UUID applicationId) {
        ApplicationDetailDTO applicationDetailDTO = applicationService.getApplicationDetail(applicationId);
        return ResponseEntity.ok(applicationDetailDTO);
    }

    /**
     * Uploads documents for a specific application by an authenticated applicant.
     * <p>
     * Accepts multipart file uploads and routes them based on {@code documentType}.
     * Only users with {@code ROLE_APPLICANT} are allowed.
     * </p>
     *
     * <p>
     * Unsupported types throw {@link NotImplementedException}.
     * </p>
     *
     * @param applicationId UUID of the target application
     * @param documentType  type of document to upload
     * @param files         uploaded multipart files
     * @return 200 OK if successful
     * @throws NotImplementedException if the document type is still unsupported
     */
    @Operation(
        summary = "Upload documents",
        requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
            content = @Content(
                mediaType = MediaType.MULTIPART_FORM_DATA_VALUE,
                schema = @Schema(implementation = MultipartUploadRequest.class)
            )
        )
    )
    @ApplicantOrAdmin
    @PostMapping("/{applicationId}/documents/{documentType}")
    public ResponseEntity<Set<DocumentInformationHolderDTO>> uploadDocuments(
        @PathVariable UUID applicationId,
        @PathVariable DocumentType documentType,
        @RequestParam("files") List<MultipartFile> files
    ) {
        Set<DocumentInformationHolderDTO> documentIdsOfUploadedDocuments = applicationService.getDocumentIdsOfApplicationAndType(
            applicationId,
            documentType,
            files
        );

        return ResponseEntity.ok(documentIdsOfUploadedDocuments);
    }

    /**
     * Retrieves document IDs associated with the given application.
     *
     * @param applicationId the UUID of the application
     * @return the document ID mappings for the application
     */
    @Authenticated
    @GetMapping("/getDocumentIds/{applicationId}")
    public ResponseEntity<ApplicationDocumentIdsDTO> getDocumentIds(@PathVariable UUID applicationId) {
        return ResponseEntity.ok(applicationService.getDocumentIdsOfApplication(applicationId));
    }
}
