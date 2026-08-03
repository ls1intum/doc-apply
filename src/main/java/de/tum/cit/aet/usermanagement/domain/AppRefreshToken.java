package de.tum.cit.aet.usermanagement.domain;

import de.tum.cit.aet.core.domain.export.NoUserDataExportRequired;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.sql.Types;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;

/**
 * Tracks a refresh token issued by {@code AppTokenService} so it can be revoked on logout and
 * rotated on use. Refresh tokens are self-contained signed JWTs; this table records their {@code jti}
 * (token id) and revocation state to give the otherwise-stateless tokens server-side revocation and
 * replay detection.
 */
@Getter
@Setter
@Entity
@NoUserDataExportRequired(reason = "Security session tokens are not exported to users")
@Table(
    name = "app_refresh_token",
    indexes = { @Index(name = "idx_art_user", columnList = "user_id"), @Index(name = "idx_art_expires_at", columnList = "expires_at") }
)
public class AppRefreshToken implements Serializable {

    @Id
    @Column(name = "jti", nullable = false, updatable = false, length = 36)
    private String jti;

    @JdbcTypeCode(Types.VARCHAR)
    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked", nullable = false)
    private boolean revoked = false;

    @PrePersist
    void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
    }
}
