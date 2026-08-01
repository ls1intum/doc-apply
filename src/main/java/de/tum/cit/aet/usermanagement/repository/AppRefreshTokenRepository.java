package de.tum.cit.aet.usermanagement.repository;

import de.tum.cit.aet.usermanagement.domain.AppRefreshToken;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Repository for {@link AppRefreshToken} records used to revoke and rotate app-issued refresh tokens.
 */
@Repository
public interface AppRefreshTokenRepository extends JpaRepository<AppRefreshToken, String> {
    /**
     * Marks a single refresh-token id as revoked if it is currently active (exists and not yet revoked).
     *
     * @param jti the refresh token id to revoke
     * @return the number of rows updated (0 if the token is unknown or already revoked)
     */
    @Modifying
    @Query("update AppRefreshToken t set t.revoked = true where t.jti = :jti and t.revoked = false")
    int revokeIfActive(@Param("jti") String jti);

    /**
     * Revokes every active refresh token belonging to the given user (used on logout and on replay detection).
     *
     * @param userId the user whose tokens should be revoked
     * @return the number of rows updated
     */
    @Modifying
    @Query("update AppRefreshToken t set t.revoked = true where t.userId = :userId and t.revoked = false")
    int revokeAllForUser(@Param("userId") UUID userId);

    /**
     * Deletes all refresh-token records that expired before the given instant (scheduled cleanup).
     *
     * @param now the cutoff instant
     * @return the number of rows deleted
     */
    @Modifying
    @Query("delete from AppRefreshToken t where t.expiresAt < :now")
    int deleteExpired(@Param("now") Instant now);
}
