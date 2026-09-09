package de.tum.cit.aet.usermanagement.domain;

import de.tum.cit.aet.core.domain.export.NoUserDataExportRequired;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Records that the account behind a user id was deleted, and when.
 *
 * A valid access token outlives the row it authenticates, so without this marker the next request
 * from a deleted user would provision them again. The timestamp is what separates that stale token
 * from a genuine new sign-in, which is allowed and removes the marker.
 */
@Getter
@Setter
@Entity
@NoUserDataExportRequired(reason = "Holds only the id and deletion time of an account that no longer exists")
@Table(name = "deleted_users")
public class DeletedUser {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "deleted_at", nullable = false)
    private LocalDateTime deletedAt;
}
