package de.tum.cit.aet.usermanagement.repository;

import de.tum.cit.aet.core.repository.TumApplyJpaRepository;
import de.tum.cit.aet.usermanagement.domain.EmailVerificationOtp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA repository for the {@link EmailVerificationOtp} entity.
 * Repository enforcing a single-active-OTP-per-email policy and optimized lookups.
 */
@Repository
public interface EmailVerificationOtpRepository extends TumApplyJpaRepository<EmailVerificationOtp, UUID> {
    /**
     * Returns the most recent active OTP for the given email.
     * <p>
     * An OTP is considered active if used=false and expiresAt > now.
     *
     * @param email normalized email to search for (trimmed, lower-cased)
     * @param now   current timestamp used for the expiry comparison
     * @return the newest matching OTP, if present
     */
    Optional<EmailVerificationOtp> findTop1ByEmailAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(String email, Instant now);

    /**
     * Returns the most recently created still-unused OTP for the given email. Used to enforce the server-side
     * resend cooldown without blocking a legitimate new request after a previous code was already consumed
     * (e.g. log out then OTP-login again, or registration → login).
     *
     * @param email normalized email to search for (trimmed, lower-cased)
     * @return the newest unused OTP for the email, if any
     */
    Optional<EmailVerificationOtp> findTop1ByEmailAndUsedFalseOrderByCreatedAtDesc(String email);

    /**
     * Invalidates all unused OTPs for the given email by setting {@code used=true}.
     * <p>
     * Call this before creating a new OTP to enforce a single-active-code policy. Note that the update does
     * not check expiresAt; therefore, it will also mark previously expired but unused OTPs as used,
     * which is acceptable and simplifies cleanup.
     *
     * @param email normalized email whose unused OTPs should be invalidated
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update EmailVerificationOtp e set e.used = true where e.email = :email and e.used = false")
    void invalidateAllForEmail(@Param("email") String email);

    /**
     * Atomically marks a specific OTP as used if it is still active at the time of update.
     *
     * @param id  OTP identifier
     * @param now current timestamp used for the expiry comparison
     * @return number of rows updated (0 if already used/expired/not found)
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update EmailVerificationOtp e set e.used = true where e.id = :id and e.used = false and e.expiresAt > :now")
    int markUsedIfActive(@Param("id") UUID id, @Param("now") Instant now);

    /**
     * Atomically increments the {@code attempts} counter for the given OTP if it is still active.
     * <p>
     * If the post-increment value would reach maxAttempts (i.e., attempts + 1 >= maxAttempts),
     * the OTP is burned in the same statement by setting used=true. This avoids races between
     * parallel verifications.
     *
     * @param id  OTP identifier
     * @param now current timestamp used for the expiry comparison
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        "update EmailVerificationOtp e set e.used = (case when e.attempts >= e.maxAttempts - 1 then true else e.used end), e.attempts = e.attempts + 1 where e.id = :id and e.used = false and e.expiresAt > :now"
    )
    void incrementAttemptsIfActive(@Param("id") UUID id, @Param("now") Instant now);
}
