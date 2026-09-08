package de.tum.cit.aet.core.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.core.constants.GenderCategory;
import de.tum.cit.aet.core.domain.BiasedIssue;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record BiasedIssueDTO(String language, String word, GenderCategory type) {
    public static BiasedIssueDTO from(BiasedIssue issue) {
        return new BiasedIssueDTO(issue.getLanguage(), issue.getWord(), issue.getType());
    }
}
