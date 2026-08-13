package de.tum.cit.aet.ai.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.ai.domain.BiasedIssue;
import de.tum.cit.aet.core.constants.GenderCategory;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record BiasedIssueDTO(String language, String word, GenderCategory type) {
    public static BiasedIssueDTO from(BiasedIssue issue) {
        return new BiasedIssueDTO(issue.getLanguage(), issue.getWord(), issue.getType());
    }
}
