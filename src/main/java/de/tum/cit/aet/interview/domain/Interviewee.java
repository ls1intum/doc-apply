package de.tum.cit.aet.interview.domain;

import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.core.domain.AbstractAuditingEntity;
import de.tum.cit.aet.core.domain.export.ExportedUserData;
import de.tum.cit.aet.core.domain.export.UserDataExportProviderType;
import de.tum.cit.aet.evaluation.domain.RecommendationDecisionConverter;
import de.tum.cit.aet.evaluation.domain.enumeration.RecommendationDecision;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * Entity representing an applicant who has been added to an interview process.
 * Links an Application to an InterviewProcess and tracks interview related
 * state.
 */
@Entity
@ExportedUserData(by = UserDataExportProviderType.APPLICANT)
@Table(
    name = "interviewees",
    uniqueConstraints = @UniqueConstraint(name = "uk_interviewee_app_process", columnNames = { "application_id", "interview_process_id" })
)
@Getter
@Setter
public class Interviewee extends AbstractAuditingEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "interview_process_id", nullable = false)
    private InterviewProcess interviewProcess;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    private Application application;

    @OneToMany(mappedBy = "interviewee", fetch = FetchType.LAZY)
    private List<InterviewSlot> slots = new ArrayList<>();

    /**
     * Timestamp of when the last invitation email was sent.
     * Null if no invitation has been sent yet.
     */
    @Column(name = "last_invited")
    private Instant lastInvited;

    @Version
    @Column(name = "version")
    private Long version;

    /**
     * Recommendation decision from the interview, stored as its signed integer value.
     * Null if not yet assessed.
     */
    @Column(name = "rating")
    @Convert(converter = RecommendationDecisionConverter.class)
    private RecommendationDecision rating;

    /**
     * Professor's evaluation notes for this interviewee.
     * Null if no notes have been entered.
     */
    @Column(name = "assessment_notes", columnDefinition = "TEXT")
    private String assessmentNotes;

    /**
     * Gets the currently scheduled interview slot.
     * Currently only one slot per interviewee is supported.
     *
     * @return the scheduled slot, or null if none exists
     */
    public InterviewSlot getScheduledSlot() {
        return slots.isEmpty() ? null : slots.get(0);
    }

    /**
     * Checks if this interviewee has a scheduled slot.
     *
     * @return true if at least one slot is assigned
     */
    public boolean hasSlot() {
        return !slots.isEmpty();
    }
}
