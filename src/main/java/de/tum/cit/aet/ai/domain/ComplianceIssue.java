package de.tum.cit.aet.ai.domain;

import de.tum.cit.aet.ai.constants.ComplianceAction;
import de.tum.cit.aet.ai.constants.ComplianceCategory;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Embeddable
@NoArgsConstructor
@AllArgsConstructor
public class ComplianceIssue {

    private String id;

    @Enumerated(EnumType.STRING)
    private ComplianceCategory category;

    private String text;
    private String article;
    private String explanation;

    @Enumerated(EnumType.STRING)
    private ComplianceAction action;

    private String suggestion;
    private String language;
}
