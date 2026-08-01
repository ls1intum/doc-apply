package de.tum.cit.aet.evaluation.repository;

import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.core.repository.DocApplyJpaRepository;
import de.tum.cit.aet.evaluation.domain.Rating;
import de.tum.cit.aet.usermanagement.domain.User;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface RatingRepository extends DocApplyJpaRepository<Rating, UUID> {
    @Query(
        """
            SELECT r FROM Rating r
            LEFT JOIN FETCH r.from
            WHERE r.application.applicationId = :applicationId
        """
    )
    Set<Rating> findByApplicationApplicationId(@Param("applicationId") UUID applicationId);

    void deleteByApplication(Application application);

    void deleteByFromAndApplicationApplicationId(User from, UUID applicationId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM Rating r WHERE r.application.applicationId IN :applicationIds")
    void deleteByApplicationIdIn(@Param("applicationIds") List<UUID> applicationIds);

    Optional<Rating> findByFromAndApplicationApplicationId(User from, UUID applicationId);

    Set<Rating> findAllByFrom(User from);
}
