package de.tum.cit.aet.ai.service;

import de.tum.cit.aet.ai.constants.ComplianceCategory;
import de.tum.cit.aet.ai.domain.ComplianceIssue;
import de.tum.cit.aet.core.dto.BiasedWordDTO;
import de.tum.cit.aet.core.dto.GenderBiasAnalysisResponse;
import java.util.Collections;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ComplianceScoreService {

    private static final double FACTOR_NEUTRAL = 1.0;
    private static final double FACTOR_NON_INCLUSIVE = 0.5;
    private static final double PENALTY_FACTOR = 0.85;

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
     * @param compliance the structured analysis containing identified compliance issues
     * @return an integer score from 0 to 100 representing legal integrity
     */
    protected int calculateLegalScore(List<ComplianceIssue> compliance) {
        if (compliance == null || compliance.isEmpty()) {
            return 100;
        }

        long criticalCount = compliance
            .stream()
            .filter(i -> ComplianceCategory.CRITICAL_AGG == i.getCategory())
            .count();

        long dsgvoCount = compliance
            .stream()
            .filter(i -> ComplianceCategory.DSGVO_MINIMIZATION == i.getCategory())
            .count();

        if (criticalCount > 0) {
            return 0;
        }

        if (dsgvoCount > 0) {
            return 0;
        }

        long transparencyCount = compliance
            .stream()
            .filter(i -> ComplianceCategory.TRANSPARENCY == i.getCategory())
            .count();

        long publicSectorCount = compliance
            .stream()
            .filter(i -> ComplianceCategory.PUBLIC_SECTOR == i.getCategory())
            .count();

        long totalCount = transparencyCount + publicSectorCount;

        double score = 100.0 * Math.pow(PENALTY_FACTOR, totalCount);
        return (int) Math.max(0, Math.round(score));
    }

    /**
     * Calculates the combined gender bias score across two languages for consistency.
     *
     * @param originalAnalysis The analysis results for the primary description language.
     * @param translatedAnalysis The analysis results for the secondary/translated language.
     * @return the combined gender bias score (0-100)
     */
    public int calculateCombinedScore(GenderBiasAnalysisResponse originalAnalysis, GenderBiasAnalysisResponse translatedAnalysis) {
        int scoreDE = calculateScore(originalAnalysis);
        int scoreEN = calculateScore(translatedAnalysis);
        return (int) Math.round((scoreDE + scoreEN) / 2.0);
    }

    /**
     * Determines the final gender score from available analyses.
     * This approach ensures scoring stability and consistency across multilingual job descriptions after
     * translation.
     *
     * @param originalAnalysis Analysis results for the primary description language.
     * @param translatedAnalysis Analysis results for the secondary/translated language.
     * @return A compiled integer score (0-100) based on the most comprehensive data available.
     */
    protected int calculateGenderScore(GenderBiasAnalysisResponse originalAnalysis, GenderBiasAnalysisResponse translatedAnalysis) {
        //If both language versions are available, the combined version is set.
        if (originalAnalysis != null && translatedAnalysis != null) {
            return calculateCombinedScore(originalAnalysis, translatedAnalysis);
        }
        //If only one lang is present, it falls back to the single-language score calculation.
        if (originalAnalysis != null) {
            return calculateScore(originalAnalysis);
        }
        if (translatedAnalysis != null) {
            return calculateScore(translatedAnalysis);
        }
        return 0;
    }

    /**
     * Calculates the compliance score from one gender analysis result.
     * The calculation is performed in several steps:
     * 1) Calculates the ratio (`inclusiveWeight`) of inclusive words to the total number of flagged words (inclusive + non-inclusive)
     * 2) Applies a penalty factor based on the overall coding of the analysis:
     * - 'neutral-coded': 1.0 (no penalty)
     * - 'inclusive-coded': 1.0 (no penalty))
     * - 'non-inclusive-coded': 0.5 (penalty)
     * 3) The final score is derived from the square root of (`inclusiveWeight` * factor) and scaled to a 0-100 range.
     * The square root is applied to soften the penalty curve and avoid overly harsh scores.
     *
     * @param analysis - The result of the gender bias analysis (including identified words and overall coding).
     * @returns An integer between 0 and 100 representing the inclusivity score.
     */
    protected int calculateScore(GenderBiasAnalysisResponse analysis) {
        if (analysis == null) {
            return 100;
        }

        if ("empty".equals(analysis.coding())) {
            boolean hasWords = analysis.biasedWords() != null && !analysis.biasedWords().isEmpty();
            return hasWords ? 0 : 100;
        }

        List<BiasedWordDTO> biasedWords = analysis.biasedWords() != null ? analysis.biasedWords() : Collections.emptyList();

        long inclusiveCount = biasedWords
            .stream()
            .filter(word -> "inclusive".equals(word.type()))
            .count();
        long nonInclusiveCount = biasedWords
            .stream()
            .filter(word -> "non-inclusive".equals(word.type()))
            .count();

        if (nonInclusiveCount == 0) {
            return 100;
        }

        double totalCount = (double) inclusiveCount + (double) nonInclusiveCount;
        double inclusiveWeight = inclusiveCount / totalCount;

        double factor = getCodingFactor(analysis.coding());
        double score = Math.sqrt(inclusiveWeight * factor) * 100.0;

        return (int) Math.max(0, Math.min(100, Math.round(score)));
    }

    private double getCodingFactor(String coding) {
        return switch (coding) {
            case "neutral", "inclusive-coded" -> FACTOR_NEUTRAL;
            default -> FACTOR_NON_INCLUSIVE;
        };
    }
}
