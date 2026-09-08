package de.tum.cit.aet.ai.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

class SnippetMatcherTest {

    private static final String TARGET_TEXT = "Tatsächlich übersetzter Text";

    @Test
    void shouldReturnTrueWhenCandidateOccursVerbatim() {
        assertThat(SnippetMatcher.isVerbatim(TARGET_TEXT, "übersetzter Text")).isTrue();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = { "", "hallucinated phrase" })
    void shouldReturnFalseWhenCandidateIsNullEmptyOrMissing(String candidate) {
        assertThat(SnippetMatcher.isVerbatim(TARGET_TEXT, candidate)).isFalse();
    }
}
