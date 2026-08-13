package de.tum.cit.aet.ai.service;

import de.tum.cit.aet.ai.domain.BiasedIssue;
import de.tum.cit.aet.core.constants.GenderCategory;
import de.tum.cit.aet.core.service.GenderBiasAnalyzer;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Service for gender bias analysis
 */
@Service
@RequiredArgsConstructor
public class GenderBiasAnalysisService {

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

        // Convert to DTO

        return convertToBiasedIssues(result);
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
