package de.tum.cit.aet.job.service;

import de.tum.cit.aet.ai.domain.ComplianceIssue;
import de.tum.cit.aet.application.constants.ApplicationState;
import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.application.repository.ApplicationRepository;
import de.tum.cit.aet.core.constants.Language;
import de.tum.cit.aet.core.domain.DepartmentImage;
import de.tum.cit.aet.core.domain.Image;
import de.tum.cit.aet.core.dto.PageDTO;
import de.tum.cit.aet.core.dto.SortDTO;
import de.tum.cit.aet.core.exception.AccessDeniedException;
import de.tum.cit.aet.core.exception.EntityNotFoundException;
import de.tum.cit.aet.core.service.CurrentUserService;
import de.tum.cit.aet.core.service.ImageService;
import de.tum.cit.aet.core.util.HtmlSanitizer;
import de.tum.cit.aet.core.util.PageUtil;
import de.tum.cit.aet.core.util.StringUtil;
import de.tum.cit.aet.evaluation.constants.RejectReason;
import de.tum.cit.aet.interview.service.InterviewService;
import de.tum.cit.aet.job.constants.JobState;
import de.tum.cit.aet.job.constants.RecommendationType;
import de.tum.cit.aet.job.constants.SubjectArea;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.job.dto.*;
import de.tum.cit.aet.job.repository.JobRepository;
import de.tum.cit.aet.notification.constants.EmailType;
import de.tum.cit.aet.notification.dto.JobPublicationEmailContextDTO;
import de.tum.cit.aet.notification.service.AsyncEmailSender;
import de.tum.cit.aet.notification.service.EmailSettingService;
import de.tum.cit.aet.notification.service.mail.Email;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.dto.ResearchGroupSummaryDTO;
import de.tum.cit.aet.usermanagement.repository.ApplicantRepository;
import de.tum.cit.aet.usermanagement.repository.ResearchGroupRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class JobService {

    private final JobRepository jobRepository;
    private final UserRepository userRepository;
    private final ApplicantRepository applicantRepository;
    private final ResearchGroupRepository researchGroupRepository;
    private final CurrentUserService currentUserService;
    private final AsyncEmailSender sender;
    private final EmailSettingService emailSettingService;
    private final ApplicationRepository applicationRepository;
    private final InterviewService interviewService;
    private final JobImageHelper jobImageHelper;
    private final ImageService imageService;

    /**
     * Creates a new job using the provided job form data.
     *
     * @param dto the job details used to create the job
     * @return the created job as a {@link JobFormDTO}
     */
    public JobFormDTO createJob(JobFormDTO dto) {
        Job job = new Job();
        return updateJobEntity(job, dto);
    }

    /**
     * Updates an existing job with the new form data.
     *
     * @param jobId the ID of the job to update
     * @param dto   the {@link JobFormDTO} containing updated job details
     * @return the updated job as a {@link JobFormDTO}
     */
    public JobFormDTO updateJob(UUID jobId, JobFormDTO dto) {
        Job job = assertCanManageJob(jobId);
        return updateJobEntity(job, dto);
    }

    /**
     * Changes the state of a job to the specified target state.
     * If the job is being closed or if explicitly requested, all pending
     * application states
     * (i.e., in 'SAVED', 'SENT' or 'IN_REVIEW' state) for the job will be
     * automatically updated.
     *
     * @param jobId                             the ID of the job whose state is to
     *                                          be changed
     * @param targetState                       the new {@link JobState} to apply to
     *                                          the job
     * @param shouldRejectRemainingApplications flag indicating whether remaining
     *                                          pending applications should be
     *                                          rejected
     * @return the updated job as a {@link JobFormDTO}
     */
    public JobFormDTO changeJobState(UUID jobId, JobState targetState, boolean shouldRejectRemainingApplications) {
        Job job = assertCanManageJob(jobId);
        JobState oldState = job.getState();
        job.setState(targetState);

        if (targetState == JobState.CLOSED) {
            // send emails stating that the job has been closed, to all applicants whose
            // application was 'SENT' or 'IN_REVIEW'
            Set<Application> applicationsToNotify = applicationRepository.findApplicantsToNotify(jobId);

            // update the state of all submitted and unsubmitted applications to
            // 'JOB_CLOSED'
            applicationRepository.updateApplicationsForJob(jobId, targetState.getValue());

            notifyApplicants(applicationsToNotify, RejectReason.JOB_OUTDATED);
        } else if (targetState == JobState.APPLICANT_FOUND && shouldRejectRemainingApplications) {
            // send rejection emails to all applicants whose application was 'SENT' or
            // 'IN_REVIEW'
            Set<Application> applicationsToNotify = applicationRepository.findApplicantsToNotify(jobId);

            // update the state of all submitted applications to 'REJECTED', all unsubmitted
            // applications to 'JOB_CLOSED'
            applicationRepository.updateApplicationsForJob(jobId, targetState.getValue());

            notifyApplicants(applicationsToNotify, RejectReason.JOB_FILLED);
        }

        Job savedJob = jobRepository.save(job);
        if (savedJob.getState() == JobState.PUBLISHED && oldState != JobState.PUBLISHED) {
            notifySubjectAreaSubscribers(savedJob);
        }
        return JobFormDTO.getFromEntity(savedJob);
    }

    private void notifyApplicants(Set<Application> applications, RejectReason reason) {
        for (Application application : applications) {
            User user = application.getApplicant().getUser();
            Email email = Email.builder()
                .to(user)
                .language(Language.fromCode(user.getSelectedLanguage()))
                .emailType(reason.toEmailType())
                .content(application)
                .build();
            sender.sendAsync(email);
        }
    }

    /**
     * Deletes a job posting by ID.
     *
     * @param jobId the ID of the job to delete
     */
    public void deleteJob(UUID jobId) {
        assertCanManageJob(jobId);

        // Get the job to check if it has an associated image
        Job job = jobRepository.findById(jobId).orElseThrow(() -> new EntityNotFoundException("Job not found"));

        // Delete associated image if it exists and is not a default image
        if (job.getImage() != null && !(job.getImage() instanceof DepartmentImage)) {
            try {
                imageService.deleteWithoutChecks(job.getImage().getImageId());
            } catch (Exception _) {}
        }

        jobRepository.deleteById(jobId);
    }

    /**
     * Returns a JobDTO given the job id.
     * Job description fields are sanitized on read before sending to the client.
     *
     * @param jobId the ID of the job
     * @return the job DTO with general job information
     */
    public JobDTO getJobById(UUID jobId) {
        Job job = assertCanManageJob(jobId);
        return new JobDTO(
            job.getJobId(),
            job.getTitle(),
            job.getResearchArea(),
            job.getSubjectArea(),
            job.getSupervisingProfessor().getUserId(),
            job.getLocation(),
            job.getStartDate(),
            job.getEndDate(),
            job.getWorkload(),
            job.getContractDuration(),
            job.getFundingType(),
            job.getTvlGrade(),
            HtmlSanitizer.sanitize(job.getJobDescriptionEN()),
            HtmlSanitizer.sanitize(job.getJobDescriptionDE()),
            job.getState(),
            job.getImage() != null ? job.getImage().getImageId() : null,
            job.getImage() != null ? job.getImage().getUrl() : null,
            job.getSuitableForDisabled(),
            job.getStartDateByArrangement(),
            job.getReferenceLettersRequired(),
            job.getRecommendationType(),
            job.getGenderBiasScore(),
            job.getComplianceIssues()
        );
    }

    /**
     * Returns a JobDetailDTO given the job id.
     * Job description fields are sanitized on read before sending to the client.
     *
     * @param jobId the ID of the job
     * @return the job detail DTO with detailed job information
     */
    public JobDetailDTO getJobDetails(UUID jobId) {
        // CurrentUserService is a request-scoped proxy; calling it from a
        // background task thread (e.g. the admin bulk export running on
        // taskExecutor) throws BeanCreationException at proxy-resolution
        // time — before getUserIdIfAvailable's own try/catch runs. Treat
        // "no active request" as "anonymous caller": the userId is only
        // used downstream to look up the caller's own application state
        // for the "already applied" indicator, which is irrelevant in an
        // off-request context.
        UUID userId;
        try {
            userId = currentUserService.getUserIdIfAvailable().orElse(null);
        } catch (Exception e) {
            userId = null;
        }
        Job job = jobRepository.findById(jobId).orElseThrow(() -> EntityNotFoundException.forId("Job", jobId));

        UUID applicationId = null;
        ApplicationState applicationState = null;

        if (userId != null) {
            Application application = applicationRepository.getByApplicantByUserIdAndJobId(userId, jobId);
            if (application != null) {
                applicationId = application.getApplicationId();
                applicationState = application.getState();
            }
        }
        return new JobDetailDTO(
            job.getJobId(),
            job.getSupervisingProfessor().getFirstName() + " " + job.getSupervisingProfessor().getLastName(),
            ResearchGroupSummaryDTO.getFromEntity(job.getResearchGroup()),
            job.getTitle(),
            job.getSubjectArea(),
            job.getResearchArea(),
            job.getLocation(),
            job.getWorkload(),
            job.getContractDuration(),
            job.getFundingType(),
            job.getTvlGrade(),
            HtmlSanitizer.sanitize(job.getJobDescriptionEN()),
            HtmlSanitizer.sanitize(job.getJobDescriptionDE()),
            job.getStartDate(),
            job.getEndDate(),
            job.getCreatedAt(),
            job.getLastModifiedAt(),
            job.getState(),
            applicationId,
            applicationState,
            job.getSuitableForDisabled(),
            job.getStartDateByArrangement(),
            job.getReferenceLettersRequired(),
            job.getRecommendationType(),
            job.getImage() != null ? job.getImage().getImageId() : null
        );
    }

    /**
     * Returns a paginated list of all available (PUBLISHED) jobs.
     * Supports filtering by multiple fields and dynamic sorting, including manual
     * sort for professor name.
     *
     * @param pageDTO                pagination configuration
     * @param availableJobsFilterDTO DTO containing all optionally filterable fields
     * @param sortDTO                sort configuration (by field and direction)
     * @param searchQuery            string to search for job title, subject area
     *                               or supervisor name
     * @return a page of {@link JobCardDTO} matching the criteria
     */
    public Page<JobCardDTO> getAvailableJobs(
        PageDTO pageDTO,
        AvailableJobsFilterDTO availableJobsFilterDTO,
        SortDTO sortDTO,
        String searchQuery
    ) {
        UUID userId = currentUserService.getUserIdIfAvailable().orElse(null);
        Pageable pageable;

        String normalizedSearchQuery = StringUtil.normalizeSearchQuery(searchQuery);
        List<SubjectArea> searchSubjectAreas = normalizedSearchQuery != null ? SubjectArea.search(normalizedSearchQuery) : null;
        if (searchSubjectAreas != null && searchSubjectAreas.isEmpty()) {
            searchSubjectAreas = null;
        }
        List<SubjectArea> subjectAreas = availableJobsFilterDTO.subjectAreas();
        if (subjectAreas != null && subjectAreas.isEmpty()) {
            subjectAreas = null;
        }

        if (sortDTO.sortBy() != null && sortDTO.sortBy().equals("professorName")) {
            // Use pageable without sort: Sorting will be handled manually in @Query
            pageable = PageUtil.createPageRequest(pageDTO, null, null, false);
            return jobRepository.findAllJobCardsByState(
                JobState.PUBLISHED,
                subjectAreas,
                availableJobsFilterDTO.locations(), // filter for campus location
                availableJobsFilterDTO.professorNames(), // filter for supervising professor's full name
                sortDTO.sortBy(),
                sortDTO.direction().name(),
                userId,
                normalizedSearchQuery,
                searchSubjectAreas,
                pageable
            );
        } else {
            // Sort dynamically via Pageable
            pageable = PageUtil.createPageRequest(pageDTO, sortDTO, PageUtil.ColumnMapping.AVAILABLE_JOBS, true);
            return jobRepository.findAllJobCardsByState(
                JobState.PUBLISHED,
                subjectAreas,
                availableJobsFilterDTO.locations(), // optional filter for campus location
                availableJobsFilterDTO.professorNames(), // optional filter for supervising professor's full name
                userId,
                normalizedSearchQuery,
                searchSubjectAreas,
                pageable
            );
        }
    }

    /**
     * Retrieves all unique subject areas.
     * This is used for filter dropdown options and should not be affected by
     * current filters.
     *
     * @return a list of all unique subject areas sorted
     * alphabetically
     */
    public List<SubjectArea> getAllSubjectAreas() {
        return jobRepository.findAllUniqueSubjectAreas(JobState.PUBLISHED);
    }

    /**
     * Retrieves all unique supervisor names
     * This is used for filter dropdown options and should not be affected by
     * current filters.
     *
     * @return a list of all unique supervisor names sorted
     * alphabetically
     */
    public List<String> getAllSupervisorNames() {
        return jobRepository.findAllUniqueSupervisorNames(JobState.PUBLISHED);
    }

    /**
     * Returns a paginated list of jobs for the current user's research group (professor or employee).
     * Supports optional filtering and dynamic sorting.
     *
     * @param pageDTO                pagination configuration
     * @param professorJobsFilterDTO DTO containing all optionally filterable fields
     * @param sortDTO                sorting configuration
     * @param searchQuery            search string for supervising professor or job
     *                               title
     * @return a page of {@link CreatedJobDTO} for the research group's jobs
     */
    public Page<CreatedJobDTO> getJobsForCurrentResearchGroup(
        PageDTO pageDTO,
        ProfessorJobsFilterDTO professorJobsFilterDTO,
        SortDTO sortDTO,
        String searchQuery
    ) {
        UUID researchGroupId = currentUserService.getResearchGroupIdIfMember();
        Pageable pageable = PageUtil.createPageRequest(pageDTO, sortDTO, PageUtil.ColumnMapping.PROFESSOR_JOBS, true);
        List<JobState> enumStates = null;
        if (professorJobsFilterDTO.states() != null && !professorJobsFilterDTO.states().isEmpty()) {
            enumStates = professorJobsFilterDTO.states().stream().map(JobState::fromValue).filter(Objects::nonNull).toList();
        }
        String normalizedSearchQuery = StringUtil.normalizeSearchQuery(searchQuery);
        return jobRepository.findAllJobsByResearchGroup(researchGroupId, enumStates, normalizedSearchQuery, pageable);
    }

    /**
     * Returns a paginated list of jobs across every research group for admin views.
     * Supports optional filters for state, research group, and supervising professor,
     * plus a search string matching job title or professor full name.
     *
     * @param pageDTO          pagination configuration
     * @param adminFilter      DTO containing all optionally filterable fields
     * @param sortDTO          sorting configuration
     * @param searchQuery      search string for supervising professor or job title
     * @return a page of {@link AdminCreatedJobDTO} matching the criteria
     */
    public Page<AdminCreatedJobDTO> getAllJobs(PageDTO pageDTO, AdminJobsFilterDTO adminFilter, SortDTO sortDTO, String searchQuery) {
        Pageable pageable = PageUtil.createPageRequest(pageDTO, sortDTO, PageUtil.ColumnMapping.PROFESSOR_JOBS, true);
        List<JobState> enumStates = null;
        if (adminFilter.states() != null && !adminFilter.states().isEmpty()) {
            enumStates = adminFilter.states().stream().map(JobState::fromValue).filter(Objects::nonNull).toList();
        }
        List<UUID> researchGroupIds = (adminFilter.researchGroupIds() == null || adminFilter.researchGroupIds().isEmpty())
            ? null
            : adminFilter.researchGroupIds();
        List<UUID> supervisingProfessorIds = (adminFilter.supervisingProfessorIds() == null ||
            adminFilter.supervisingProfessorIds().isEmpty())
            ? null
            : adminFilter.supervisingProfessorIds();
        String normalizedSearchQuery = StringUtil.normalizeSearchQuery(searchQuery);
        return jobRepository.findAllJobsForAdmin(enumStates, researchGroupIds, supervisingProfessorIds, normalizedSearchQuery, pageable);
    }

    private JobFormDTO updateJobEntity(Job job, JobFormDTO dto) {
        User supervisingProfessor = userRepository.findWithResearchGroupRolesByUserIdElseThrow(dto.supervisingProfessor());
        // Ensure that the current user is either an admin or a research group member of
        // the supervising professor
        currentUserService.isAdminOrMemberOfResearchGroupOfProfessor(supervisingProfessor);
        JobState oldState = job.getState();

        // 1. Resolve the active research group of the editor: a job belongs to the group
        //    the user is currently acting on behalf of, not to some implicit "primary" group.
        UUID activeResearchGroupId = currentUserService.getActiveResearchGroupId();

        // 2. The supervising professor must be a member of that same active group.
        boolean professorIsMember = supervisingProfessor
            .getResearchGroupRoles()
            .stream()
            .anyMatch(
                role -> role.getResearchGroup() != null && activeResearchGroupId.equals(role.getResearchGroup().getResearchGroupId())
            );
        if (!professorIsMember) {
            throw new AccessDeniedException("Supervising professor is not a member of the active research group");
        }

        job.setSupervisingProfessor(supervisingProfessor);
        job.setResearchGroup(
            researchGroupRepository
                .findById(activeResearchGroupId)
                .orElseThrow(() -> EntityNotFoundException.forId("ResearchGroup", activeResearchGroupId))
        );
        job.setTitle(dto.title());
        job.setResearchArea(dto.researchArea());
        job.setSubjectArea(dto.subjectArea());
        job.setLocation(dto.location());
        job.setStartDate(dto.startDate());
        job.setEndDate(dto.endDate());
        job.setWorkload(dto.workload());
        job.setContractDuration(dto.contractDuration());
        job.setFundingType(dto.fundingType());
        job.setTvlGrade(dto.tvlGrade());
        job.setJobDescriptionEN(HtmlSanitizer.sanitize(dto.jobDescriptionEN()));
        job.setJobDescriptionDE(HtmlSanitizer.sanitize(dto.jobDescriptionDE()));
        job.setState(dto.state());
        job.setSuitableForDisabled(dto.suitableForDisabled());
        job.setStartDateByArrangement(Boolean.TRUE.equals(dto.startDateByArrangement()));
        int referenceLettersRequired = Objects.requireNonNullElse(dto.referenceLettersRequired(), 0);
        job.setReferenceLettersRequired(referenceLettersRequired);
        job.setRecommendationType(
            referenceLettersRequired > 0
                ? Objects.requireNonNullElse(dto.recommendationType(), RecommendationType.LETTER_AND_EVALUATION)
                : null
        );

        // Capture old image before any modifications
        Image oldImage = job.getImage();

        // Update image reference (read-only lookup from imageRepository)
        if (dto.imageId() != null) {
            job.setImage(jobImageHelper.getImageForJob(dto.imageId()));
        } else {
            job.setImage(null);
        }

        // Save job entity first (single repository write)
        Job savedJob = jobRepository.save(job);

        if (dto.state() == JobState.PUBLISHED && oldState != JobState.PUBLISHED) {
            interviewService.createInterviewProcessForJob(savedJob.getJobId());
            notifySubjectAreaSubscribers(savedJob);
        }

        // Clean up old image after job is persisted (separate from job persistence)
        jobImageHelper.replaceJobImage(oldImage, savedJob.getImage());

        return JobFormDTO.getFromEntity(savedJob);
    }

    private void notifySubjectAreaSubscribers(Job job) {
        Set<User> candidates = applicantRepository.findAllBySubjectAreaSubscription(job.getSubjectArea());
        if (candidates.isEmpty()) {
            return;
        }

        // 1) Collect candidate user IDs in one pass.
        // 2) Resolve the enabled subset in a single query.
        // 3) Fan out the async emails only to that subset.
        Set<UUID> candidateIds = candidates.stream().map(User::getUserId).collect(Collectors.toSet());
        Set<UUID> enabledIds = emailSettingService.filterEnabledUserIds(EmailType.JOB_PUBLISHED_SUBJECT_AREA, candidateIds);

        candidates
            .stream()
            .filter(user -> enabledIds.contains(user.getUserId()))
            .forEach(user ->
                sender.sendAsync(
                    Email.builder()
                        .to(user)
                        .emailType(EmailType.JOB_PUBLISHED_SUBJECT_AREA)
                        .content(JobPublicationEmailContextDTO.fromEntities(user, job))
                        .language(Language.fromCode(user.getSelectedLanguage()))
                        .sendAlways(true)
                        .build()
                )
            );
    }

    /**
     * Asserts that the current user can manage the job with the given ID.
     *
     * @param jobId the ID of the job to check
     * @return the job entity if the user can manage it
     */
    private Job assertCanManageJob(UUID jobId) {
        Job job = jobRepository.findByIdWithCompliance(jobId).orElseThrow(() -> EntityNotFoundException.forId("Job", jobId));
        currentUserService.isAdminOrMemberOf(job.getResearchGroup());
        return job;
    }

    /**
     * Updates the job description of a job in the specified language.
     * The translated text is sanitized to remove unsafe HTML before persisting.
     *
     * @param jobId          the ID of the job to update
     * @param toLang         the target language ("de" or "en")
     * @param translatedText the translated job description text
     */
    public void updateJobDescriptionLanguage(String jobId, String toLang, String translatedText) {
        Job job = jobRepository.findById(UUID.fromString(jobId)).orElseThrow(() -> EntityNotFoundException.forId("Job", jobId));
        String sanitized = HtmlSanitizer.sanitize(translatedText);
        if ("de".equalsIgnoreCase(toLang)) {
            job.setJobDescriptionDE(sanitized);
        } else if ("en".equalsIgnoreCase(toLang)) {
            job.setJobDescriptionEN(sanitized);
        }
        jobRepository.save(job);
    }

    /**
     * Updates AI-generated analysis fields for a job: replaces the compliance
     * issues for the given language and overwrites the combined gender bias score.
     *
     * @param jobId               the job identifier
     * @param score               the combined AI score to persist
     * @param complianceAnalysis  compliance issues detected for the given language
     * @param lang                the analyzed language ("de" or "en")
     */
    public void updateAiAnalysis(UUID jobId, int score, List<ComplianceIssue> complianceAnalysis, String lang) {
        applyJobChangeForAnalysis(jobId, job -> {
            replaceComplianceIssuesForLanguage(job, complianceAnalysis, lang);
            job.setGenderBiasScore(score);
        });
    }

    /**
     * Replaces the compliance issues for a single language without touching the
     * gender bias score. Used by the snippet-mapping flow, where the score has
     * already been written by the source-language analysis and must not be reset.
     *
     * @param jobId               the job identifier
     * @param complianceAnalysis  compliance issues for the target language
     * @param lang                the target language ("de" or "en")
     */
    public void updateComplianceIssues(UUID jobId, List<ComplianceIssue> complianceAnalysis, String lang) {
        applyJobChangeForAnalysis(jobId, job -> replaceComplianceIssuesForLanguage(job, complianceAnalysis, lang));
    }

    /**
     * Loads the job, applies the given change, and persists in a single repository write.
     */
    private void applyJobChangeForAnalysis(UUID jobId, Consumer<Job> changes) {
        if (jobId == null) {
            return;
        }
        Job job = jobRepository.findByIdWithCompliance(jobId).orElseThrow(() -> EntityNotFoundException.forId("Job", jobId));
        currentUserService.isAdminOrMemberOf(job.getResearchGroup());
        changes.accept(job);
        jobRepository.save(job);
    }

    /**
     * Replaces compliance issues for the given language.
     * Issues from other languages stay unchanged.
     * Updates the job in place and caller saves it.
     */
    private void replaceComplianceIssuesForLanguage(Job job, List<ComplianceIssue> complianceAnalysis, String lang) {
        List<ComplianceIssue> issuesToSave = job
            .getComplianceIssues()
            .stream()
            .filter(issue -> !Objects.equals(issue.getLanguage(), lang))
            .collect(Collectors.toCollection(ArrayList::new));
        issuesToSave.addAll(complianceAnalysis);
        job.setComplianceIssues(issuesToSave);
    }
}
