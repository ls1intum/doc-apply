package de.tum.cit.aet.evaluation.repository;

import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.core.repository.DocApplyJpaRepository;
import de.tum.cit.aet.evaluation.repository.custom.ApplicationEvaluationRepositoryCustom;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public interface ApplicationEvaluationRepository extends DocApplyJpaRepository<Application, UUID>, ApplicationEvaluationRepositoryCustom {
    /**
     * Marks the application as IN_REVIEW if its current state is SENT.
     *
     * @param applicationId the ID of the application to update
     */
    @Transactional
    @Modifying
    @Query(
        """
            UPDATE Application a
            SET a.state = 'IN_REVIEW'
            WHERE a.state = 'SENT'
            AND a.applicationId = :applicationId
        """
    )
    void markApplicationAsInReview(@Param("applicationId") UUID applicationId);

    /**
     * Returns the distinct job titles of applications that belong to the given
     * research group, ordered alphabetically.
     *
     * @param researchGroupId the UUID of the research group
     * @return distinct job titles in ascending order
     */
    @Query(
        """
            SELECT DISTINCT j.title
            FROM Application a
            JOIN a.job j
            WHERE j.researchGroup.researchGroupId = :researchGroupId
            ORDER BY j.title ASC
        """
    )
    List<String> findAllUniqueJobNames(@Param("researchGroupId") UUID researchGroupId);
}
