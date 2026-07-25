package de.tum.cit.aet.reference.domain;

import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.core.domain.AbstractAuditingEntity;
import de.tum.cit.aet.core.domain.export.ExportedUserData;
import de.tum.cit.aet.core.domain.export.UserDataExportProviderType;
import de.tum.cit.aet.reference.constants.AcquaintanceDepth;
import de.tum.cit.aet.reference.constants.AcquaintanceDuration;
import de.tum.cit.aet.reference.constants.OverallRecommendation;
import de.tum.cit.aet.reference.constants.PeerRating;
import de.tum.cit.aet.reference.constants.RefereeRelationship;
import de.tum.cit.aet.reference.constants.ReferenceRequestStatus;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * A request the applicant sends to an external referee asking them to upload a recommendation letter.
 */
@Getter
@Setter
@Entity
@ExportedUserData(by = UserDataExportProviderType.APPLICANT)
@Table(name = "reference_requests")
public class ReferenceRequest extends AbstractAuditingEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "reference_request_id", nullable = false)
    private UUID referenceRequestId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    private Application application;

    @Column(name = "title")
    private String title;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "token_hash")
    private String tokenHash;

    @Column(name = "token_expires_at")
    private LocalDateTime tokenExpiresAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ReferenceRequestStatus status = ReferenceRequestStatus.ADDED;

    @Column(name = "last_reminder_at")
    private LocalDateTime lastReminderAt;

    @Column(name = "reminder_count", nullable = false)
    private int reminderCount = 0;

    @Column(name = "document_id")
    private UUID documentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "relationship")
    private RefereeRelationship relationship;

    @Enumerated(EnumType.STRING)
    @Column(name = "acquaintance_duration")
    private AcquaintanceDuration acquaintanceDuration;

    @Enumerated(EnumType.STRING)
    @Column(name = "acquaintance_depth")
    private AcquaintanceDepth acquaintanceDepth;

    @Enumerated(EnumType.STRING)
    @Column(name = "rating_intellectual_ability")
    private PeerRating ratingIntellectualAbility;

    @Enumerated(EnumType.STRING)
    @Column(name = "rating_research_potential")
    private PeerRating ratingResearchPotential;

    @Enumerated(EnumType.STRING)
    @Column(name = "rating_motivation")
    private PeerRating ratingMotivation;

    @Enumerated(EnumType.STRING)
    @Column(name = "rating_communication")
    private PeerRating ratingCommunication;

    @Enumerated(EnumType.STRING)
    @Column(name = "rating_leadership")
    private PeerRating ratingLeadership;

    @Enumerated(EnumType.STRING)
    @Column(name = "rating_collaboration")
    private PeerRating ratingCollaboration;

    @Enumerated(EnumType.STRING)
    @Column(name = "overall_recommendation")
    private OverallRecommendation overallRecommendation;
}
