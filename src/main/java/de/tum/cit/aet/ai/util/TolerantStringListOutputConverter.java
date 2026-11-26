package de.tum.cit.aet.ai.util;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.ai.converter.StructuredOutputConverter;
import org.springframework.core.ParameterizedTypeReference;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Reads a JSON string array from a model response and tolerates the shapes small models often return instead, such as
 * several arrays joined by a separator or an array of pairs. The prompt asks for one flat array, so when the response is
 * not one, the strings are taken in the order they appear. Callers still check that the number of strings fits.
 */
public class TolerantStringListOutputConverter implements StructuredOutputConverter<List<String>> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** A JSON string literal, including escaped quotes and backslashes inside it. */
    private static final Pattern JSON_STRING = Pattern.compile("\"(?:[^\"\\\\]|\\\\.)*\"");

    private final BeanOutputConverter<List<String>> formatProvider = new BeanOutputConverter<>(
        new ParameterizedTypeReference<List<String>>() {}
    );

    /**
     * Returns the same format instruction as the standard converter, so the prompt does not change.
     *
     * @return the instruction that asks the model for a JSON string array
     */
    @Override
    public String getFormat() {
        return formatProvider.getFormat();
    }

    /**
     * Parses the response as a JSON string array, or collects its string literals in order when it is not one.
     *
     * @param response the raw model response
     * @return the strings of the response, empty when it contains none
     */
    @Override
    public List<String> convert(String response) {
        if (response == null || response.isBlank()) {
            return List.of();
        }
        String json = response.strip().replaceAll("^```(?:json)?\\s*|\\s*```$", "");
        try {
            return MAPPER.readValue(json, new TypeReference<List<String>>() {});
        } catch (JacksonException e) {
            return collectStringLiterals(json);
        }
    }

    /**
     * Collects every JSON string literal of a text in the order it appears, decoding escapes such as \" and \n.
     *
     * @param text the text to scan
     * @return the decoded strings
     */
    private List<String> collectStringLiterals(String text) {
        List<String> strings = new ArrayList<>();
        Matcher matcher = JSON_STRING.matcher(text);
        while (matcher.find()) {
            try {
                strings.add(MAPPER.readValue(matcher.group(), String.class));
            } catch (JacksonException e) {
                strings.add(matcher.group().substring(1, matcher.group().length() - 1));
            }
        }
        return strings;
    }
}
