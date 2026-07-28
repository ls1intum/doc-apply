package de.tum.cit.aet.notification.repository;

import de.tum.cit.aet.core.repository.DocApplyJpaRepository;
import de.tum.cit.aet.notification.constants.EmailType;
import de.tum.cit.aet.notification.domain.EmailSetting;
import de.tum.cit.aet.usermanagement.domain.User;
import java.util.Collection;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface EmailSettingRepository extends DocApplyJpaRepository<EmailSetting, UUID> {
    /**
     * Finds an email setting for a specific user and email type combination.
     *
     * @param user the user to search email settings for
     * @param emailType the specific email type to find settings for
     * @return Optional containing the EmailSetting if found, empty otherwise
     */
    Optional<EmailSetting> findByUserAndEmailType(User user, EmailType emailType);

    /**
     * Retrieves all email settings for a specific user.
     *
     * @param user the user to retrieve all email settings for
     * @return a set of all EmailSetting entities associated with the user
     */
    Set<EmailSetting> findAllByUser(User user);

    /**
     * Finds all available email types that a user has settings configured for.
     *
     * @param user the user to find available email types for
     * @return a set of EmailType values that the user has settings configured for
     */
    @Query(
        """
        select es.emailType
        from EmailSetting es
        where es.user = :user
        """
    )
    Set<EmailType> findAvailableEmailTypesForUser(@Param("user") User user);

    /**
     * Returns the subset of the given user IDs that have an explicit, disabled setting for the given email type.
     * Users without a stored setting fall back to the default-enabled behaviour and are not in this set.
     *
     * @param userIds   the candidate user IDs to check
     * @param emailType the email type to filter by
     * @return the IDs of users who have explicitly disabled this email type
     */
    @Query(
        """
        SELECT es.user.userId
        FROM EmailSetting es
        WHERE es.user.userId IN :userIds
          AND es.emailType = :emailType
          AND es.enabled = false
        """
    )
    Set<UUID> findUserIdsWithDisabledSetting(@Param("userIds") Collection<UUID> userIds, @Param("emailType") EmailType emailType);

    void deleteByUser(User user);
}
