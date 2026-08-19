package de.tum.cit.aet.core.service;

import de.tum.cit.aet.core.constants.GenderCategory;
import de.tum.cit.aet.core.domain.BiasedIssue;
import de.tum.cit.aet.core.dto.AnalyzeJobDescriptionRequestDTO;
import de.tum.cit.aet.core.util.GenderBiasScoreCalculator;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.jsoup.Jsoup;
import org.springframework.stereotype.Service;

/**
 * Service for gender bias analysis
 */
@Service
@RequiredArgsConstructor
public class GenderBiasAnalysisService {

    public record JobGenderBiasAnalysis(Integer score, Set<BiasedIssue> issues) {}

    private final GenderBiasAnalyzer analyzer;

    /**
     * Analyze the given text while retaining repeated occurrences for score calculation.
     *
     * @param text the text to analyze
     * @param language the language code (e.g., "en" or "de")
     * @return all detected biased word occurrences
     */
    public List<BiasedIssue> analyzeOccurrences(String text, String language) {
        // Default to English if no language specified
        String effectiveLanguage = (language == null || language.trim().isEmpty()) ? "en" : language;

        // Perform analysis
        GenderBiasAnalyzer.AnalysisResult result = analyzer.analyze(text, effectiveLanguage);

        return convertToBiasedIssues(result);
    }

    /**
     * Analyzes both localized job descriptions and returns the score and findings
     * for the selected language without using AI.
     *
     * @param jobForm the current localized job descriptions
     * @param language the language being analyzed
     * @return the gender score and findings for the selected language
     */
    public JobGenderBiasAnalysis analyzeJobDescription(AnalyzeJobDescriptionRequestDTO jobForm, String language) {
        String currentText = plainText(jobForm, language);
        String otherLanguage = "de".equals(language) ? "en" : "de";
        String otherText = plainText(jobForm, otherLanguage);

        List<BiasedIssue> currentOccurrences = currentText.isBlank() ? null : analyzeOccurrences(currentText, language);
        List<BiasedIssue> otherOccurrences = otherText.isBlank() ? null : analyzeOccurrences(otherText, otherLanguage);
        if (currentOccurrences == null) {
            Integer score =
                otherOccurrences == null
                    ? null
                    : GenderBiasScoreCalculator.calculateGenderScore(null, types(otherOccurrences), currentText, otherText);
            return new JobGenderBiasAnalysis(score, Set.of());
        }

        int score = GenderBiasScoreCalculator.calculateGenderScore(
            types(currentOccurrences),
            types(otherOccurrences),
            currentText,
            otherText
        );
        return new JobGenderBiasAnalysis(score, new HashSet<>(currentOccurrences));
    }

    private static List<GenderCategory> types(Collection<BiasedIssue> issues) {
        return issues == null ? null : issues.stream().map(BiasedIssue::getType).toList();
    }

    private static String plainText(AnalyzeJobDescriptionRequestDTO jobForm, String language) {
        String html = "de".equals(language) ? jobForm.jobDescriptionDE() : jobForm.jobDescriptionEN();
        return html == null ? "" : Jsoup.parse(html).text();
    }

    /**
     * Convert analysis result to DTOs with suggestions
     */
    private List<BiasedIssue> convertToBiasedIssues(GenderBiasAnalyzer.AnalysisResult result) {
        List<BiasedIssue> issues = new ArrayList<>();

        // Add non inclusive words
        for (String word : result.nonInclusiveWords()) {
            issues.add(new BiasedIssue(result.language(), word, GenderCategory.NON_INCLUSIVE));
        }

        // Add inclusive words
        for (String word : result.inclusiveWords()) {
            issues.add(new BiasedIssue(result.language(), word, GenderCategory.INCLUSIVE));
        }

        return issues;
    }
}
