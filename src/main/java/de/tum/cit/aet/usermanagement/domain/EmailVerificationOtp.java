package de.tum.cit.aet.usermanagement.domain;

import de.tum.cit.aet.core.domain.export.NoUserDataExportRequired;
import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

/**
 * Entity representing a one-time password (OTP) used for email verification.
 * Stores hashed OTP codes with metadata such as expiration, attempt count, and whether the code has already been
 * used. Ensures single-use and time-limited verification for account security.
 */
@Getter
@Setter
@Entity
@NoUserDataExportRequired(reason = "Security one-time codes are not exported to users")
@Table(
    name = "email_verification_otp",
    indexes = {
        @Index(name = "idx_evo_email_created", columnList = "email, created_at"),
        @Index(name = "idx_evo_jti", columnList = "jti", unique = true),
        @Index(name = "idx_evo_email_used_expires", columnList = "email, used, expires_at"),
        @Index(name = "idx_evo_expires_at", columnList = "expires_at"),
    }
)
public class EmailVerificationOtp implements Serializable {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false, length = 36)
    private UUID id;

    @Column(name = "email", nullable = false, length = 320)
    private String email;

    @Column(name = "code_hash", nullable = false, length = 255)
    private String codeHash;

    @Column(name = "salt", nullable = false, length = 64)
    private String salt;

    @Column(name = "jti", nullable = false, length = 64, unique = true)
    private String jti;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "max_attempts", nullable = false)
    private int maxAttempts;

    @Column(name = "attempts", nullable = false)
    private int attempts = 0;

    @Column(name = "used", nullable = false)
    private boolean used = false;

    @Column(name = "ip_hash", nullable = false, length = 255)
    private String ipHash;

    @PrePersist
    void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = java.time.Instant.now();
        }
        if (this.attempts < 0) {
            this.attempts = 0;
        }
    }
}
