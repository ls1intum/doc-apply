package de.tum.cit.aet.usermanagement.domain;

import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.core.documents.domain.ApplicantDocument;
import de.tum.cit.aet.core.domain.export.ExportedUserData;
import de.tum.cit.aet.core.domain.export.UserDataExportProviderType;
import de.tum.cit.aet.job.constants.SubjectArea;
import jakarta.persistence.*;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * An Applicant.
 */
@Getter
@Setter
@Entity
@ExportedUserData(by = UserDataExportProviderType.APPLICANT)
@Table(name = "applicants")
public class Applicant {

    @Id
    private UUID userId;

    @OneToOne
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    // Contains all the Applications that a User (Applicant) has submitted
    @OneToMany(mappedBy = "applicant", cascade = CascadeType.REMOVE, orphanRemoval = true)
    private Set<Application> submittedApplications;

    @OneToMany(mappedBy = "applicant", cascade = CascadeType.REMOVE, orphanRemoval = true)
    private Set<ApplicantDocument> applicantDocuments;

    @ElementCollection(targetClass = SubjectArea.class)
    @CollectionTable(name = "applicant_subject_area_subscriptions", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "subject_area", nullable = false)
    @Enumerated(EnumType.STRING)
    private Set<SubjectArea> subjectAreaSubscriptions = new HashSet<>();

    @Column(name = "street")
    private String street;

    @Column(name = "postal_code")
    private String postalCode;

    @Column(name = "city")
    private String city;

    @Column(name = "country")
    private String country;

    @Column(name = "bachelor_degree_name")
    private String bachelorDegreeName;

    @Column(name = "bachelor_grade_upper_limit")
    private String bachelorGradeUpperLimit;

    @Column(name = "bachelor_grade_lower_limit")
    private String bachelorGradeLowerLimit;

    @Column(name = "bachelor_grade")
    private String bachelorGrade;

    @Column(name = "bachelor_university")
    private String bachelorUniversity;

    @Column(name = "master_degree_name")
    private String masterDegreeName;

    @Column(name = "master_grade_upper_limit")
    private String masterGradeUpperLimit;

    @Column(name = "master_grade_lower_limit")
    private String masterGradeLowerLimit;

    @Column(name = "master_grade")
    private String masterGrade;

    @Column(name = "master_university")
    private String masterUniversity;

    @Column(name = "no_bachelor_degree", nullable = false)
    private boolean noBachelorDegree = false;

    @Column(name = "no_master_degree", nullable = false)
    private boolean noMasterDegree = false;

    @Column(name = "degree_status_explanation")
    private String degreeStatusExplanation;
}
