package de.tum.cit.aet.ai.util;

import static org.assertj.core.api.Assertions.assertThat;

import de.tum.cit.aet.ai.constants.ComplianceCategory;
import de.tum.cit.aet.ai.util.ComplianceScoreCalculator.ComplianceScoreIssue;
import de.tum.cit.aet.core.constants.GenderCategory;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class ComplianceScoreCalculatorTest {

    @Test
    void shouldCountMappedLanguageCopiesOnlyOnce() {
        ComplianceScoreIssue english = new ComplianceScoreIssue("finding-1", ComplianceCategory.TRANSPARENCY);
        ComplianceScoreIssue german = new ComplianceScoreIssue("finding-1", ComplianceCategory.TRANSPARENCY);

        int score = ComplianceScoreCalculator.calculateCombinedAiScore(100, List.of(english, german));

        // legal = 100 * 0.85 = 85; overall = sqrt(100 * 85) = 92
        assertThat(score).isEqualTo(92);
    }

    // ===== CALCULATE LEGAL SCORE =====
    @Nested
    class CalculateLegalScoreTests {

        @ParameterizedTest(name = "{0} should result in legal score {2}")
        @MethodSource("provideScoreTestCases")
        void shouldCalculateLegalScoreCorrectly(String scenario, List<ComplianceCategory> categories, int expectedScore) {
            int score = ComplianceScoreCalculator.calculateLegalScore(categories);

            assertThat(score).isEqualTo(expectedScore);
        }

        private static Stream<Arguments> provideScoreTestCases() {
            return Stream.of(
                Arguments.of("Empty issues", List.of(), 100),
                Arguments.of("Critical AGG issue", List.of(ComplianceCategory.CRITICAL_AGG), 0),
                Arguments.of("Transparency penalties", List.of(ComplianceCategory.TRANSPARENCY, ComplianceCategory.TRANSPARENCY), 72)
            );
        }
    }

    // ===== CALCULATE GENDER SCORE =====
    @Nested
    class CalculateGenderScoreTests {

        @Test
        void shouldCalculateCombinedGenderScoreWhenBothAnalysesArePresent() {
            List<GenderCategory> original = List.of(GenderCategory.INCLUSIVE);
            List<GenderCategory> translated = List.of(GenderCategory.NON_INCLUSIVE, GenderCategory.INCLUSIVE);

            int score = ComplianceScoreCalculator.calculateGenderScore(original, translated, "text", "translated text");

            assertThat(score).isEqualTo(86);
        }

        @Test
        void shouldCalculateSingleLanguageGenderScoreWhenTranslatedAnalysisIsMissing() {
            List<GenderCategory> original = List.of(GenderCategory.NON_INCLUSIVE, GenderCategory.INCLUSIVE);

            int score = ComplianceScoreCalculator.calculateGenderScore(original, null, "text", "");

            assertThat(score).isEqualTo(71);
        }
    }
}
