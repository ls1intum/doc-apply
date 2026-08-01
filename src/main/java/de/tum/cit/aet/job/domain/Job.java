package de.tum.cit.aet.job.domain;

import de.tum.cit.aet.ai.domain.ComplianceIssue;
import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.core.domain.AbstractAuditingEntity;
import de.tum.cit.aet.core.domain.Image;
import de.tum.cit.aet.core.domain.export.ExportedUserData;
import de.tum.cit.aet.core.domain.export.UserDataExportProviderType;
import de.tum.cit.aet.job.constants.*;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * A Job.
 */
@Getter
@Setter
@Entity
@ExportedUserData(by = UserDataExportProviderType.STAFF)
@Table(name = "jobs")
public class Job extends AbstractAuditingEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "job_id", nullable = false)
    private UUID jobId;

    @ManyToOne
    @JoinColumn(name = "professor_id", nullable = false)
    private User supervisingProfessor;

    @ManyToOne
    @JoinColumn(name = "research_group_id", nullable = false)
    private ResearchGroup researchGroup;

    /**
     * Optional banner image for the job posting
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "image_id")
    private Image image;

    @Enumerated(EnumType.STRING)
    @Column(name = "subject_area")
    private SubjectArea subjectArea;

    @Column(name = "research_area")
    private String researchArea;

    @Enumerated(EnumType.STRING)
    @Column(name = "location")
    private Campus location;

    @Column(name = "workload")
    private Integer workload;

    @Column(name = "contract_duration")
    private Integer contractDuration;

    @Enumerated(EnumType.STRING)
    @Column(name = "funding_type")
    private FundingType fundingType;

    @Enumerated(EnumType.STRING)
    @Column(name = "tvl_grade")
    private TvlGrade tvlGrade;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "job_description_en")
    private String jobDescriptionEN;

    @Column(name = "job_description_de")
    private String jobDescriptionDE;

    @Enumerated(EnumType.STRING)
    @Column(name = "state", nullable = false)
    private JobState state;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "start_date_by_arrangement", nullable = false)
    private Boolean startDateByArrangement = false;

    @Column(name = "suitable_for_disabled")
    private Boolean suitableForDisabled;

    @Column(name = "reference_letters_required", nullable = false)
    private Integer referenceLettersRequired = 0;

    @Enumerated(EnumType.STRING)
    @Column(name = "recommendation_type")
    private RecommendationType recommendationType;

    // Contains all the Applications that are submitted to this Job
    @OneToMany(mappedBy = "job", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<Application> applications;

    // Compliance fields for score calculation
    @Column(name = "gender_bias_score")
    private Integer genderBiasScore;

    @ElementCollection
    @CollectionTable(name = "job_compliance_issues", joinColumns = @JoinColumn(name = "job_id"))
    private List<ComplianceIssue> complianceIssues = new ArrayList<>();
}
