package de.tum.cit.aet.ai.util;

import static org.assertj.core.api.Assertions.assertThat;

import de.tum.cit.aet.ai.constants.ComplianceAction;
import de.tum.cit.aet.ai.constants.ComplianceCategory;
import de.tum.cit.aet.ai.domain.ComplianceIssue;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class ComplianceSuggestionNormalizerTest {

    private static final String TEXT =
        "We are a young and dynamic team. The ideal candidate is between 25 and 30 years old, a native speaker. " +
        "We work with industry partners. By applying, you consent to your data being shared with industry partners.";

    @ParameterizedTest
    @CsvSource(
        delimiter = '|',
        value = {
            "between 25 and 30 years old | The ideal candidate is between 20 and 45 years old | between 20 and 45 years old",
            "between 25 and 30 years old | a highly qualified researcher, a native speaker | a highly qualified researcher",
            "young and dynamic | motivated | motivated",
        }
    )
    void shouldTrimWordsAroundTheSnippetWhenReplacementRepeatsThem(String snippet, String suggestion, String expected) {
        List<ComplianceIssue> result = ComplianceSuggestionNormalizer.normalize(
            TEXT,
            List.of(issue(ComplianceAction.REPLACE, snippet, suggestion))
        );

        assertThat(result).singleElement().extracting(ComplianceIssue::getSuggestion).isEqualTo(expected);
    }

    @Test
    void shouldDropReplacementWhenOnlyTheSnippetRemains() {
        List<ComplianceIssue> result = ComplianceSuggestionNormalizer.normalize(
            TEXT,
            List.of(
                issue(ComplianceAction.REPLACE, "a native speaker", "The ideal candidate is between 25 and 30 years old, a native speaker")
            )
        );

        assertThat(result).isEmpty();
    }

    @Test
    void shouldDropAdditionWhenTheDescriptionAlreadyContainsTheSentence() {
        List<ComplianceIssue> result = ComplianceSuggestionNormalizer.normalize(
            TEXT,
            List.of(
                issue(
                    ComplianceAction.ADD,
                    "industry partners",
                    "By applying, you consent to your data being shared with Industry Partners"
                ),
                issue(ComplianceAction.ADD, "dynamic team", "This position serves the scientific qualification of doctoral candidates.")
            )
        );

        assertThat(result).singleElement().extracting(ComplianceIssue::getText).isEqualTo("dynamic team");
    }

    @Test
    void shouldEndAnAddedSentenceWithAFullStopWhenTheModelLeftItOut() {
        List<ComplianceIssue> result = ComplianceSuggestionNormalizer.normalize(
            TEXT,
            List.of(issue(ComplianceAction.ADD, "dynamic team", "This position serves the scientific qualification of doctoral candidates"))
        );

        assertThat(result)
            .singleElement()
            .extracting(ComplianceIssue::getSuggestion)
            .isEqualTo("This position serves the scientific qualification of doctoral candidates.");
    }

    private static ComplianceIssue issue(ComplianceAction action, String text, String suggestion) {
        return new ComplianceIssue("1", ComplianceCategory.CRITICAL_AGG, text, "§ 1 AGG", "explanation", action, suggestion, "en");
    }
}
