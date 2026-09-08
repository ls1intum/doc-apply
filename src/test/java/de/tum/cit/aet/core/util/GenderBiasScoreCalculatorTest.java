package de.tum.cit.aet.core.util;

import static org.assertj.core.api.Assertions.assertThat;

import de.tum.cit.aet.core.constants.GenderCategory;
import java.util.List;
import org.junit.jupiter.api.Test;

class GenderBiasScoreCalculatorTest {

    @Test
    void shouldCalculateCombinedGenderScoreWhenBothAnalysesArePresent() {
        List<GenderCategory> original = List.of(GenderCategory.INCLUSIVE);
        List<GenderCategory> translated = List.of(GenderCategory.NON_INCLUSIVE, GenderCategory.INCLUSIVE);

        int score = GenderBiasScoreCalculator.calculateGenderScore(original, translated, "text", "translated text");

        assertThat(score).isEqualTo(86);
    }

    @Test
    void shouldCalculateSingleLanguageGenderScoreWhenTranslatedAnalysisIsMissing() {
        List<GenderCategory> original = List.of(GenderCategory.NON_INCLUSIVE, GenderCategory.INCLUSIVE);

        int score = GenderBiasScoreCalculator.calculateGenderScore(original, null, "text", "");

        assertThat(score).isEqualTo(71);
    }
}
