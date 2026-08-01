package de.tum.cit.aet.ai.repository;

import de.tum.cit.aet.ai.domain.AiUsageEvent;
import de.tum.cit.aet.ai.dto.AiUsageEventPoint;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface AiUsageEventRepository extends JpaRepository<AiUsageEvent, UUID> {
    /**
     * Returns the trigger points of all usage events at or after the given instant, ordered
     * chronologically. Projects to {@link AiUsageEventPoint} so the referenced user is not loaded.
     *
     * @param from inclusive lower bound on the event creation timestamp
     * @return the matching event points ordered by creation time ascending
     */
    @Query(
        "SELECT new de.tum.cit.aet.ai.dto.AiUsageEventPoint(e.feature, e.createdAt, e.success, e.inputTokens, e.outputTokens) " +
            "FROM AiUsageEvent e WHERE e.createdAt >= :from ORDER BY e.createdAt ASC"
    )
    List<AiUsageEventPoint> findPointsSince(@Param("from") LocalDateTime from);

    /**
     * Returns the earliest recorded event timestamp, used to bound the "all time" range.
     *
     * @return the earliest creation time, or empty if no events exist yet
     */
    @Query("SELECT MIN(e.createdAt) FROM AiUsageEvent e")
    Optional<LocalDateTime> findEarliestCreatedAt();
}
