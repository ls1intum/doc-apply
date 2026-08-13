package de.tum.cit.aet.ai.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.ai.constants.ComplianceAction;
import de.tum.cit.aet.ai.constants.ComplianceCategory;
import de.tum.cit.aet.ai.domain.ComplianceIssue;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record ComplianceIssueDTO(
    String id,
    ComplianceCategory category,
    String text,
    String article,
    String explanation,
    ComplianceAction action,
    String language
) {
    /**
     * Creates a DTO from a persisted compliance issue.
     *
     * @param issue the persisted compliance issue
     * @return the mapped compliance issue DTO
     */
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
