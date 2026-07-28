package de.tum.cit.aet.job.repository;

import de.tum.cit.aet.core.repository.DocApplyJpaRepository;
import de.tum.cit.aet.job.constants.Campus;
import de.tum.cit.aet.job.constants.JobState;
import de.tum.cit.aet.job.constants.SubjectArea;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.job.dto.CreatedJobDTO;
import de.tum.cit.aet.job.dto.JobCardDTO;
import de.tum.cit.aet.usermanagement.domain.User;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA repository for the {@link Job} entity.
 */
@Repository
public interface JobRepository extends DocApplyJpaRepository<Job, UUID> {
    /**
     * Finds all jobs that belong to a given research group, with optional state and title/professor search filters.
     * Results are paginated.
     *
     * @param researchGroupId the research group ID to filter by
     * @param states          the optional list of job states to include
     * @param searchQuery     the optional search string for job title or professor name
     * @param pageable        the pagination configuration
     * @return a page of matching jobs
     */
    @Query(
        """
          SELECT new de.tum.cit.aet.job.dto.CreatedJobDTO(
            j.jobId,
            j.supervisingProfessor.avatar,
            CONCAT(j.supervisingProfessor.firstName, ' ', j.supervisingProfessor.lastName),
            j.state,
            j.title,
            j.startDate,
            j.createdAt,
            j.lastModifiedAt
          )
          FROM Job j
          WHERE j.researchGroup.researchGroupId = :researchGroupId
          AND (:states IS NULL OR j.state IN :states)
          AND (:searchQuery IS NULL OR
             j.title LIKE CONCAT('%', :searchQuery, '%') OR
             CONCAT(j.supervisingProfessor.firstName, ' ', j.supervisingProfessor.lastName) LIKE CONCAT('%', :searchQuery, '%')
          )
        """
    )
    Page<CreatedJobDTO> findAllJobsByResearchGroup(
        @Param("researchGroupId") UUID researchGroupId,
        @Param("states") List<JobState> states,
        @Param("searchQuery") String searchQuery,
        Pageable pageable
    );

    /**
     * Finds all jobs across every research group, with optional filters for state, research group,
     * supervising professor, and a search string matching either job title or professor name.
     * Used by the admin "All Positions" page.
     *
     * @param states                  optional list of job states to include
     * @param researchGroupIds        optional list of research-group ids to include
     * @param supervisingProfessorIds optional list of supervising-professor user ids to include
     * @param searchQuery             optional search string for job title or professor full name
     * @param pageable                the pagination configuration
     * @return a page of matching jobs as {@link de.tum.cit.aet.job.dto.AdminCreatedJobDTO}
     */
    @Query(
        """
          SELECT new de.tum.cit.aet.job.dto.AdminCreatedJobDTO(
            j.jobId,
            j.supervisingProfessor.avatar,
            CONCAT(j.supervisingProfessor.firstName, ' ', j.supervisingProfessor.lastName),
            j.supervisingProfessor.userId,
            j.researchGroup.researchGroupId,
            j.researchGroup.name,
            j.state,
            j.title,
            j.startDate,
            j.createdAt,
            j.lastModifiedAt
          )
          FROM Job j
          WHERE (:states IS NULL OR j.state IN :states)
          AND (:researchGroupIds IS NULL OR j.researchGroup.researchGroupId IN :researchGroupIds)
          AND (:supervisingProfessorIds IS NULL OR j.supervisingProfessor.userId IN :supervisingProfessorIds)
          AND (:searchQuery IS NULL OR
             j.title LIKE CONCAT('%', :searchQuery, '%') OR
             CONCAT(j.supervisingProfessor.firstName, ' ', j.supervisingProfessor.lastName) LIKE CONCAT('%', :searchQuery, '%')
          )
        """
    )
    Page<de.tum.cit.aet.job.dto.AdminCreatedJobDTO> findAllJobsForAdmin(
        @Param("states") List<JobState> states,
        @Param("researchGroupIds") List<UUID> researchGroupIds,
        @Param("supervisingProfessorIds") List<UUID> supervisingProfessorIds,
        @Param("searchQuery") String searchQuery,
        Pageable pageable
    );

    /**
     * Finds all available job postings with optional filtering and custom sorting
     * by professor name.
     * Sorting is applied manually for the computed professor name field.
     *
     * @param state          the job state (typically PUBLISHED)
     * @param subjectAreas   subject areas to match (nullable)
     * @param locations      the campus locations filter (nullable)
     * @param professorNames a partial match filter for multiple professor's full
     *                       names
     *                       (nullable)
     * @param sortBy         the field to sort by (only used for professorName
     *                       sorting here)
     * @param sortDirection  sort direction (ASC or DESC)
     * @param userId         id of the currently logged in user (nullable)
     * @param searchQuery    string to search for job title,
     *                       subject area or supervisor name
     * @param searchSubjectAreas subject areas matching the search query
     * @param pageable       pagination information
     * @return a page of {@link JobCardDTO} matching the criteria
     */
    @Query(
        """
        SELECT new de.tum.cit.aet.job.dto.JobCardDTO(
          j.jobId as jobId,
          j.title as title,
          j.location as location,
          CONCAT(p.firstName, ' ', p.lastName) as professorName,
          j.subjectArea as subjectArea,
          p.avatar as avatar,
          a.applicationId as applicationId,
          a.state as applicationState,
          j.workload as workload,
          j.startDate as startDate,
          j.endDate as endDate,
          j.contractDuration as contractDuration,
          j.referenceLettersRequired as referenceLettersRequired,
          j.recommendationType as recommendationType,
          i.url as imageUrl
        )
        FROM Job j
        JOIN j.supervisingProfessor p
        LEFT JOIN j.image i
        LEFT JOIN j.applications a
               WITH (:userId IS NOT NULL
                 AND a.applicant.userId = :userId
                 AND a.createdAt = (
                      SELECT MAX(a2.createdAt)
                      FROM Application a2
                      WHERE a2.job = j AND a2.applicant.userId = :userId
                 ))
        WHERE j.state = :state
          AND (j.endDate IS NULL OR j.endDate >= CURRENT_DATE)
          AND (:subjectAreas IS NULL OR j.subjectArea IN :subjectAreas)
          AND (:locations IS NULL OR j.location IN :locations)
          AND (:professorNames IS NULL OR CONCAT(p.firstName, ' ', p.lastName) IN :professorNames)
          AND (:searchQuery IS NULL OR
                   j.title LIKE CONCAT('%', :searchQuery, '%') OR
                   (:searchSubjectAreas IS NOT NULL AND j.subjectArea IN :searchSubjectAreas) OR
                   CONCAT(p.firstName, ' ', p.lastName) LIKE CONCAT('%', :searchQuery, '%')
              )
        ORDER BY
            CASE WHEN :sortDirection = 'ASC'  AND :sortBy = 'professorName'
                 THEN j.supervisingProfessor.lastName END ASC,
            CASE WHEN :sortDirection = 'ASC'  AND :sortBy = 'professorName'
                 THEN j.supervisingProfessor.firstName END ASC,
            CASE WHEN :sortDirection = 'DESC' AND :sortBy = 'professorName'
                 THEN j.supervisingProfessor.lastName END DESC,
            CASE WHEN :sortDirection = 'DESC' AND :sortBy = 'professorName'
                 THEN j.supervisingProfessor.firstName END DESC,
            j.createdAt DESC
                  """
    )
    Page<JobCardDTO> findAllJobCardsByState(
        @Param("state") JobState state,
        @Param("subjectAreas") List<SubjectArea> subjectAreas,
        @Param("locations") List<Campus> locations,
        @Param("professorNames") List<String> professorNames,
        @Param("sortBy") String sortBy,
        @Param("sortDirection") String sortDirection,
        @Param("userId") UUID userId,
        @Param("searchQuery") String searchQuery,
        @Param("searchSubjectAreas") List<SubjectArea> searchSubjectAreas,
        Pageable pageable
    );

    /**
     * Returns the supervising professor's user ID for the given job.
     *
     * @param jobId the job ID
     * @return the supervising professor's user ID
     */
    @Query("SELECT j.supervisingProfessor.userId FROM Job j WHERE j.jobId = :jobId")
    Optional<UUID> findSupervisingProfessorUserIdByJobId(@Param("jobId") UUID jobId);

    /**
     * Finds all available job postings with optional filtering options. Sorting is
     * delegated to Spring's Pageable,
     * so this method does not support custom sorting by computed fields like
     * professor name.
     *
     * @param state          the job state (typically PUBLISHED)
     * @param subjectAreas   subject areas to match (nullable)
     * @param locations      the campus locations filter (nullable)
     * @param professorNames a partial match filter for multiple professor's full
     *                       names
     *                       (nullable)
     * @param userId         id of the currently logged in user (nullable)
     * @param searchQuery    string to search for job title, subject area or supervisor name
     * @param searchSubjectAreas subject areas matching the search query
     * @param pageable       pagination and sorting information
     * @return a page of {@link JobCardDTO} matching the criteria
     */
    @Query(
        """
          SELECT new de.tum.cit.aet.job.dto.JobCardDTO(
            j.jobId as jobId,
            j.title as title,
            j.location as location,
            CONCAT(p.firstName, ' ', p.lastName) as professorName,
            j.subjectArea as subjectArea,
            p.avatar as avatar,
            a.applicationId as applicationId,
            a.state as applicationState,
            j.workload as workload,
            j.startDate as startDate,
            j.endDate as endDate,
            j.contractDuration as contractDuration,
            j.referenceLettersRequired as referenceLettersRequired,
            j.recommendationType as recommendationType,
            i.url as imageUrl
          )
          FROM Job j
          JOIN j.supervisingProfessor p
          LEFT JOIN j.image i
          LEFT JOIN j.applications a
                 WITH (:userId IS NOT NULL
                   AND a.applicant.userId = :userId
                   AND a.createdAt = (
                        SELECT MAX(a2.createdAt)
                        FROM Application a2
                        WHERE a2.job = j AND a2.applicant.userId = :userId
                   ))
          WHERE j.state = :state
            AND (j.endDate IS NULL OR j.endDate >= CURRENT_DATE)
            AND (:subjectAreas IS NULL OR j.subjectArea IN :subjectAreas)
            AND (:locations IS NULL OR j.location IN :locations)
            AND (:professorNames IS NULL OR CONCAT(p.firstName, ' ', p.lastName) IN :professorNames)
            AND (:searchQuery IS NULL OR
                   j.title LIKE CONCAT('%', :searchQuery, '%') OR
                   (:searchSubjectAreas IS NOT NULL AND j.subjectArea IN :searchSubjectAreas) OR
                   CONCAT(p.firstName, ' ', p.lastName) LIKE CONCAT('%', :searchQuery, '%')
            )
        """
    )
    Page<JobCardDTO> findAllJobCardsByState(
        @Param("state") JobState state,
        @Param("subjectAreas") List<SubjectArea> subjectAreas,
        @Param("locations") List<Campus> locations,
        @Param("professorNames") List<String> professorNames,
        @Param("userId") UUID userId,
        @Param("searchQuery") String searchQuery,
        @Param("searchSubjectAreas") List<SubjectArea> searchSubjectAreas,
        Pageable pageable
    );

    /**
     * Finds all available subject areas
     *
     * @param state the job state (typically PUBLISHED)
     * @return a list of all unique, available subject areas
     */
    @Query(
        """
        SELECT DISTINCT j.subjectArea
        FROM Job j
        WHERE j.state = :state
          AND (j.endDate IS NULL OR j.endDate >= CURRENT_DATE)
        ORDER BY j.subjectArea ASC
        """
    )
    List<SubjectArea> findAllUniqueSubjectAreas(@Param("state") JobState state);

    /**
     * Finds all unique supervisor names
     *
     * @param state the job state (typically PUBLISHED)
     * @return a List of String with all unique, available supervisor names
     */
    @Query(
        """
        SELECT DISTINCT CONCAT(p.firstName, ' ', p.lastName)
        FROM Job j
        JOIN j.supervisingProfessor p
        WHERE j.state = :state
          AND (j.endDate IS NULL OR j.endDate >= CURRENT_DATE)
        ORDER BY CONCAT(p.firstName, ' ', p.lastName) ASC
        """
    )
    List<String> findAllUniqueSupervisorNames(@Param("state") JobState state);

    /**
     * Find a job with its image eagerly loaded
     *
     * @param jobId the job ID
     * @return the job with image loaded, or empty if not found
     */
    @Query("SELECT j FROM Job j LEFT JOIN FETCH j.image WHERE j.jobId = :jobId")
    Optional<Job> findByIdWithImage(@Param("jobId") UUID jobId);

    /**
     * Find all jobs by state with images eagerly loaded
     *
     * @param state the job state
     * @return list of jobs with images loaded
     */
    @Query(
        "SELECT DISTINCT j FROM Job j LEFT JOIN FETCH j.image WHERE j.state = :state AND (j.endDate IS NULL OR j.endDate >= CURRENT_DATE)"
    )
    List<Job> findAllByStateWithImages(@Param("state") JobState state);

    /**
     * Reassigns jobs supervised by a specific user to a deleted user.
     *
     * @param user        the user whose jobs are to be reassigned
     * @param deletedUser the deleted user to whom the jobs will be reassigned
     * @param state       the job state to apply after reassignment
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Job j SET j.supervisingProfessor = :deletedUser, j.state = :state WHERE j.supervisingProfessor = :user")
    void anonymiseJobByUserId(@Param("user") User user, @Param("deletedUser") User deletedUser, @Param("state") JobState state);

    /**
     * Checks if an image is referenced by any job
     *
     * @param imageId the image ID to check
     * @return true if at least one job references this image, false otherwise
     */
    @Query("SELECT COUNT(j) > 0 FROM Job j WHERE j.image.imageId = :imageId")
    boolean existsByImageId(@Param("imageId") UUID imageId);

    /**
     * Finds all image IDs that are currently referenced by at least one job
     *
     * @param imageIds the list of image IDs to check
     * @return set of image IDs that are in use
     */
    @Query("SELECT DISTINCT j.image.imageId FROM Job j WHERE j.image.imageId IN :imageIds")
    Set<UUID> findInUseImageIds(@Param("imageIds") List<UUID> imageIds);

    /**
     * Finds a job by id, eagerly fetching compliance issues
     *
     * @param jobId the job id
     * @return the job with relations loaded, or empty if not found
     */
    @EntityGraph(attributePaths = { "complianceIssues", "supervisingProfessor", "researchGroup", "image" })
    @Query("SELECT j FROM Job j WHERE j.jobId = :jobId")
    Optional<Job> findByIdWithCompliance(@Param("jobId") UUID jobId);
}
