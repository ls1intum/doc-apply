package de.tum.cit.aet.ai.dto;

import de.tum.cit.aet.ai.constants.ComplianceAction;
import de.tum.cit.aet.ai.constants.ComplianceCategory;
import de.tum.cit.aet.ai.domain.ComplianceIssue;

public record ComplianceIssueDTO(
    String id,
    ComplianceCategory category,
    String text,
    String article,
    String explanation,
    ComplianceAction action,
    String language
) {
    public static ComplianceIssueDTO from(ComplianceIssue issue) {
        return new ComplianceIssueDTO(
            issue.getId(),
            issue.getCategory(),
            issue.getText(),
            issue.getArticle(),
            issue.getExplanation(),
            issue.getAction(),
            issue.getLanguage()
        );
    }
}
