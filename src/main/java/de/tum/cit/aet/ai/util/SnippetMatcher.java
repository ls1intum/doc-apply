package de.tum.cit.aet.ai.util;

/**
 * Validates mapped compliance snippets against the translated target text.
 */
public final class SnippetMatcher {

    private SnippetMatcher() {}

    /**
     * Checks whether a non-empty candidate occurs verbatim in the target text.
     * Matching is case-sensitive because the model copies the phrase verbatim and
     * the client searches for that exact phrase in the editor.
     *
     * @param targetText translated job description
     * @param candidate mapped compliance snippet
     * @return {@code true} when the candidate is non-empty and occurs verbatim
     */
    public static boolean isVerbatim(String targetText, String candidate) {
        return candidate != null && !candidate.isEmpty() && targetText.contains(candidate);
    }
}
