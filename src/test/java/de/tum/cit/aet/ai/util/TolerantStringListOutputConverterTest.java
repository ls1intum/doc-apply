package de.tum.cit.aet.ai.util;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class TolerantStringListOutputConverterTest {

    private final TolerantStringListOutputConverter converter = new TolerantStringListOutputConverter();

    @ParameterizedTest(name = "{0}")
    @MethodSource("responses")
    void shouldReadTheStringsInOrderWhenTheModelReturnsThisShape(String label, String response, List<String> expected) {
        assertThat(converter.convert(response)).containsExactlyElementsOf(expected);
    }

    static Stream<Arguments> responses() {
        return Stream.of(
            Arguments.of("flat array", "[\"junges Team\", \"erfahrenes Team\"]", List.of("junges Team", "erfahrenes Team")),
            Arguments.of(
                "arrays joined by a separator",
                "[\"Keine Verpflichtungen\", \"Ohne Vorgaben\"]_[\"ein Foto\", \"\"]",
                List.of("Keine Verpflichtungen", "Ohne Vorgaben", "ein Foto", "")
            ),
            Arguments.of("array of pairs", "[[\"a\", \"b\"], [\"c\", \"d\"]]", List.of("a", "b", "c", "d")),
            Arguments.of("markdown fence", "```json\n[\"a\", \"b\"]\n```", List.of("a", "b")),
            Arguments.of("escaped quotes", "[\"the \\\"ideal\\\" candidate\", \"b\"]_", List.of("the \"ideal\" candidate", "b")),
            Arguments.of("blank response", "  ", List.of())
        );
    }
}
