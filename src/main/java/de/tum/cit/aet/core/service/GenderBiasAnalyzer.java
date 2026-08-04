package de.tum.cit.aet.core.service;

import de.tum.cit.aet.core.constants.GenderBiasWordLists;
import de.tum.cit.aet.core.constants.GenderCategory;
import de.tum.cit.aet.core.util.StringUtil;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Analyzes text for gender-coded language (non-inclusive vs inclusive
 * stereotypes)
 */
@Component
public class GenderBiasAnalyzer {

    /**
     * Analyze text for gender bias in the specified language.
     *
     * @param text     the text to analyze
     * @param language the language code (e.g., "en" or "de")
     * @return an {@link AnalysisResult} containing counts of non-inclusive and
     *         inclusive words
     */
    public AnalysisResult analyze(String text, String language) {
        if (text == null || text.trim().isEmpty()) {
            return new AnalysisResult(Collections.emptyList(), Collections.emptyList(), 0, 0, language);
        }

        // Get word lists for language (fallback to English)
        Set<String> nonInclusive = GenderBiasWordLists.getWords(language, GenderCategory.NON_INCLUSIVE);
        Set<String> inclusive = GenderBiasWordLists.getWords(language, GenderCategory.INCLUSIVE);

        // Clean and tokenize
        List<String> wordList = cleanAndTokenize(text);

        // Explicitly handle hyphenated words
        List<String> dehyphenWordList = deHyphenNonCodedWords(language, wordList);

        // Find coded words
        List<String> nonInclusiveWords = findCodedWords(dehyphenWordList, nonInclusive);
        List<String> inclusiveWords = findCodedWords(dehyphenWordList, inclusive);

        int nonInclusiveCount = nonInclusiveWords.size();
        int inclusiveCount = inclusiveWords.size();

        return new AnalysisResult(nonInclusiveWords, inclusiveWords, nonInclusiveCount, inclusiveCount, language);
    }

    /**
     * Clean text and split into words
     */
    private List<String> cleanAndTokenize(String text) {
        String cleanedText = StringUtil.keepAsciiAndUmlauts(text);
        cleanedText = StringUtil.normalizeWhitespace(cleanedText);
        cleanedText = StringUtil.removePunctuation(cleanedText);

        List<String> words = Arrays.stream(cleanedText.split(" "))
            .map(String::toLowerCase)
            .filter(word -> !word.isEmpty())
            .collect(Collectors.toList());

        return words;
    }

    /**
     * Split hyphenated words unless they're in the coded words list
     */
    private List<String> deHyphenNonCodedWords(String lang, List<String> wordList) {
        List<String> result = new ArrayList<>();

        Set<String> allCodedWords = new HashSet<>();
        allCodedWords.addAll(GenderBiasWordLists.getWords(lang, GenderCategory.INCLUSIVE));
        allCodedWords.addAll(GenderBiasWordLists.getWords(lang, GenderCategory.NON_INCLUSIVE));

        for (String word : wordList) {
            if (word.contains("-") && allCodedWords.stream().noneMatch(word::contains)) {
                result.addAll(Arrays.asList(word.split("-")));
            } else {
                result.add(word);
            }
        }

        return result;
    }

    /**
     * Find words that start with any of the coded word stems
     */
    private List<String> findCodedWords(List<String> wordList, Set<String> codedWords) {
        return wordList
            .stream()
            .filter(word -> codedWords.stream().anyMatch(word::startsWith))
            .collect(Collectors.toList());
    }

    /**
     * Analysis result container
     */
    public record AnalysisResult(
        List<String> nonInclusiveWords,
        List<String> inclusiveWords,
        int nonInclusiveCount,
        int inclusiveCount,
        String language
    ) {}
}
