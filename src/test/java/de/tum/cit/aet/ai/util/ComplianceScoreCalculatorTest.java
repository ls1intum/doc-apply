package de.tum.cit.aet.ai.util;

import static org.assertj.core.api.Assertions.assertThat;

import de.tum.cit.aet.ai.constants.ComplianceAction;
import de.tum.cit.aet.ai.constants.ComplianceCategory;
import de.tum.cit.aet.ai.domain.ComplianceIssue;
import de.tum.cit.aet.core.constants.GenderCategory;
import java.util.List;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class ComplianceScoreCalculatorTest {

    @Test
    void shouldCountMappedLanguageCopiesOnlyOnce() {
        ComplianceIssue english = issue("finding-1", "External cooperation", "en");
        ComplianceIssue german = issue("finding-1", "Externe Kooperation", "de");

        int score = ComplianceScoreCalculator.calculateCombinedAiScore(100, List.of(english, german));

        // legal = 100 * 0.85 = 85; overall = sqrt(100 * 85) = 92
        assertThat(score).isEqualTo(92);
    }

    private static ComplianceIssue issue(String id, String text, String language) {
        return new ComplianceIssue(
            id,
            ComplianceCategory.TRANSPARENCY,
            text,
            "Art. 13/14 DSGVO",
            "External data sharing is not disclosed.",
            ComplianceAction.ADD,
            language
        );
    }

    // ===== CALCULATE LEGAL SCORE =====
    @Nested
    class CalculateLegalScoreTests {

        @Test
        void shouldReturnHundredLegalScoreWhenComplianceIssuesAreEmpty() {
            int score = ComplianceScoreCalculator.calculateLegalScore(List.of());

            assertThat(score).isEqualTo(100);
        }

        @Test
        void shouldReturnZeroLegalScoreWhenCriticalAggIssueExists() {
            List<ComplianceCategory> categories = List.of(ComplianceCategory.CRITICAL_AGG);

            int score = ComplianceScoreCalculator.calculateLegalScore(categories);

            assertThat(score).isZero();
        }

        @Test
        void shouldApplyTransparencyPenaltyWhenOnlyTransparencyIssuesExist() {
            List<ComplianceCategory> categories = List.of(ComplianceCategory.TRANSPARENCY, ComplianceCategory.TRANSPARENCY);

            int score = ComplianceScoreCalculator.calculateLegalScore(categories);

            assertThat(score).isEqualTo(72);
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
