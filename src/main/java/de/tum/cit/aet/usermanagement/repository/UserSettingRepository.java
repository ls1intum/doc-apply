package de.tum.cit.aet.usermanagement.repository;

import de.tum.cit.aet.core.repository.DocApplyJpaRepository;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.domain.UserSetting;
import de.tum.cit.aet.usermanagement.domain.key.UserSettingId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/**
 * Spring Data JPA repository for the {@link UserSetting} entity.
 * Provides methods to query and update user-specific settings.
 */
@Repository
public interface UserSettingRepository extends DocApplyJpaRepository<UserSetting, UserSettingId> {
    /**
     * Finds all settings for a specific user.
     *
     * @param userId the UUID of the user to find settings for
     * @return a list of user settings
     */
    List<UserSetting> findAllByIdUserId(UUID userId);

    /**
     * Find a specific setting by user id and setting key.
     *
     * @param userId the UUID of the user
     * @param key    the setting key
     * @return optional containing the setting if present
     */
    Optional<UserSetting> findByIdUserIdAndIdSettingKey(UUID userId, String key);

    /**
     * Upsert a user setting (insert if not exists, update if exists and value changed).
     *
     * @param userId the UUID of the user
     * @param key    the setting key
     * @param value  the value of the setting
     */
    @Modifying
    @Transactional
    @Query(
        value = """
        INSERT INTO user_settings (user_id, setting_key, setting_value)
        VALUES (:userId, :key, :value) AS new
        ON DUPLICATE KEY UPDATE
          setting_value = IF(new.setting_value <> user_settings.setting_value, new.setting_value, user_settings.setting_value),
          updated_at    = IF(new.setting_value <> user_settings.setting_value, CURRENT_TIMESTAMP, user_settings.updated_at)
        """,
        nativeQuery = true
    )
    void upsert(@Param("userId") UUID userId, @Param("key") String key, @Param("value") String value);

    void deleteByUser(User user);
}
