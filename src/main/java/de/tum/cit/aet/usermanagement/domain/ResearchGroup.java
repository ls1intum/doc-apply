package de.tum.cit.aet.usermanagement.domain;

import de.tum.cit.aet.core.domain.AbstractAuditingEntity;
import de.tum.cit.aet.core.domain.export.NoUserDataExportRequired;
import de.tum.cit.aet.usermanagement.constants.ResearchGroupState;
import jakarta.persistence.*;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * A ResearchGroup.
 */
@Getter
@Setter
@Entity
@NoUserDataExportRequired(reason = "Organizational master data is not part of user-personal export scope")
@Table(name = "research_groups")
public class ResearchGroup extends AbstractAuditingEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "research_group_id", nullable = false)
    private UUID researchGroupId;

    @Column(name = "head")
    private String head;

    @Column(name = "name")
    private String name;

    @Column(name = "abbreviation")
    private String abbreviation;

    @Column(name = "email")
    private String email;

    @Column(name = "website")
    private String website;

    @ManyToOne
    @JoinColumn(name = "department_id")
    private Department department;

    @Column(name = "description")
    private String description;

    @Column(name = "street")
    private String street;

    @Column(name = "postal_code")
    private String postalCode;

    @Column(name = "city")
    private String city;

    @Column(name = "university_id", nullable = false)
    private String universityId;

    @Column(name = "state", nullable = false)
    @Enumerated(EnumType.STRING)
    private ResearchGroupState state = ResearchGroupState.DRAFT;

    @OneToMany(mappedBy = "researchGroup", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<UserResearchGroupRole> userRoles = new HashSet<>();

    /**
     * Derived method to get the school through the department relationship.
     * This ensures consistency - the school is always derived from the department.
     *
     * @return the school that this research group belongs to, or null if no department is set
     */
    public School getSchool() {
        return department != null ? department.getSchool() : null;
    }
}
