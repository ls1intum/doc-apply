package de.tum.cit.aet.interview.repository;

import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.interview.domain.InterviewSlot;
import de.tum.cit.aet.usermanagement.domain.User;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Repository for managing interview slots.
 */
@Repository
public interface InterviewSlotRepository extends JpaRepository<InterviewSlot, UUID> {
    /**
     * Finds all interview slots for a given interview process with pagination.
     * Results are ordered by start time ascending.
     *
     * @param processId the ID of the interview process
     * @param pageable  pagination information
     * @return a page of {@link InterviewSlot} entities
     */
    @EntityGraph(value = "InterviewSlot.withIntervieweeDetails")
    @Query("SELECT s FROM InterviewSlot s WHERE s.interviewProcess.id = :processId ORDER BY s.startDateTime")
    Page<InterviewSlot> findByInterviewProcessId(@Param("processId") UUID processId, Pageable pageable);

    /**
     * Finds a slot by ID with job and research group.
     *
     * @param slotId the ID of the slot to find
     * @return Optional containing the slot with job loaded, or empty if not found
     */
    @EntityGraph(attributePaths = { "interviewProcess", "interviewProcess.job", "interviewProcess.job.researchGroup" })
    @Query("SELECT s FROM InterviewSlot s WHERE s.id = :slotId")
    Optional<InterviewSlot> findByIdWithJob(@Param("slotId") UUID slotId);

    /**
     * Finds a slot by ID with job, research group, and interviewee (including
     * applicant/user).
     * Used when updating a booked slot to send notification emails.
     *
     * @param slotId the ID of the slot to find
     * @return Optional containing the slot with all associations loaded
     */
    @EntityGraph(
        attributePaths = {
            "interviewProcess",
            "interviewProcess.job",
            "interviewProcess.job.researchGroup",
            "interviewProcess.job.supervisingProfessor",
            "interviewee",
            "interviewee.application",
            "interviewee.application.applicant",
            "interviewee.application.applicant.user",
        }
    )
    @Query("SELECT s FROM InterviewSlot s WHERE s.id = :slotId")
    Optional<InterviewSlot> findByIdWithJobAndInterviewee(@Param("slotId") UUID slotId);

    /**
     * Finds all slots for the given interview process ids with job data.
     *
     * @param processIds interview process ids
     * @return list of slots ordered by start time
     */
    @EntityGraph(attributePaths = { "interviewProcess", "interviewProcess.job" })
    @Query(
        """
        SELECT s FROM InterviewSlot s
        WHERE s.interviewProcess.id IN :processIds
        ORDER BY s.startDateTime ASC
        """
    )
    List<InterviewSlot> findByInterviewProcessIdInWithJob(@Param("processIds") List<UUID> processIds);

    /**
     * Counts all unbooked future interview slots associated with a list of
     * interview processes.
     * Returns a list of object arrays where [0] is the processId and [1] is the
     * count.
     *
     * @param processIds the list of interview process IDs
     * @param now        the current time
     * @return a list of object arrays with process ID and count
     */
    @Query(
        """
        SELECT s.interviewProcess.id, COUNT(s)
        FROM InterviewSlot s
        WHERE s.interviewProcess.id IN :processIds
        AND s.isBooked = false
        AND s.startDateTime > :now
        GROUP BY s.interviewProcess.id
        """
    )
    List<Object[]> countUnbookedFutureSlotsPerProcess(@Param("processIds") List<UUID> processIds, @Param("now") Instant now);

    /**
     * Counts all interview slots associated with a specific interview process.
     * Finds all interview slots of a given professor that overlap with a specified
     * time range.
     * This is used to check for scheduling conflicts when creating or updating
     * interview slots.
     *
     * @param processId the ID of the interview process
     * @return the number of slots linked to the given process
     */
    long countByInterviewProcessId(UUID processId);

    /**
     * Counts unbooked future interview slots for a specific process.
     *
     * @param processId the ID of the interview process
     * @param now       the current time
     * @return the number of available slots
     */
    @Query(
        "SELECT COUNT(s) FROM InterviewSlot s WHERE s.interviewProcess.id = :processId AND s.isBooked = false AND s.startDateTime > :now"
    )
    long countUnbookedFutureSlotsByInterviewProcessId(@Param("processId") UUID processId, @Param("now") Instant now);

    /**
     * Checks if a professor has any conflicting slots within the given time range.
     * For the same process: blocks any overlapping slot.
     * For other processes: only blocks BOOKED overlapping slots.
     *
     * @param professor     the professor to check
     * @param processId     the current process ID (to distinguish same vs other
     *                      process)
     * @param startDateTime start of the time range
     * @param endDateTime   end of the time range
     * @return true if at least one conflicting slot exists, false otherwise
     */
    @Query(
        """
        SELECT COUNT(s) > 0 FROM InterviewSlot s
            JOIN s.interviewProcess ip
            JOIN ip.job j
            WHERE j.supervisingProfessor = :professor
            AND (s.startDateTime < :endDateTime AND s.endDateTime > :startDateTime)
            AND (ip.id = :processId OR s.isBooked = true)
            """
    )
    boolean hasConflictingSlots(
        @Param("professor") User professor,
        @Param("processId") UUID processId,
        @Param("startDateTime") Instant startDateTime,
        @Param("endDateTime") Instant endDateTime
    );

    @Query(
        """
            SELECT slot
            FROM InterviewSlot slot
            JOIN FETCH slot.interviewProcess process
            JOIN FETCH process.job job
            WHERE job.supervisingProfessor = :professor
              AND slot.startDateTime < :endTime
              AND slot.endDateTime > :startTime
            ORDER BY slot.startDateTime ASC
            LIMIT 1
        """
    )
    Optional<InterviewSlot> findFirstConflictingSlot(
        @Param("professor") User professor,
        @Param("startTime") Instant startTime,
        @Param("endTime") Instant endTime
    );

    /**
     * Checks if a slot exists and belongs to a specific professor.
     *
     * @param slotId      the ID of the slot
     * @param professorId the ID of the supervising professor
     * @return true if the slot exists and belongs to the professor
     */
    @Query(
        """
            SELECT COUNT(s) > 0
            FROM InterviewSlot s
            WHERE s.id = :slotId
              AND s.interviewProcess.job.supervisingProfessor.userId = :professorId
        """
    )
    boolean existsByIdAndSupervisingProfessorId(@Param("slotId") UUID slotId, @Param("professorId") UUID professorId);

    /**
     * Finds interview slots for a given process, applying optional date filters.
     *
     * @param processId      the ID of the interview process
     * @param afterDateTime  if provided, only slots on or after this time are
     *                       returned
     * @param beforeDateTime if provided, only slots strictly before this time are
     *                       returned
     * @param monthStart     if provided, only slots on or after this month start
     *                       are returned
     * @param monthEnd       if provided, only slots strictly before this month end
     *                       are returned
     * @param pageable       pagination information
     * @return a page of matching slots order by start time
     */
    @EntityGraph(value = "InterviewSlot.withIntervieweeDetails")
    @Query(
        """
        SELECT s FROM InterviewSlot s
        WHERE s.interviewProcess.id = :processId
        AND (cast(:afterDateTime as timestamp) IS NULL OR s.startDateTime >= :afterDateTime)
        AND (cast(:beforeDateTime as timestamp) IS NULL OR s.startDateTime < :beforeDateTime)
        AND (cast(:monthStart as timestamp) IS NULL OR s.startDateTime >= :monthStart)
        AND (cast(:monthEnd as timestamp) IS NULL OR s.startDateTime < :monthEnd)
        ORDER BY s.startDateTime
        """
    )
    Page<InterviewSlot> findSlotsWithFilters(
        @Param("processId") UUID processId,
        @Param("afterDateTime") Instant afterDateTime,
        @Param("beforeDateTime") Instant beforeDateTime,
        @Param("monthStart") Instant monthStart,
        @Param("monthEnd") Instant monthEnd,
        Pageable pageable
    );

    /**
     * Finds all unbooked, future interview slots for a given interview process.
     * Used for the applicant booking page to display available time slots.
     *
     * @param processId the ID of the interview process
     * @param now       the current timestamp to filter out past slots
     * @return list of available slots ordered by start time ascending
     */
    @Query(
        """
        SELECT s FROM InterviewSlot s
        WHERE s.interviewProcess.id = :processId
        AND s.isBooked = false
        AND s.startDateTime >= :now
        ORDER BY s.startDateTime ASC
        """
    )
    List<InterviewSlot> findAvailableSlotsByProcessId(@Param("processId") UUID processId, @Param("now") Instant now);

    /**
     * Finds all unbooked future interview slots for a given process within a
     * specific month.
     * Only returns slots that are both within the month AND in the future.
     * Used for server-side pagination on the applicant booking page.
     *
     * @param processId  the ID of the interview process
     * @param now        the current time (to filter out past slots)
     * @param monthStart the start of the month (inclusive)
     * @param monthEnd   the end of the month (exclusive)
     * @param pageable   pagination information
     * @return page of available future slots ordered by start time ascending
     */
    @Query(
        """
        SELECT s FROM InterviewSlot s
        WHERE s.interviewProcess.id = :processId
        AND s.isBooked = false
        AND s.startDateTime >= :now
        AND s.startDateTime >= :monthStart
        AND s.startDateTime < :monthEnd
        ORDER BY s.startDateTime ASC
        """
    )
    Page<InterviewSlot> findAvailableSlotsByProcessIdAndMonth(
        @Param("processId") UUID processId,
        @Param("now") Instant now,
        @Param("monthStart") Instant monthStart,
        @Param("monthEnd") Instant monthEnd,
        Pageable pageable
    );

    /**
     * Finds all booked future interview slots for a given professor.
     * Used for the professor dashboard to display upcoming interviews.
     *
     * @param professorId the professor to find slots for
     * @param now         the current time (to filter out past slots)
     * @param pageable    pagination information
     * @return page of upcoming booked slots ordered by start time ascending
     */
    @Query(
        """
        SELECT s FROM InterviewSlot s
        WHERE s.interviewProcess.job.supervisingProfessor.userId = :professorId
        AND s.isBooked = true
        AND s.endDateTime > :now
        ORDER BY s.startDateTime ASC
        """
    )
    @EntityGraph(
        attributePaths = {
            "interviewee",
            "interviewee.application",
            "interviewee.application.applicant",
            "interviewee.application.applicant.user",
            "interviewProcess",
            "interviewProcess.job",
        }
    )
    Page<InterviewSlot> findUpcomingBookedSlotsForProfessor(
        @Param("professorId") UUID professorId,
        @Param("now") Instant now,
        Pageable pageable
    );

    /**
     * Finds all booked future interview slots for a given research group.
     * Used for the dashboard to display upcoming interviews for all members of the
     * group.
     *
     * @param researchGroupId the research group ID to find slots for
     * @param now             the current time (to filter out past slots)
     * @param pageable        pagination information
     * @return page of upcoming booked slots ordered by start time ascending
     */
    @Query(
        """
        SELECT s FROM InterviewSlot s
        WHERE s.interviewProcess.job.researchGroup.researchGroupId = :researchGroupId
        AND s.isBooked = true
        AND s.endDateTime > :now
        ORDER BY s.startDateTime ASC
        """
    )
    @EntityGraph(
        attributePaths = {
            "interviewee",
            "interviewee.application",
            "interviewee.application.applicant",
            "interviewee.application.applicant.user",
            "interviewProcess",
            "interviewProcess.job",
        }
    )
    Page<InterviewSlot> findUpcomingBookedSlotsForResearchGroup(
        @Param("researchGroupId") UUID researchGroupId,
        @Param("now") Instant now,
        Pageable pageable
    );

    void deleteByIntervieweeApplication(Application application);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM InterviewSlot s WHERE s.interviewee.application.applicationId IN :applicationIds")
    void deleteByIntervieweeApplicationIdIn(@Param("applicationIds") List<UUID> applicationIds);

    /**
     * Finds all slots relevant for conflict detection on a specific date.
     * Returns:
     * - All slots (booked + unbooked) from the current interview process
     * - All BOOKED slots from other processes of the same professor
     *
     * @param processId   the current interview process ID
     * @param professorId the supervising professor's user ID
     * @param dayStart    start of the day (inclusive)
     * @param dayEnd      end of the day (exclusive)
     * @return list of slots for conflict checking, ordered by start time
     */
    @Query(
        """
        SELECT s FROM InterviewSlot s
        JOIN s.interviewProcess ip
        JOIN ip.job j
        WHERE s.startDateTime >= :dayStart
        AND s.startDateTime < :dayEnd
        AND (
            ip.id = :processId
            OR (s.isBooked = true AND j.supervisingProfessor.userId = :professorId)
        )
        ORDER BY s.startDateTime
        """
    )
    List<InterviewSlot> findConflictDataByDate(
        @Param("processId") UUID processId,
        @Param("professorId") UUID professorId,
        @Param("dayStart") Instant dayStart,
        @Param("dayEnd") Instant dayEnd
    );

    /**
     * Finds overlapping unbooked slots from other processes to auto-delete when a
     * slot is booked.
     * Used to prevent professors from being double-booked across different
     * interview processes.
     *
     * @param professorId      the supervising professor's user ID
     * @param excludeProcessId the current process ID to exclude from results
     * @param startDateTime    start of the time range to check
     * @param endDateTime      end of the time range to check
     * @return list of overlapping unbooked slots from other processes
     */
    @Query(
        """
        SELECT s FROM InterviewSlot s
        JOIN s.interviewProcess ip
        JOIN ip.job j
        WHERE j.supervisingProfessor.userId = :professorId
        AND ip.id != :excludeProcessId
        AND s.isBooked = false
        AND s.startDateTime < :endDateTime
        AND s.endDateTime > :startDateTime
        """
    )
    List<InterviewSlot> findOverlappingUnbookedSlots(
        @Param("professorId") UUID professorId,
        @Param("excludeProcessId") UUID excludeProcessId,
        @Param("startDateTime") Instant startDateTime,
        @Param("endDateTime") Instant endDateTime
    );
}
