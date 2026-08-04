package de.tum.cit.aet.reference.repository;

import de.tum.cit.aet.reference.domain.ReferenceRequest;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public interface ReferenceRequestRepository extends JpaRepository<ReferenceRequest, UUID> {
    /**
     * @param applicationId the owning application
     * @return all reference requests linked to the application, in insertion order
     */
    List<ReferenceRequest> findByApplicationApplicationIdOrderByCreatedAtAsc(UUID applicationId);

    /**
     * Loads a reference request by id with its owning application eagerly fetched. Used by callers
     * that need to inspect {@code application.applicationId} (for scope checks) without keeping an
     * open service-level transaction.
     *
     * @param id the reference request id
     * @return the reference request with its application loaded, or empty if none
     */
    @Query(
        """
        SELECT r FROM ReferenceRequest r
        JOIN FETCH r.application
        WHERE r.referenceRequestId = :id
        """
    )
    Optional<ReferenceRequest> findByIdWithApplication(@Param("id") UUID id);

    /**
     * Looks up a request by the SHA-256 hash of the raw token sent in the invitation email.
     * Eagerly loads the application, applicant user, job and research group so the caller can
     * read all the prefilled fields without a service-level transaction.
     *
     * @param tokenHash hash of the raw token presented by the referee
     * @return the matching request with application context, or empty if none
     */
    @Query(
        """
        SELECT r FROM ReferenceRequest r
        JOIN FETCH r.application a
        JOIN FETCH a.applicant ap
        JOIN FETCH ap.user
        JOIN FETCH a.job j
        JOIN FETCH j.researchGroup
        WHERE r.tokenHash = :tokenHash
        """
    )
    Optional<ReferenceRequest> findByTokenHashWithApplication(@Param("tokenHash") String tokenHash);

    /**
     * Loads all reference requests linked to any of the given applications. Used to batch-attach
     * the {@code referenceRequests} collection on applications returned by criteria queries that
     * cannot join-fetch the collection (e.g. paginated evaluation list).
     *
     * @param applicationIds the owning application ids
     * @return all matching reference requests
     */
    @Query("SELECT r FROM ReferenceRequest r WHERE r.application.applicationId IN :applicationIds")
    List<ReferenceRequest> findByApplicationIds(@Param("applicationIds") List<UUID> applicationIds);

    /**
     * Finds candidates for a reminder email. Eagerly fetches the application graph the reminder
     * sender needs (applicant + job + research group) so it can build the email without an
     * additional service-level transaction.
     *
     * @param now           the current UTC timestamp; entries that have already expired are skipped
     * @param upperBound    the latest deadline still inside the reminder window
     * @param maxReminders  cap on entries that already had this many reminders (keeps reminderCount &lt; cap)
     * @return REQUESTED entries with a future deadline within the window and reminderCount below {@code maxReminders}
     */
    @Query(
        """
        SELECT r FROM ReferenceRequest r
        JOIN FETCH r.application a
        JOIN FETCH a.applicant ap
        JOIN FETCH ap.user
        JOIN FETCH a.job j
        JOIN FETCH j.researchGroup
        WHERE r.status = de.tum.cit.aet.reference.constants.ReferenceRequestStatus.REQUESTED
          AND r.tokenExpiresAt IS NOT NULL
          AND r.tokenExpiresAt > :now
          AND r.tokenExpiresAt <= :upperBound
          AND r.reminderCount < :maxReminders
        """
    )
    List<ReferenceRequest> findReminderCandidates(
        @Param("now") LocalDateTime now,
        @Param("upperBound") LocalDateTime upperBound,
        @Param("maxReminders") int maxReminders
    );

    /**
     * Flips every REQUESTED entry whose token has already expired to {@code EXPIRED}. Issued as a
     * bulk UPDATE so the daily sweep stays a single round-trip even when many entries lapse on the same day.
     *
     * @param now the current UTC timestamp
     * @return the number of rows that were transitioned
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query(
        """
        UPDATE ReferenceRequest r
        SET r.status = de.tum.cit.aet.reference.constants.ReferenceRequestStatus.EXPIRED
        WHERE r.status = de.tum.cit.aet.reference.constants.ReferenceRequestStatus.REQUESTED
          AND r.tokenExpiresAt IS NOT NULL
          AND r.tokenExpiresAt < :now
        """
    )
    int expireOverdueRequests(@Param("now") LocalDateTime now);
}
