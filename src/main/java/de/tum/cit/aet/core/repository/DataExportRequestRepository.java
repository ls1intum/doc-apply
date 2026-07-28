package de.tum.cit.aet.core.repository;

import de.tum.cit.aet.core.constants.DataExportState;
import de.tum.cit.aet.core.domain.DataExportRequest;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface DataExportRequestRepository extends DocApplyJpaRepository<DataExportRequest, UUID> {
    Optional<DataExportRequest> findTop1ByUserUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<DataExportRequest> findTop1ByUserUserIdAndStatusInOrderByCreatedAtDesc(UUID userId, Collection<DataExportState> statuses);

    boolean existsByUserUserIdAndStatusIn(UUID userId, Collection<DataExportState> statuses);

    Optional<DataExportRequest> findByDownloadToken(String downloadToken);

    List<DataExportRequest> findAllByStatusOrderByCreatedAtAsc(DataExportState status);

    List<DataExportRequest> findAllByStatusInOrderByCreatedAtAsc(Collection<DataExportState> statuses);

    @Query("select max(d.lastRequestedAt) from DataExportRequest d where d.user.userId = :userId")
    Optional<LocalDateTime> findLastRequestedAtForUser(@Param("userId") UUID userId);
}
