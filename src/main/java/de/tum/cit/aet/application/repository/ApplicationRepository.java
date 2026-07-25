package de.tum.cit.aet.application.repository;

import de.tum.cit.aet.application.constants.ApplicationState;
import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.application.domain.dto.AdminApplicationOverviewDTO;
import de.tum.cit.aet.application.domain.dto.ApplicationForApplicantDTO;
import de.tum.cit.aet.application.domain.dto.ApplicationOverviewDTO;
import de.tum.cit.aet.core.repository.TumApplyJpaRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/**
 * Spring Data JPA repository for the {@link Application} entity.
 */
@Repository
public interface ApplicationRepository extends TumApplyJpaRepository<Application, UUID> {
    @Query(
        """
            SELECT new de.tum.cit.aet.application.domain.dto.ApplicationForApplicantDTO(
                a.applicationId,
                new de.tum.cit.aet.usermanagement.dto.ApplicantDTO(
                    new de.tum.cit.aet.usermanagement.dto.UserDTO(
                        ap.user.userId,
                        a.applicantEmail,
                        ap.user.avatar,
                        a.applicantFirstName,
                        a.applicantLastName,
                        a.applicantGender,
                        a.applicantNationality,
                        a.applicantBirthday,
                        a.applicantPhoneNumber,
                        a.applicantWebsite,
                        a.applicantLinkedinUrl,
                        ap.user.selectedLanguage,
                        NULL
                    ),
                    a.applicantStreet,
                    a.applicantPostalCode,
                    a.applicantCity,
                    a.applicantCountry,
                    a.applicantBachelorDegreeName,
                    a.applicantBachelorGradeUpperLimit,
                    a.applicantBachelorGradeLowerLimit,
                    a.applicantBachelorGrade,
                    a.applicantBachelorUniversity,
                    a.applicantMasterDegreeName,
                    a.applicantMasterGradeUpperLimit,
                    a.applicantMasterGradeLowerLimit,
                    a.applicantMasterGrade,
                    a.applicantMasterUniversity
                ),
                new de.tum.cit.aet.job.dto.JobCardDTO(
                    j.jobId,
                    j.title,
                    j.location,
                    CONCAT(j.supervisingProfessor.firstName, ' ', j.supervisingProfessor.lastName),
                    j.subjectArea,
                    j.supervisingProfessor.avatar,
                    a.applicationId,
                    a.state,
                    j.workload,
                    j.startDate,
                    j.endDate,
                    j.contractDuration,
                    j.referenceLettersRequired,
                    j.recommendationType,
                    i.url
                ),
                a.state,
                a.desiredStartDate,
                a.projects,
                a.specialSkills,
                a.motivation,
                a.referenceLettersConfidential
            )
            FROM Application a
            LEFT JOIN a.applicant ap
            LEFT JOIN a.job j
            LEFT JOIN j.image i
        WHERE a.applicationId = :id
        """
    )
    ApplicationForApplicantDTO findDtoById(@Param("id") UUID id);

    @Query(
        """
            SELECT new de.tum.cit.aet.application.domain.dto.ApplicationForApplicantDTO(
                a.applicationId,
                new de.tum.cit.aet.usermanagement.dto.ApplicantDTO(
                    new de.tum.cit.aet.usermanagement.dto.UserDTO(
                        ap.user.userId,
                        a.applicantEmail,
                        ap.user.avatar,
                        a.applicantFirstName,
                        a.applicantLastName,
                        a.applicantGender,
                        a.applicantNationality,
                        a.applicantBirthday,
                        a.applicantPhoneNumber,
                        a.applicantWebsite,
                        a.applicantLinkedinUrl,
                        ap.user.selectedLanguage,
                        NULL
                    ),
                    a.applicantStreet,
                    a.applicantPostalCode,
                    a.applicantCity,
                    a.applicantCountry,
                    a.applicantBachelorDegreeName,
                    a.applicantBachelorGradeUpperLimit,
                    a.applicantBachelorGradeLowerLimit,
                    a.applicantBachelorGrade,
                    a.applicantBachelorUniversity,
                    a.applicantMasterDegreeName,
                    a.applicantMasterGradeUpperLimit,
                    a.applicantMasterGradeLowerLimit,
                    a.applicantMasterGrade,
                    a.applicantMasterUniversity
                ),
                new de.tum.cit.aet.job.dto.JobCardDTO(
                    j.jobId,
                    j.title,
                    j.location,
                    CONCAT(j.supervisingProfessor.firstName, ' ', j.supervisingProfessor.lastName),
                    j.subjectArea,
                    j.supervisingProfessor.avatar,
                    a.applicationId,
                    a.state,
                    j.workload,
                    j.startDate,
                    j.endDate,
                    j.contractDuration,
                    j.referenceLettersRequired,
                    j.recommendationType,
                    i.url
                ),
                a.state,
                a.desiredStartDate,
                a.projects,
                a.specialSkills,
                a.motivation,
                a.referenceLettersConfidential
            )
            FROM Application a
            LEFT JOIN a.job j
            LEFT JOIN a.applicant ap
            LEFT JOIN j.image i
            WHERE ap.user.userId = :userId AND j.jobId = :jobId
        """
    )
    ApplicationForApplicantDTO getApplicationDtoByApplicantUserIdAndJobJobId(@Param("userId") UUID userId, @Param("jobId") UUID jobId);

    @Modifying
    @Query("UPDATE Application a SET a.state = 'WITHDRAWN' WHERE a.applicationId = :applicationId")
    void withdrawApplicationById(UUID applicationId);

    /**
     * Finds all applicants for a specific job that are in the 'SENT' or 'IN_REVIEW'
     * state.
     * This is used to notify applicants about the job status update.
     *
     * @param jobId the ID of the job for which to find applicants
     * @return a set of {@link Application} containing all important applicant
     *         details
     */
    @Query(
        """
            SELECT a
            FROM Application a
            JOIN a.applicant ap
            WHERE a.job.jobId = :jobId
            AND a.state IN ('SENT', 'IN_REVIEW', 'INTERVIEW')
        """
    )
    Set<Application> findApplicantsToNotify(@Param("jobId") UUID jobId);

    @Transactional
    @Modifying
    @Query(
        """
            UPDATE Application a
            SET a.state =
                CASE
                    WHEN a.state = 'SAVED' THEN 'JOB_CLOSED_DRAFT'
                    WHEN a.state IN ('SENT', 'IN_REVIEW', 'INTERVIEW') AND :targetState = 'CLOSED' THEN 'JOB_CLOSED'
                    WHEN a.state IN ('SENT', 'IN_REVIEW', 'INTERVIEW') AND :targetState = 'APPLICANT_FOUND' THEN 'REJECTED'
                    ELSE a.state
                END
            WHERE a.job.jobId = :jobId
        """
    )
    void updateApplicationsForJob(@Param("jobId") UUID jobId, @Param("targetState") String targetState);

    @Query("SELECT a FROM Application a WHERE a.applicant.user.userId = :userId AND a.job.jobId = :jobId")
    Application getByApplicantByUserIdAndJobId(@Param("userId") UUID userId, @Param("jobId") UUID jobId);

    @Query("SELECT COUNT(a) FROM Application a WHERE a.applicant.user.userId = :applicantId")
    long countByApplicantId(@Param("applicantId") UUID applicantId);

    /**
     * Finds all applications submitted by a specific applicant.
     *
     * @param applicantId the ID of the applicant (user ID)
     * @return a list of applications
     */
    @Query("SELECT a FROM Application a WHERE a.applicant.user.userId = :applicantId")
    List<Application> findAllByApplicantId(@Param("applicantId") UUID applicantId);

    /**
     * Counts applications grouped by job and state for jobs with interview
     * processes
     * belonging to a specific professor.
     * This is optimized to fetch all counts in a single query instead of N×M
     * queries.
     * Used by the interview overview to efficiently get statistics across all jobs.
     *
     * @param professorId the ID of the professor whose jobs to count applications
     *                    for
     * @return List of Object arrays containing [Job, ApplicationState, Count]
     */
    @Query(
        """
            SELECT a.job, a.state, COUNT(a)
            FROM Application a
            WHERE a.job IN (
                SELECT ip.job FROM InterviewProcess ip
                WHERE ip.job.supervisingProfessor.userId = :professorId
            )
            GROUP BY a.job, a.state
        """
    )
    List<Object[]> countApplicationsByJobAndStateForInterviewProcesses(@Param("professorId") UUID professorId);

    /**
     * Finds an application by ID with applicant and user details fetched.
     *
     * @param id the ID of the application
     * @return the application with details, or empty if not found
     */
    @Query(
        """
        SELECT a FROM Application a
        LEFT JOIN FETCH a.applicant ap
        LEFT JOIN FETCH ap.user
        LEFT JOIN FETCH a.applicationReview
        WHERE a.applicationId = :id
        """
    )
    Optional<Application> findWithDetailsById(@Param("id") UUID id);

    /**
     * Loads an application with applicant and job eagerly fetched. Used by callers that need to
     * perform ownership ({@code applicant.userId}) and job-config ({@code job.referenceLettersRequired})
     * checks without an open service-level transaction.
     *
     * @param id the application id
     * @return the application with applicant and job, or empty if none
     */
    @Query(
        """
        SELECT a FROM Application a
        LEFT JOIN FETCH a.applicant
        LEFT JOIN FETCH a.job
        WHERE a.applicationId = :id
        """
    )
    Optional<Application> findByIdWithApplicantAndJob(@Param("id") UUID id);

    /**
     * Loads an application with applicant, job and the job's research group eagerly fetched. Used by the
     * reference-request write paths, which build referee invitation emails from the research group while
     * OSIV is off and no service-level transaction is open.
     *
     * @param id the application id
     * @return the application with applicant, job and research group, or empty if none
     */
    @Query(
        """
        SELECT a FROM Application a
        LEFT JOIN FETCH a.applicant
        LEFT JOIN FETCH a.job j
        LEFT JOIN FETCH j.researchGroup
        WHERE a.applicationId = :id
        """
    )
    Optional<Application> findByIdWithApplicantJobAndResearchGroup(@Param("id") UUID id);

    /**
     * Loads an application together with applicant, job and the attached reference requests.
     * Used by the detail endpoints (applicant + professor evaluation) so the response can carry
     * the reference list without a second round-trip — required when OSIV is off.
     *
     * @param id the application id
     * @return the application with applicant, job and referenceRequests eagerly fetched
     */
    @Query(
        """
        SELECT DISTINCT a FROM Application a
        LEFT JOIN FETCH a.applicant ap
        LEFT JOIN FETCH a.job j
        LEFT JOIN FETCH a.referenceRequests
        WHERE a.applicationId = :id
        """
    )
    Optional<Application> findByIdWithApplicantJobAndReferences(@Param("id") UUID id);

    @Query(
        """
            SELECT DISTINCT a.applicant.user.userId FROM Application a
            WHERE function('date', a.lastModifiedAt) = function('date', :warningCutoff)
              AND a.state IN ('WITHDRAWN', 'REJECTED', 'JOB_CLOSED', 'ACCEPTED')
        """
    )
    List<UUID> findApplicantsToBeWarnedBeforeDeletion(LocalDateTime warningCutoff);

    /**
     * Returns every application that references the given job id, regardless of
     * application state. Used by the admin bulk export to bypass any second-level
     * cache or lazy-collection quirks on {@code Job.applications}.
     *
     * @param jobId the job id
     * @return all applications for that job
     */
    @Query("SELECT a FROM Application a WHERE a.job.jobId = :jobId")
    List<Application> findAllByJobId(@Param("jobId") UUID jobId);

    @Query(
        """
            SELECT a.applicationId FROM Application a
            WHERE a.lastModifiedAt < :cutoff
            AND a.state IN ('WITHDRAWN', 'REJECTED', 'JOB_CLOSED', 'ACCEPTED')
        """
    )
    Slice<UUID> findApplicationsToBeDeletedBeforeCutoff(LocalDateTime cutoff, Pageable pageable);

    /**
     * Finds all applications for a specific applicant as overview DTOs, with
     * pagination and sorting.
     *
     * @param applicantId the user ID of the applicant
     * @param pageable    pagination and sorting (sort by {@code createdAt} by default)
     * @return a paginated list of application overview DTOs
     */
    @Query(
        value = """
            SELECT new de.tum.cit.aet.application.domain.dto.ApplicationOverviewDTO(
                a.applicationId,
                j.jobId,
                j.title,
                rg.name,
                a.state,
                a.createdAt,
                CASE
                    WHEN SUM(CASE WHEN rr.status = de.tum.cit.aet.reference.constants.ReferenceRequestStatus.SUBMITTED THEN 1 ELSE 0 END)
                        < j.referenceLettersRequired THEN TRUE
                    ELSE FALSE
                END
            )
            FROM Application a
            JOIN a.job j
            JOIN j.researchGroup rg
            LEFT JOIN a.referenceRequests rr
            WHERE a.applicant.userId = :applicantId
            GROUP BY a.applicationId, j.jobId, j.title, rg.name, a.state, a.createdAt, j.referenceLettersRequired
        """,
        countQuery = """
            SELECT COUNT(a)
            FROM Application a
            JOIN a.job j
            JOIN j.researchGroup rg
            WHERE a.applicant.userId = :applicantId
        """
    )
    Page<ApplicationOverviewDTO> findApplicationsByApplicant(@Param("applicantId") UUID applicantId, Pageable pageable);

    /**
     * Finds all applications across every research group, with optional filters for state,
     * research group, supervising professor, and job, plus a search string matching either
     * the applicant's full name or the job title. Used by the admin "All Applications" page.
     *
     * @param states                  optional list of application states to include
     * @param researchGroupIds        optional list of research-group ids to include
     * @param supervisingProfessorIds optional list of supervising-professor user ids to include
     * @param jobIds                  optional list of job ids to include
     * @param searchQuery             optional search string for applicant name or job title
     * @param pageable                the pagination configuration
     * @return a page of matching applications as {@link AdminApplicationOverviewDTO}
     */
    @Query(
        """
            SELECT new de.tum.cit.aet.application.domain.dto.AdminApplicationOverviewDTO(
                a.applicationId,
                a.applicant.user.userId,
                CONCAT(a.applicant.user.firstName, ' ', a.applicant.user.lastName),
                a.applicant.user.avatar,
                a.job.jobId,
                a.job.title,
                a.job.researchGroup.researchGroupId,
                a.job.researchGroup.name,
                a.job.supervisingProfessor.userId,
                CONCAT(a.job.supervisingProfessor.firstName, ' ', a.job.supervisingProfessor.lastName),
                a.state,
                a.createdAt
            )
            FROM Application a
            WHERE (:states IS NULL OR a.state IN :states)
            AND (:researchGroupIds IS NULL OR a.job.researchGroup.researchGroupId IN :researchGroupIds)
            AND (:supervisingProfessorIds IS NULL OR a.job.supervisingProfessor.userId IN :supervisingProfessorIds)
            AND (:jobIds IS NULL OR a.job.jobId IN :jobIds)
            AND (:searchQuery IS NULL OR
                a.job.title LIKE CONCAT('%', :searchQuery, '%') OR
                CONCAT(a.applicant.user.firstName, ' ', a.applicant.user.lastName) LIKE CONCAT('%', :searchQuery, '%')
            )
        """
    )
    Page<AdminApplicationOverviewDTO> findAllApplicationsForAdmin(
        @Param("states") List<ApplicationState> states,
        @Param("researchGroupIds") List<UUID> researchGroupIds,
        @Param("supervisingProfessorIds") List<UUID> supervisingProfessorIds,
        @Param("jobIds") List<UUID> jobIds,
        @Param("searchQuery") String searchQuery,
        Pageable pageable
    );
}
