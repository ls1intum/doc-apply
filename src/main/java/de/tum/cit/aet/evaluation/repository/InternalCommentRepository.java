package de.tum.cit.aet.evaluation.repository;

import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.core.repository.DocApplyJpaRepository;
import de.tum.cit.aet.evaluation.domain.InternalComment;
import de.tum.cit.aet.usermanagement.domain.User;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface InternalCommentRepository extends DocApplyJpaRepository<InternalComment, UUID> {
    List<InternalComment> findAllByApplicationApplicationIdOrderByCreatedAtAsc(UUID applicationId);

    List<InternalComment> findAllByCreatedBy(User createdBy);

    void deleteByApplication(Application application);

    /**
     * Anonymizes internal comments by updating the creator reference to the given deleted user.
     *
     * @param createdBy the user whose comments should be anonymized
     * @param deletedUser the replacement user used to anonymize the comments
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE InternalComment ic SET ic.createdBy = :deletedUser WHERE ic.createdBy = :createdBy")
    void anonymiseByCreatedBy(User createdBy, User deletedUser);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM InternalComment ic WHERE ic.application.applicationId IN :applicationIds")
    void deleteByApplicationIdIn(@Param("applicationIds") List<UUID> applicationIds);
}
