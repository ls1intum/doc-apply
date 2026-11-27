package de.tum.cit.aet.evaluation.web;

import de.tum.cit.aet.core.dto.OffsetPageDTO;
import de.tum.cit.aet.core.dto.SortDTO;
import de.tum.cit.aet.core.security.annotations.ProfessorOrEmployee;
import de.tum.cit.aet.core.service.CurrentUserService;
import de.tum.cit.aet.evaluation.dto.*;
import de.tum.cit.aet.evaluation.service.ApplicationEvaluationService;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import lombok.AllArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/evaluation")
@AllArgsConstructor
public class ApplicationEvaluationResource {

    private final ApplicationEvaluationService applicationEvaluationService;
    private final CurrentUserService currentUserService;

    /**
     * Accepts an application with the given ID.
     *
     * @param applicationId the ID of the application to accept
     * @param acceptDTO     the acceptance details
     * @return HTTP 204 No Content response
     */
    @ProfessorOrEmployee
    @PostMapping("/applications/{applicationId}/accept")
    public ResponseEntity<Void> acceptApplication(@PathVariable UUID applicationId, @RequestBody @Valid AcceptDTO acceptDTO) {
        applicationEvaluationService.acceptApplication(applicationId, acceptDTO, currentUserService.getUser());
        return ResponseEntity.noContent().build();
    }

    /**
     * Rejects an application with the given ID.
     *
     * @param applicationId the ID of the application to reject
     * @param rejectDTO     the rejection details
     * @return HTTP 204 No Content response
     */
    @ProfessorOrEmployee
    @PostMapping("/applications/{applicationId}/reject")
    public ResponseEntity<Void> rejectApplication(@PathVariable UUID applicationId, @RequestBody @Valid RejectDTO rejectDTO) {
        applicationEvaluationService.rejectApplication(applicationId, rejectDTO, currentUserService.getUser());
        return ResponseEntity.noContent().build();
    }

    /**
     * REST endpoint to retrieve a paginated, sorted, and filtered list of application evaluation overviews
     * for a research group.
     *
     * @param offsetPageDTO the {@link OffsetPageDTO} containing pagination (offset and limit) information
     * @param sortDto       the {@link SortDTO} specifying sorting criteria
     * @param filterDto     the {@link EvaluationFilterDTO} specifying dynamic filters to apply
     * @return a {@link ResponseEntity} containing the {@link ApplicationEvaluationOverviewListDTO}
     */
    @ProfessorOrEmployee
    @GetMapping("/applications")
    public ResponseEntity<ApplicationEvaluationOverviewListDTO> getApplicationsOverviews(
        @ParameterObject @Valid @ModelAttribute OffsetPageDTO offsetPageDTO,
        @ParameterObject @ModelAttribute SortDTO sortDto,
        @ParameterObject @ModelAttribute EvaluationFilterDTO filterDto
    ) {
        UUID researchGroupId = currentUserService.getResearchGroupIdIfMember();

        return ResponseEntity.ok(
            applicationEvaluationService.getAllApplicationsOverviews(researchGroupId, offsetPageDTO, sortDto, filterDto)
        );
    }

    /**
     * REST endpoint to retrieve a paginated, sorted, and filtered list of application evaluation details
     * for a research group.
     *
     * @param offsetPageDTO the {@link OffsetPageDTO} containing pagination (offset and limit) information
     * @param sortDto       the {@link SortDTO} specifying sorting criteria
     * @param filterDto     the {@link EvaluationFilterDTO} specifying dynamic filters to apply
     * @return a {@link ResponseEntity} containing the {@link ApplicationEvaluationDetailListDTO}
     */
    @GetMapping("/application-details")
    @ProfessorOrEmployee
    public ResponseEntity<ApplicationEvaluationDetailListDTO> getApplicationsDetails(
        @ParameterObject @Valid @ModelAttribute OffsetPageDTO offsetPageDTO,
        @ParameterObject @ModelAttribute SortDTO sortDto,
        @ParameterObject @ModelAttribute EvaluationFilterDTO filterDto
    ) {
        UUID researchGroupId = currentUserService.getResearchGroupIdIfMember();

        return ResponseEntity.ok(applicationEvaluationService.getApplicationsDetails(researchGroupId, offsetPageDTO, sortDto, filterDto));
    }

    /**
     * REST endpoint to retrieve a window of applications centered around a specific application ID.
     * Applies sorting and dynamic filtering based on request parameters.
     *
     * @param applicationId the ID of the application to center the window on
     * @param windowSize    the size of the window (must be a positive odd integer)
     * @param sortDto       the {@link SortDTO} specifying sorting criteria
     * @param filterDto     the {@link EvaluationFilterDTO} specifying dynamic filters to apply
     * @return a {@link ResponseEntity} containing the {@link ApplicationEvaluationDetailListDTO}
     */
    @ProfessorOrEmployee
    @GetMapping("/application-details/window")
    public ResponseEntity<ApplicationEvaluationDetailListDTO> getApplicationsDetailsWindow(
        @RequestParam UUID applicationId,
        @RequestParam int windowSize,
        @ParameterObject @ModelAttribute SortDTO sortDto,
        @ParameterObject @ModelAttribute EvaluationFilterDTO filterDto
    ) {
        UUID researchGroupId = currentUserService.getResearchGroupIdIfMember();

        return ResponseEntity.ok(
            applicationEvaluationService.getApplicationsDetailsWindow(applicationId, windowSize, researchGroupId, sortDto, filterDto)
        );
    }

    /**
     * Marks the specified application as IN_REVIEW if its current state is SENT.
     *
     * @param applicationId the ID of the application to update
     * @return 204 No Content if the update was processed successfully
     */
    @ProfessorOrEmployee
    @PutMapping("/applications/{applicationId}/open")
    public ResponseEntity<Void> markApplicationAsInReview(@PathVariable UUID applicationId) {
        applicationEvaluationService.markApplicationAsInReview(applicationId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Streams all documents of the specified application as a single ZIP file
     * to the HTTP response output stream.
     *
     * @param applicationId the ID of the application whose documents are downloaded
     * @param response      the HTTP response used to write the ZIP content
     * @throws IOException if an I/O error occurs while writing to the response
     */
    @ApiResponses(
        {
            @ApiResponse(
                responseCode = "200",
                description = "ZIP file containing all documents",
                content = @Content(mediaType = "application/zip", schema = @Schema(type = "string", format = "binary"))
            ),
        }
    )
    @ProfessorOrEmployee
    @GetMapping(path = "/applications/{applicationId}/documents-download", produces = "application/zip")
    public void downloadAll(@PathVariable("applicationId") UUID applicationId, HttpServletResponse response) throws IOException {
        applicationEvaluationService.downloadAllDocumentsForApplication(applicationId, response);
    }

    /**
     * Get all unique job names for the current research group.
     * Used for filter dropdown options.
     *
     * @return ResponseEntity with list of job names
     */
    @ProfessorOrEmployee
    @GetMapping("/job-names")
    public ResponseEntity<List<String>> getAllJobNames() {
        UUID researchGroupId = currentUserService.getResearchGroupIdIfMember();

        List<String> jobNames = applicationEvaluationService.getAllJobNames(researchGroupId);
        return ResponseEntity.ok(jobNames);
    }
}
