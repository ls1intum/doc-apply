package de.tum.cit.aet.ai.dto;

import de.tum.cit.aet.ai.domain.BiasedIssue;
import de.tum.cit.aet.core.constants.GenderCategory;

public record BiasedIssueDTO(String language, String word, GenderCategory type) {
    public static BiasedIssueDTO from(BiasedIssue issue) {
        return new BiasedIssueDTO(issue.getLanguage(), issue.getWord(), issue.getType());
    }
}
