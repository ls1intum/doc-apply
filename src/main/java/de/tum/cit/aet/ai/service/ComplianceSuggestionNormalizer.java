package de.tum.cit.aet.ai.service;

import de.tum.cit.aet.ai.constants.ComplianceAction;
import de.tum.cit.aet.ai.domain.ComplianceIssue;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Cleans the suggestions of an AI compliance analysis before they are stored, because applying a suggestion must
 * never duplicate text. Models often return a whole sentence as the replacement for a short snippet, which repeats
 * the words around the snippet, suggest adding a sentence that the description already contains, or leave out the
 * full stop of a sentence to add, which would run it into the following sentence.
 */
public final class ComplianceSuggestionNormalizer {

    private ComplianceSuggestionNormalizer() {}

    /**
     * Keeps only the issues whose suggestion still changes the description, with each replacement cut down to the
     * part that actually replaces the snippet.
     *
     * @param text   the plain text of the analyzed description
     * @param issues the issues returned by the model
     * @return the cleaned issues in their original order
     */
    public static List<ComplianceIssue> normalize(String text, List<ComplianceIssue> issues) {
        List<ComplianceIssue> cleaned = new ArrayList<>();
        for (ComplianceIssue issue : issues) {
            String snippet = issue.getText() == null ? "" : issue.getText().trim();
            if (snippet.isEmpty()) {
                continue;
            }
            if (issue.getAction() == ComplianceAction.ADD) {
                if (containsSentence(text, issue.getSuggestion())) {
                    continue;
                }
                issue.setSuggestion(withFinalPunctuation(issue.getSuggestion()));
            }
            if (issue.getAction() == ComplianceAction.REPLACE) {
                String replacement = trimSurroundingWords(text, snippet, issue.getSuggestion());
                if (replacement.equalsIgnoreCase(snippet)) {
                    continue;
                }
                issue.setSuggestion(replacement);
            }
            cleaned.add(issue);
        }
        return cleaned;
    }

    /**
     * Removes the words at the start of a replacement that already stand right before the snippet, and the words at
     * its end that already follow it, so replacing the snippet does not repeat them. When words at the end are removed,
     * a punctuation mark left before them is dropped too, because the text after the snippet brings its own.
     *
     * @param text       the plain text of the description
     * @param snippet    the flagged snippet
     * @param suggestion the replacement the model proposed
     * @return the replacement without the repeated words
     */
    static String trimSurroundingWords(String text, String snippet, String suggestion) {
        String replacement = suggestion == null ? "" : suggestion.trim();
        int index = text.toLowerCase(Locale.ROOT).indexOf(snippet.toLowerCase(Locale.ROOT));
        if (index < 0 || replacement.isEmpty()) {
            return replacement;
        }
        List<String> before = words(text.substring(0, index))
            .stream()
            .filter(word -> !bare(word).isEmpty())
            .toList();
        List<String> after = words(text.substring(index + snippet.length()))
            .stream()
            .filter(word -> !bare(word).isEmpty())
            .toList();
        List<String> proposed = words(replacement);

        int prefix = overlap(before.subList(Math.max(0, before.size() - proposed.size()), before.size()), proposed, true);
        List<String> rest = proposed.subList(prefix, proposed.size());
        int suffix = overlap(after.subList(0, Math.min(after.size(), rest.size())), rest, false);
        String trimmed = String.join(" ", rest.subList(0, rest.size() - suffix));
        return suffix > 0 ? trimmed.replaceAll("\\p{Punct}+$", "") : trimmed;
    }

    /**
     * Finds how many words two lists share at their touching ends: the end of the context and the start of the
     * replacement when the context precedes it, or the start of the context and the end of the replacement when it
     * follows it.
     *
     * @param context     the words around the snippet
     * @param replacement the words of the replacement
     * @param preceding   whether the context stands before the snippet
     * @return the number of shared words
     */
    private static int overlap(List<String> context, List<String> replacement, boolean preceding) {
        for (int length = Math.min(context.size(), replacement.size()); length > 0; length--) {
            List<String> contextPart = preceding ? context.subList(context.size() - length, context.size()) : context.subList(0, length);
            List<String> replacementPart = preceding
                ? replacement.subList(0, length)
                : replacement.subList(replacement.size() - length, replacement.size());
            if (sameWords(contextPart, replacementPart)) {
                return length;
            }
        }
        return 0;
    }

    /**
     * Compares two word lists while ignoring case and punctuation around the words.
     *
     * @param first  the first words
     * @param second the second words
     * @return whether they are the same words
     */
    private static boolean sameWords(List<String> first, List<String> second) {
        for (int i = 0; i < first.size(); i++) {
            if (!bare(first.get(i)).equals(bare(second.get(i)))) {
                return false;
            }
        }
        return true;
    }

    /**
     * Tells whether the description already contains a sentence, ignoring case, spacing and the final punctuation.
     *
     * @param text     the plain text of the description
     * @param sentence the sentence the model proposed to add
     * @return whether the sentence is already there
     */
    private static boolean containsSentence(String text, String sentence) {
        String wanted = String.join(
            " ",
            words(sentence == null ? "" : sentence).stream().map(ComplianceSuggestionNormalizer::bare).toList()
        );
        if (wanted.isBlank()) {
            return false;
        }
        String present = String.join(" ", words(text).stream().map(ComplianceSuggestionNormalizer::bare).toList());
        return present.contains(wanted);
    }

    /**
     * Ends a sentence to add with a full stop unless it already ends with a sentence mark.
     *
     * @param sentence the sentence the model proposed to add
     * @return the sentence with its final punctuation
     */
    private static String withFinalPunctuation(String sentence) {
        String trimmed = sentence == null ? "" : sentence.trim();
        return trimmed.isEmpty() || trimmed.matches(".*[.!?]$") ? trimmed : trimmed + ".";
    }

    /**
     * Splits text into words at whitespace.
     *
     * @param text the text to split
     * @return the words, without empty entries
     */
    private static List<String> words(String text) {
        return Arrays.stream(text.trim().split("\\s+"))
            .filter(word -> !word.isEmpty())
            .toList();
    }

    /**
     * Lowercases a word and strips punctuation from its ends, for comparisons.
     *
     * @param word the word
     * @return the bare word
     */
    private static String bare(String word) {
        return word.toLowerCase(Locale.ROOT).replaceAll("^\\p{Punct}+|\\p{Punct}+$", "");
    }
}
