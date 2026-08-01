package de.tum.cit.aet.evaluation.repository;

import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.core.repository.DocApplyJpaRepository;
import de.tum.cit.aet.evaluation.domain.ApplicationReview;
import de.tum.cit.aet.usermanagement.domain.User;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA repository for the {@link ApplicationReview} entity.
 */
@Repository
public interface ApplicationReviewRepository extends DocApplyJpaRepository<ApplicationReview, UUID> {
    List<ApplicationReview> findAllByReviewedBy(User reviewedBy);

    Optional<ApplicationReview> findByApplicationApplicationId(UUID applicationId);

    void deleteByApplication(Application application);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM ApplicationReview ar WHERE ar.application.applicationId IN :applicationIds")
    void deleteByApplicationIdIn(@Param("applicationIds") List<UUID> applicationIds);
}
