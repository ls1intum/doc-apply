package de.tum.cit.aet.usermanagement.repository;

import de.tum.cit.aet.core.repository.DocApplyJpaRepository;
import de.tum.cit.aet.job.constants.SubjectArea;
import de.tum.cit.aet.usermanagement.domain.Applicant;
import de.tum.cit.aet.usermanagement.domain.User;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA repository for the {@link Applicant} entity.
 */
@Repository
public interface ApplicantRepository extends DocApplyJpaRepository<Applicant, UUID> {
    @Query(
        """
            SELECT DISTINCT applicant.user
            FROM Applicant applicant
            WHERE :subjectArea MEMBER OF applicant.subjectAreaSubscriptions
        """
    )
    Set<User> findAllBySubjectAreaSubscription(@Param("subjectArea") SubjectArea subjectArea);
}
