package de.tum.cit.aet.ai.domain;

import de.tum.cit.aet.ai.constants.AiUsageFeature;
import de.tum.cit.aet.core.domain.AbstractAuditingEntity;
import de.tum.cit.aet.core.domain.export.NoUserDataExportRequired;
import de.tum.cit.aet.usermanagement.domain.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * Records a single trigger of an AI feature. One row is written every time a user invokes
 * an AI feature (both on success and failure), which the admin analytics dashboard aggregates
 * into usage-over-time charts.
 *
 * The trigger timestamp is the inherited {@code createdAt} column. The referencing user is
 * kept for potential future per-user / per-role breakdowns; the foreign key is nullable and set
 * to {@code null} on user deletion so historical analytics survive.
 */
@Entity
@Getter
@Setter
@Table(name = "ai_usage_events")
@NoUserDataExportRequired(reason = "Operational usage analytics, not part of the exported user-personal payload")
public class AiUsageEvent extends AbstractAuditingEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "ai_usage_event_id", nullable = false, updatable = false)
    private UUID aiUsageEventId;

    @Enumerated(EnumType.STRING)
    @Column(name = "feature", nullable = false)
    private AiUsageFeature feature;

    @Column(name = "success", nullable = false)
    private boolean success;

    @Column(name = "input_tokens")
    private Integer inputTokens;

    @Column(name = "output_tokens")
    private Integer outputTokens;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;
}
