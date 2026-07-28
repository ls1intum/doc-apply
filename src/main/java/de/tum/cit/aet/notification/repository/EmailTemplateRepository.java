package de.tum.cit.aet.notification.repository;

import de.tum.cit.aet.core.repository.DocApplyJpaRepository;
import de.tum.cit.aet.notification.constants.EmailType;
import de.tum.cit.aet.notification.domain.EmailTemplate;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface EmailTemplateRepository extends DocApplyJpaRepository<EmailTemplate, UUID> {
    /**
     * Finds the (at most one) custom {@link EmailTemplate} for the given research group and email type.
     *
     * @param researchGroup the research group owning the template
     * @param emailType     the email type to look up
     * @return the matching template if it exists
     */
    Optional<EmailTemplate> findByResearchGroupAndEmailType(ResearchGroup researchGroup, EmailType emailType);

    /**
     * Returns whether a custom {@link EmailTemplate} exists for the given research group and email type.
     *
     * @param researchGroup the research group owning the template
     * @param emailType     the email type to look up
     * @return {@code true} if a custom row exists for this pair
     */
    boolean existsByResearchGroupAndEmailType(ResearchGroup researchGroup, EmailType emailType);

    /**
     * Returns all custom {@link EmailTemplate}s belonging to the given research group.
     *
     * @param researchGroup the research group whose customs should be returned
     * @return all custom templates for the group, in no particular order
     */
    List<EmailTemplate> findAllByResearchGroup(ResearchGroup researchGroup);

    /**
     * Anonymizes the {@code createdBy} user reference of all {@link EmailTemplate} entities created by the given user
     * by updating the associated creator to the provided deleted user.
     *
     * @param user the user whose created email templates should be anonymized
     * @param deletedUser the deleted user to set as the new creator for those templates
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE EmailTemplate et SET et.createdBy = :deletedUser WHERE et.createdBy = :user")
    void anonymiseByCreatedBy(@Param("user") User user, @Param("deletedUser") User deletedUser);
}
