package de.tum.cit.aet.ai.util;

import de.tum.cit.aet.ai.constants.ComplianceCategory;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

public final class ComplianceScoreCalculator {

    public record ComplianceScoreIssue(String id, ComplianceCategory category) {}

    private static final double PENALTY_FACTOR = 0.85;

    private ComplianceScoreCalculator() {}

    /**
     * Calculates a legal compliance score based on a hierarchical risk model.
     * * The calculation follows the Gatekeeper-Principle for severe risks and Exponential Decay
     * for minor issues. If a CRITICAL or DSGVO violation is detected, the score is immediately 0
     * (Veto-Principle), as these represent non-negotiable legal liabilities.
     * * For transparency and public sector issues, the score is reduced multiplicatively using the formula
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

        if (
            counts.getOrDefault(ComplianceCategory.CRITICAL_AGG, 0L) > 0 ||
            counts.getOrDefault(ComplianceCategory.DSGVO_MINIMIZATION, 0L) > 0
        ) {
            return 0;
        }

        double totalCount = (double) (counts.getOrDefault(ComplianceCategory.TRANSPARENCY, 0L) +
            counts.getOrDefault(ComplianceCategory.PUBLIC_SECTOR, 0L));

        double score = 100.0 * Math.pow(PENALTY_FACTOR, totalCount);
        return (int) Math.max(0, Math.round(score));
    }

    /**
     * Combines the gender inclusivity score with the legal compliance score using
     * their geometric mean. Findings mapped to multiple languages are counted once
     * based on their non-empty identifier.
     *
     * @param genderScore the gender inclusivity score from 0 to 100
     * @param complianceIssues the compliance issue identifiers and categories
     * @return the combined AI score from 0 to 100
     */
    public static int calculateCombinedAiScore(int genderScore, List<ComplianceScoreIssue> complianceIssues) {
        Set<String> issueIds = new HashSet<>();
        int legalScore = calculateLegalScore(
            complianceIssues
                .stream()
                .filter(issue -> issue.id() == null || issue.id().isBlank() || issueIds.add(issue.id()))
                .map(ComplianceScoreIssue::category)
                .toList()
        );
        return (int) Math.round(Math.sqrt((double) genderScore * legalScore));
    }
}
