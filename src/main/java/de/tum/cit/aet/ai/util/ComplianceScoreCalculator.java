package de.tum.cit.aet.ai.util;

import de.tum.cit.aet.ai.constants.ComplianceCategory;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class ComplianceScoreCalculator {

    public record ComplianceScoreIssue(String id, ComplianceCategory category) {}

    /** Factor per open finding of each category; a severe finding costs more than a minor one. */
    private static final Map<ComplianceCategory, Double> PENALTY_FACTORS = Map.of(
        ComplianceCategory.CRITICAL_AGG,
        0.5,
        ComplianceCategory.DSGVO_MINIMIZATION,
        0.7,
        ComplianceCategory.TRANSPARENCY,
        0.85,
        ComplianceCategory.PUBLIC_SECTOR,
        0.85
    );

    private ComplianceScoreCalculator() {}

    /**
     * Calculates a legal compliance score with a graded penalty per open finding. Every finding multiplies the score
     * by the factor of its category, S = 100 * product of the factors, so a severe finding such as discrimination
     * under the AGG halves the score, a data-minimization finding takes away 30 %, and transparency or public-sector
     * findings take away 15 % each. Fixing any finding raises the score visibly, while a posting with many violations
     * still ends close to zero, and the multiplicative model never turns negative.
     *
     * @param categories the categories of identified compliance issues
     * @return an integer score from 0 to 100 representing legal integrity
     */
    public static int calculateLegalScore(List<ComplianceCategory> categories) {
        if (categories == null || categories.isEmpty()) {
            return 100;
        }
        double score = 100.0;
        for (ComplianceCategory category : categories) {
            score *= PENALTY_FACTORS.getOrDefault(category, 1.0);
        }
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
