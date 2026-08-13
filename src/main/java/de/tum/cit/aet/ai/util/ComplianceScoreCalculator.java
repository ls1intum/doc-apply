package de.tum.cit.aet.ai.util;

import de.tum.cit.aet.ai.constants.ComplianceCategory;
import de.tum.cit.aet.ai.domain.ComplianceIssue;
import de.tum.cit.aet.core.constants.GenderCategory;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

public final class ComplianceScoreCalculator {

    private static final double FACTOR_NEUTRAL = 1.0;
    private static final double FACTOR_NON_INCLUSIVE = 0.5;
    private static final double PENALTY_FACTOR = 0.85;

    private ComplianceScoreCalculator() {}

    /**
     * Calculates a legal compliance score based on a hierarchical risk model.
     * * The calculation follows the Gatekeeper-Principle for severe risks and Exponential Decay
     * for minor issues. If a CRITICAL or DSGVO violation is detected, the score is immediately 0
     * (Veto-Principle), as these represent non-negotiable legal liabilities.
     * * For transparency issues, the score is reduced multiplicatively using the formula
     * S(n) = 100 * 0.85^n. The decay factor of 0.85 is set to trigger a critical
     * threshold (~60%) after three cumulative issues, reflecting the diminishing
     * marginal quality of the job description. This approach mirrors risk assessment
     * standards like ISO 31000 and prevents negative scores common in linear models.
     *
     * @param categories the categories of identified compliance issues
     * @return an integer score from 0 to 100 representing legal integrity
     */
    public static int calculateLegalScore(List<ComplianceCategory> categories) {
        if (categories == null || categories.isEmpty()) {
            return 100;
        }

        Map<ComplianceCategory, Long> counts = categories
            .stream()
            .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));

        if (counts.getOrDefault(ComplianceCategory.CRITICAL_AGG, 0L) > 0) {
            return 0;
        }

        double totalCount = (double) counts.getOrDefault(ComplianceCategory.TRANSPARENCY, 0L);

        double score = 100.0 * Math.pow(PENALTY_FACTOR, totalCount);
        return (int) Math.max(0, Math.round(score));
    }

    /**
     * Combines the gender inclusivity score with the legal compliance score using
     * their geometric mean. Compliance issues that represent the same finding in
     * multiple languages are counted only once based on their non-empty identifier.
     *
     * @param genderScore the gender inclusivity score from 0 to 100
     * @param complianceIssues the detected compliance issues across all languages
     * @return the combined AI score from 0 to 100
     */
    public static int calculateCombinedAiScore(int genderScore, List<ComplianceIssue> complianceIssues) {
        Set<String> issueIds = new HashSet<>();
        int legalScore = calculateLegalScore(
            complianceIssues.stream()
                .filter(issue -> issue.getId() == null || issue.getId().isBlank() || issueIds.add(issue.getId()))
                .map(ComplianceIssue::getCategory)
                .toList()
        );
        return (int) Math.round(Math.sqrt((double) genderScore * legalScore));
    }

    /**
     * Calculates the combined gender bias score across two languages for consistency.
     *
     * @param originalAnalysis The analysis results for the primary description language.
     * @param translatedAnalysis The analysis results for the secondary/translated language.
     * @param originalText The original text for score calculation.
     * @param translatedText The translated text for score calculation.
     * @return the combined gender bias score (0-100)
     */
    public static int calculateCombinedScore(
        List<GenderCategory> originalAnalysis,
        List<GenderCategory> translatedAnalysis,
        String originalText,
        String translatedText
    ) {
        int scoreDE = calculateScore(originalAnalysis, originalText);
        int scoreEN = calculateScore(translatedAnalysis, translatedText);
        return (int) Math.round((scoreDE + scoreEN) / 2.0);
    }

    /**
     * Determines the final gender score from available analyses.
     * This approach ensures scoring stability and consistency across multilingual job descriptions after
     * translation.
     *
     * @param originalAnalysis Analysis results for the primary description language.
     * @param translatedAnalysis Analysis results for the secondary/translated language.
     * @param originalText The original text for score calculation.
     * @param translatedText The translated text for score calculation.
     * @return A compiled integer score (0-100) based on the most comprehensive data available.
     */
    public static int calculateGenderScore(
        List<GenderCategory> originalAnalysis,
        List<GenderCategory> translatedAnalysis,
        String originalText,
        String translatedText
    ) {
        // If both language versions are available, the combined version is set.
        if (originalAnalysis != null && translatedAnalysis != null) {
            return calculateCombinedScore(originalAnalysis, translatedAnalysis, originalText, translatedText);
        }
        // If only one lang is present, it falls back to the single-language score calculation.
        if (originalAnalysis != null) {
            return calculateScore(originalAnalysis, originalText);
        }
        if (translatedAnalysis != null) {
            return calculateScore(translatedAnalysis, translatedText);
        }
        return 0;
    }

    /**
     * Calculates the compliance score from one gender analysis result.
     * The calculation is performed in several steps:
     * 1) Calculates the ratio (`inclusiveWeight`) of inclusive words to the total number of flagged words (inclusive + non-inclusive)
     * 2) Applies a factor of 0.5 when non-inclusive occurrences outnumber inclusive occurrences;
     * otherwise, the factor is 1.0.
     * 3) The final score is derived from the square root of (`inclusiveWeight` * factor) and scaled to a 0-100 range.
     * The square root is applied to soften the penalty curve and avoid overly harsh scores.
     *
     * @param analysis - The result of the gender bias analysis.
     * @param originalText - The original text for score-calculation
     * @return An integer between 0 and 100 representing the inclusivity score.
     */
    public static int calculateScore(List<GenderCategory> analysis, String originalText) {
        if (originalText == null || originalText.trim().isEmpty()) {
            return 0;
        }

        if (analysis == null || analysis.isEmpty()) {
            return 100;
        }

        long inclusiveCount = analysis.stream().filter(GenderCategory.INCLUSIVE::equals).count();
        long nonInclusiveCount = analysis.stream().filter(GenderCategory.NON_INCLUSIVE::equals).count();

        if (nonInclusiveCount == 0) {
            return 100;
        }

        double totalCount = (double) inclusiveCount + (double) nonInclusiveCount;
        double inclusiveWeight = inclusiveCount / totalCount;

        double factor = nonInclusiveCount > inclusiveCount ? FACTOR_NON_INCLUSIVE : FACTOR_NEUTRAL;
        double score = Math.sqrt(inclusiveWeight * factor) * 100.0;

        return (int) Math.max(0, Math.min(100, Math.round(score)));
    }
}
