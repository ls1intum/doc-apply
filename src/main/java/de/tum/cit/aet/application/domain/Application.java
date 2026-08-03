package de.tum.cit.aet.application.domain;

import de.tum.cit.aet.application.constants.ApplicationState;
import de.tum.cit.aet.core.documents.domain.ApplicationDocument;
import de.tum.cit.aet.core.domain.AbstractAuditingEntity;
import de.tum.cit.aet.core.domain.export.ExportedUserData;
import de.tum.cit.aet.core.domain.export.UserDataExportProviderType;
import de.tum.cit.aet.evaluation.domain.ApplicationReview;
import de.tum.cit.aet.evaluation.domain.InternalComment;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.reference.domain.ReferenceRequest;
import de.tum.cit.aet.usermanagement.domain.Applicant;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@ExportedUserData(by = UserDataExportProviderType.APPLICANT)
@Getter
@Setter
@Table(name = "applications")
@AllArgsConstructor
@NoArgsConstructor
public class Application extends AbstractAuditingEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "application_id", nullable = false)
    private UUID applicationId;

    @OneToOne(mappedBy = "application", cascade = CascadeType.ALL, orphanRemoval = true)
    private ApplicationReview applicationReview;

    @ManyToOne
    @JoinColumn(name = "applicant_id", nullable = false)
    private Applicant applicant;

    @ManyToOne
    @JoinColumn(name = "job_id", nullable = false)
    private Job job;

    @Column(name = "application_state", nullable = false)
    @Enumerated(EnumType.STRING)
    private ApplicationState state;

    @Column(name = "desired_start_date")
    private LocalDate desiredStartDate;

    @Column(name = "applied_at")
    private LocalDateTime appliedAt;

    @Column(name = "projects")
    private String projects;

    @Column(name = "special_skills")
    private String specialSkills;

    @Column(name = "motivation")
    private String motivation;

    // Snapshot of applicant's User data at time of application creation/submission
    @Column(name = "applicant_first_name")
    private String applicantFirstName;

    @Column(name = "applicant_last_name")
    private String applicantLastName;

    @Column(name = "applicant_email")
    private String applicantEmail;

    @Column(name = "applicant_gender")
    private String applicantGender;

    @Column(name = "applicant_nationality")
    private String applicantNationality;

    @Column(name = "applicant_birthday")
    private LocalDate applicantBirthday;

    @Column(name = "applicant_phone_number")
    private String applicantPhoneNumber;

    @Column(name = "applicant_website")
    private String applicantWebsite;

    @Column(name = "applicant_linkedin_url")
    private String applicantLinkedinUrl;

    // Snapshot of applicant's address data
    @Column(name = "applicant_street")
    private String applicantStreet;

    @Column(name = "applicant_postal_code")
    private String applicantPostalCode;

    @Column(name = "applicant_city")
    private String applicantCity;

    @Column(name = "applicant_country")
    private String applicantCountry;

    // Snapshot of applicant's bachelor degree data
    @Column(name = "applicant_bachelor_degree_name")
    private String applicantBachelorDegreeName;

    @Column(name = "applicant_bachelor_grade_upper_limit")
    private String applicantBachelorGradeUpperLimit;

    @Column(name = "applicant_bachelor_grade_lower_limit")
    private String applicantBachelorGradeLowerLimit;

    @Column(name = "applicant_bachelor_grade")
    private String applicantBachelorGrade;

    @Column(name = "applicant_bachelor_university")
    private String applicantBachelorUniversity;

    // Snapshot of applicant's master degree data
    @Column(name = "applicant_master_degree_name")
    private String applicantMasterDegreeName;

    @Column(name = "applicant_master_grade_upper_limit")
    private String applicantMasterGradeUpperLimit;

    @Column(name = "applicant_master_grade_lower_limit")
    private String applicantMasterGradeLowerLimit;

    @Column(name = "applicant_master_grade")
    private String applicantMasterGrade;

    @Column(name = "applicant_master_university")
    private String applicantMasterUniversity;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, mappedBy = "application")
    private Set<InternalComment> internalComments;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, mappedBy = "application")
    private Set<ApplicationDocument> applicationDocuments;

    @Column(name = "reference_letters_confidential", nullable = false)
    private boolean referenceLettersConfidential = true;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, mappedBy = "application")
    private Set<ReferenceRequest> referenceRequests;
}
