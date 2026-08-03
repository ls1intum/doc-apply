package de.tum.cit.aet.job.web;

import de.tum.cit.aet.core.dto.PageDTO;
import de.tum.cit.aet.core.dto.SortDTO;
import de.tum.cit.aet.core.security.annotations.Admin;
import de.tum.cit.aet.core.security.annotations.ProfessorOrEmployeeOrAdmin;
import de.tum.cit.aet.core.security.annotations.Public;
import de.tum.cit.aet.job.constants.JobState;
import de.tum.cit.aet.job.dto.*;
import de.tum.cit.aet.job.service.JobService;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for managing job postings.
 * Provides endpoints for creating, updating, deleting, and retrieving jobs.
 */
@Slf4j
@RestController
@RequestMapping("/api/jobs")
public class JobResource {

    private final JobService jobService;

    public JobResource(JobService jobService) {
        this.jobService = jobService;
    }

    /**
     * {@code GET /api/jobs/available} : Returns a paginated list of all available
     * (PUBLISHED) job postings.
     *
     * <p>
     * Supports filtering by title, subject area, campus location, professor
     * name, and workload.
     * Supports sorting using the {@link SortDTO} for fields such as title,
     * workload, etc.
     * Computed fields like professor name must be handled manually.
     * </p>
     *
     * @param pageDTO                the pagination information including page
     *                               number (zero-based) and page size
     * @param availableJobsFilterDTO DTO containing all optionally filterable fields
     * @param sortDTO                sorting parameter containing the field and
     *                               direction
     * @param searchQuery            string to search for job title, subject area
     *                               or supervisor name
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} containing a
     *         {@link Page} of {@link JobCardDTO}
     */
    @Public
    @GetMapping("/available")
    public ResponseEntity<Page<JobCardDTO>> getAvailableJobs(
        @ParameterObject @Valid @ModelAttribute PageDTO pageDTO,
        @ParameterObject @Valid @ModelAttribute AvailableJobsFilterDTO availableJobsFilterDTO,
        @ParameterObject @Valid @ModelAttribute SortDTO sortDTO,
        @RequestParam(required = false) String searchQuery
    ) {
        log.info("GET /api/jobs/available - Fetching available jobs");
        Page<JobCardDTO> jobs = jobService.getAvailableJobs(pageDTO, availableJobsFilterDTO, sortDTO, searchQuery);
        return ResponseEntity.ok(jobs);
    }

    /**
     * {@code GET /api/jobs/filters} : Returns all available filter options for jobs
     *
     * This endpoint provides all unique filter values that can be used in the job
     * filters
     * It returns subject areas and supervisor names from all
     * published jobs
     * to populate dropdown menus and filter components on the client side.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} containing a
     *         {@link JobFiltersDTO} with all available filter options
     */
    @Public
    @GetMapping("/filters")
    public ResponseEntity<JobFiltersDTO> getAllFilters() {
        log.info("GET /api/jobs/filters - Fetching all job filter options");
        JobFiltersDTO dto = new JobFiltersDTO(jobService.getAllSubjectAreas(), jobService.getAllSupervisorNames());
        return ResponseEntity.ok(dto);
    }

    /**
     * {@code POST /api/jobs} : Create a new job posting.
     *
     * @param jobForm the job posting data.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)}.
     */
    @ProfessorOrEmployeeOrAdmin
    @PostMapping("/create")
    public ResponseEntity<JobFormDTO> createJob(@RequestBody JobFormDTO jobForm) {
        log.info("POST /api/jobs/create - Creating new job");
        JobFormDTO createdJob = jobService.createJob(jobForm);
        return ResponseEntity.ok(createdJob);
    }

    /*
     * {@code PUT /api/jobs/update/{jobId}} : Update an existing job posting.
     *
     * @param jobId the ID of the job to update.
     *
     * @param jobForm the updated job posting data.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the
     * updated job.
     */
    @ProfessorOrEmployeeOrAdmin
    @PutMapping("/update/{jobId}")
    public ResponseEntity<JobFormDTO> updateJob(@PathVariable UUID jobId, @RequestBody JobFormDTO jobForm) {
        log.info("PUT /api/jobs/update/{} - Updating job", jobId);
        JobFormDTO updatedJob = jobService.updateJob(jobId, jobForm);
        return ResponseEntity.ok(updatedJob);
    }

    /**
     * {@code DELETE /api/jobs/{jobId}} : Delete a job posting.
     *
     * @param jobId the ID of the job to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (No Content)}.
     */
    @ProfessorOrEmployeeOrAdmin
    @DeleteMapping("/{jobId}")
    public ResponseEntity<Void> deleteJob(@PathVariable UUID jobId) {
        log.info("DELETE /api/jobs/{} - Deleting job", jobId);
        jobService.deleteJob(jobId);
        return ResponseEntity.noContent().build();
    }

    /**
     * {@code PUT /api/jobs/changeState/{jobId}} : Change the state of a job posting
     * and optionally reject all associated applications.
     *
     * @param jobId                             the ID of the job to delete.
     * @param jobState                          the new state that the job should be
     *                                          updated with.
     * @param shouldRejectRemainingApplications the boolean representing whether all
     *                                          corresponding published applications
     *                                          should be deleted or not, if the new
     *                                          job state is APPLICANT_FOUND
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the
     *         updated job.
     */
    @ProfessorOrEmployeeOrAdmin
    @PutMapping("/changeState/{jobId}")
    public ResponseEntity<JobFormDTO> changeJobState(
        @PathVariable UUID jobId,
        @RequestParam JobState jobState,
        @RequestParam(required = false) boolean shouldRejectRemainingApplications
    ) {
        log.info("PUT /api/jobs/changeState/{} - Changing job state to {}", jobId, jobState);
        JobFormDTO updatedJob = jobService.changeJobState(jobId, jobState, shouldRejectRemainingApplications);
        return ResponseEntity.ok(updatedJob);
    }

    /**
     * {@code GET /api/jobs/research-group} : Returns a paginated list of jobs for
     * the current user's research group.
     *
     * <p>
     * Supports optional filtering by title and job state. Sorting is supported
     * using {@link SortDTO}.
     * </p>
     *
     * @param pageDTO                pagination parameters including page number and
     *                               size
     * @param professorJobsFilterDTO DTO containing all optionally filterable fields
     * @param sortDTO                sorting parameter
     * @param searchQuery            string to search for supervising professor or
     *                               job title
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} containing a
     *         {@link Page} of {@link CreatedJobDTO}
     */
    @ProfessorOrEmployeeOrAdmin
    @GetMapping("/research-group")
    public ResponseEntity<Page<CreatedJobDTO>> getJobsForCurrentResearchGroup(
        @ParameterObject @Valid @ModelAttribute PageDTO pageDTO,
        @ParameterObject @Valid @ModelAttribute ProfessorJobsFilterDTO professorJobsFilterDTO,
        @ParameterObject @Valid @ModelAttribute SortDTO sortDTO,
        @RequestParam(required = false) String searchQuery
    ) {
        log.info("GET /api/jobs/research-group - Fetching jobs for current research group");
        return ResponseEntity.ok(jobService.getJobsForCurrentResearchGroup(pageDTO, professorJobsFilterDTO, sortDTO, searchQuery));
    }

    /**
     * Returns a paginated list of all jobs across every research group.
     *
     * @param pageDTO     pagination parameters including page number and size
     * @param adminFilter DTO containing all optionally filterable fields (states,
     *                    researchGroupIds, supervisingProfessorIds)
     * @param sortDTO     sorting parameter
     * @param searchQuery string to search for supervising professor or job title
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} containing a
     *         {@link Page} of {@link AdminCreatedJobDTO}
     */
    @Admin
    @GetMapping("/all")
    public ResponseEntity<Page<AdminCreatedJobDTO>> getAllJobs(
        @ParameterObject @Valid @ModelAttribute PageDTO pageDTO,
        @ParameterObject @Valid @ModelAttribute AdminJobsFilterDTO adminFilter,
        @ParameterObject @Valid @ModelAttribute SortDTO sortDTO,
        @RequestParam(required = false) String searchQuery
    ) {
        log.info("GET /api/jobs/all - Fetching all jobs for admin");
        return ResponseEntity.ok(jobService.getAllJobs(pageDTO, adminFilter, sortDTO, searchQuery));
    }

    /**
     * {@code GET /api/jobs/{jobId}} : Get general details of a specific job.
     *
     * @param jobId the ID of the job.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the job
     *         details.
     */
    @ProfessorOrEmployeeOrAdmin
    @GetMapping("/{jobId}")
    public ResponseEntity<JobDTO> getJobById(@PathVariable UUID jobId) {
        log.info("GET /api/jobs/{} - Fetching job details", jobId);
        return ResponseEntity.ok(jobService.getJobById(jobId));
    }

    /**
     * {@code GET /api/jobs/detail/{jobId}} : Get all details of a specific job
     * which are relevant to the Job Detail Page.
     *
     * @param jobId the ID of the job.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the job
     *         details.
     */
    @Public
    @GetMapping("/detail/{jobId}")
    public ResponseEntity<JobDetailDTO> getJobDetails(@PathVariable UUID jobId) {
        log.info("GET /api/jobs/detail/{} - Fetching job detail page data", jobId);
        return ResponseEntity.ok(jobService.getJobDetails(jobId));
    }
}
