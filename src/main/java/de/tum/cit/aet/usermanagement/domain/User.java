package de.tum.cit.aet.usermanagement.domain;

import de.tum.cit.aet.core.domain.AbstractAuditingEntity;
import de.tum.cit.aet.core.domain.export.ExportedUserData;
import de.tum.cit.aet.core.domain.export.UserDataExportProviderType;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.notification.domain.EmailSetting;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A user.
 */
@Getter
@Setter
@Entity
@ExportedUserData(by = UserDataExportProviderType.USER_SETTINGS)
@Table(name = "users")
public class User extends AbstractAuditingEntity {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "email", nullable = false)
    private String email;

    /**
     * BCrypt hash of the user's password for local (in-app) authentication.
     * {@code null} for users who only authenticate via OTP, a federated provider or a passkey,
     * and for TUM staff who authenticate through Keycloak.
     */
    @Column(name = "password_hash")
    private String passwordHash;

    /**
     * Whether the user's email address has been verified (e.g. via an OTP or a federated provider
     * that asserts a verified email). Local password login requires a verified email.
     */
    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified = false;

    @Column(name = "avatar", length = 512)
    private String avatar;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Column(name = "gender")
    private String gender;

    @Column(name = "nationality")
    private String nationality;

    @Column(name = "birthday")
    private LocalDate birthday;

    @Column(name = "phone_number")
    private String phoneNumber;

    @Column(name = "website")
    private String website;

    @Column(name = "linkedin_url")
    private String linkedinUrl;

    @Column(name = "selected_language", nullable = false)
    private String selectedLanguage;

    @Column(name = "university_id", length = 7, unique = true)
    private String universityId;

    // Contains all the Jobs that a User (Professor) has posted
    @OneToMany(mappedBy = "supervisingProfessor", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<Job> postedJobs = new HashSet<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<UserResearchGroupRole> researchGroupRoles = new HashSet<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<EmailSetting> emailSettings = new HashSet<>();

    @Column(name = "last_activity_at")
    private LocalDateTime lastActivityAt;

    @Column(name = "ai_features_enabled", nullable = false)
    private boolean aiFeaturesEnabled = true;

    // First time the user used AI Features
    @Column(name = "ai_consented_at")
    private LocalDateTime aiConsentedAt;

    /**
     * Ensure defaults before persisting a new user.
     */
    @PrePersist
    public void prePersist() {
        if (this.selectedLanguage == null) {
            this.selectedLanguage = "en";
        }
    }
}
