package de.tum.cit.aet.core.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import de.tum.cit.aet.core.constants.Language;
import de.tum.cit.aet.core.dto.AddressSuggestionDTO;
import de.tum.cit.aet.core.exception.TooManyRequestsException;
import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Looks up address suggestions for a partly typed address in Photon, an address search on OpenStreetMap data.
 * The browser never calls Photon itself, so visitors' addresses only leave our server, and Photon sees one client
 * that this service keeps within its fair-use policy through a response cache and a per-client request limit.
 */
@Slf4j
@Service
public class AddressSuggestionService {

    /** Shorter queries match too many places to be useful and would only load the upstream service. */
    private static final int MIN_QUERY_LENGTH = 3;

    private static final int MAX_QUERY_LENGTH = 200;

    private static final int MAX_SUGGESTIONS = 5;

    /** Photon returns one feature per point of interest, so several features often share one address. */
    private static final int UPSTREAM_LIMIT = 15;

    private static final int MAX_REQUESTS_PER_CLIENT_PER_MINUTE = 60;

    private static final int MAX_REQUESTS_PER_MINUTE = 1_000;

    private static final String ALL_CLIENTS_KEY = "*";

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(2);

    private static final Duration READ_TIMEOUT = Duration.ofSeconds(3);

    private static final String POSTCODE_OSM_VALUE = "postcode";

    private static final String HOUSE_TYPE = "house";

    private static final String STREET_TYPE = "street";

    /** Photon files postal code areas under this type, next to places that are neither buildings nor streets. */
    private static final String OTHER_TYPE = "other";

    private static final int MAX_CACHED_QUERIES = 5_000;

    /** Addresses rarely change, so a lookup is reused for a few hours before Photon is asked again. */
    private static final Duration CACHE_DURATION = Duration.ofHours(6);

    /** Bounds the memory of the request limit even when many clients, or many forged addresses, send requests. */
    private static final int MAX_TRACKED_CLIENTS = 50_000;

    private static final Duration REQUEST_LIMIT_WINDOW = Duration.ofMinutes(1);

    private final boolean enabled;
    private final String clientUrl;
    private final SiteSettingService siteSettingService;
    private final Cache<String, List<AddressSuggestionDTO>> suggestionCache = Caffeine.newBuilder()
        .maximumSize(MAX_CACHED_QUERIES)
        .expireAfterWrite(CACHE_DURATION)
        .build();
    private final Cache<String, AtomicInteger> requestCounts = Caffeine.newBuilder()
        .maximumSize(MAX_TRACKED_CLIENTS)
        .expireAfterWrite(REQUEST_LIMIT_WINDOW)
        .build();
    private final RestClient restClient;

    /**
     * Creates the service with a client for the configured Photon instance.
     *
     * @param enabled            whether suggestions are looked up at all
     * @param url                the base URL of the Photon instance
     * @param clientUrl          the public URL of this platform, sent to Photon as contact information
     * @param siteSettingService provides the configured platform name for the User-Agent header
     */
    public AddressSuggestionService(
        @Value("${aet.address-suggestions.enabled:false}") boolean enabled,
        @Value("${aet.address-suggestions.url:https://photon.komoot.io}") String url,
        @Value("${aet.client.url:}") String clientUrl,
        SiteSettingService siteSettingService
    ) {
        this.enabled = enabled;
        this.clientUrl = clientUrl;
        this.siteSettingService = siteSettingService;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(CONNECT_TIMEOUT);
        requestFactory.setReadTimeout(READ_TIMEOUT);
        this.restClient = RestClient.builder().baseUrl(url).requestFactory(requestFactory).build();
    }

    /**
     * Returns up to five addresses matching a partly typed address. Suggestions are optional help for the user, so
     * every upstream problem leads to an empty list instead of an error.
     *
     * @param query    the text the user typed so far, such as a street, a street with house number or a postal code
     * @param language the language for place and country names, "de" or "en"; anything else falls back to English
     * @param clientIp the IP address of the requesting client, used for the request limit
     * @return the matching addresses, best match first, or an empty list when nothing matches or the lookup failed
     * @throws TooManyRequestsException if the client or all clients together sent too many requests within a minute
     */
    public List<AddressSuggestionDTO> findSuggestions(String query, String language, String clientIp) {
        // 1) Enforce the request limit before anything else, so rejected requests cost nothing
        assertWithinRequestLimit(clientIp);

        // 2) Skip lookups that cannot produce useful results
        String trimmedQuery = query == null ? "" : query.trim();
        if (!enabled || trimmedQuery.length() < MIN_QUERY_LENGTH || trimmedQuery.length() > MAX_QUERY_LENGTH) {
            return List.of();
        }

        // 3) Answer repeated queries from the cache; failed lookups are not cached, so they are retried
        String photonLanguage = Language.GERMAN.getCode().equals(language) ? Language.GERMAN.getCode() : Language.ENGLISH.getCode();
        String cacheKey = photonLanguage + '|' + trimmedQuery.toLowerCase(Locale.ROOT);
        List<AddressSuggestionDTO> cached = suggestionCache.getIfPresent(cacheKey);
        if (cached != null) {
            return cached;
        }
        PhotonResponse response = queryPhoton(trimmedQuery, photonLanguage);
        if (response == null) {
            return List.of();
        }
        List<AddressSuggestionDTO> suggestions = toSuggestions(response);
        suggestionCache.put(cacheKey, suggestions);
        return suggestions;
    }

    /**
     * Counts the request for the client and for all clients together and rejects it once a limit is reached.
     *
     * @param clientIp the IP address of the requesting client
     * @throws TooManyRequestsException if either limit is exceeded within the current minute
     */
    private void assertWithinRequestLimit(String clientIp) {
        int clientCount = requestCounts.get(Objects.requireNonNullElse(clientIp, ""), key -> new AtomicInteger()).incrementAndGet();
        int totalCount = requestCounts.get(ALL_CLIENTS_KEY, key -> new AtomicInteger()).incrementAndGet();
        if (clientCount > MAX_REQUESTS_PER_CLIENT_PER_MINUTE || totalCount > MAX_REQUESTS_PER_MINUTE) {
            throw new TooManyRequestsException("Too many address suggestion requests, please try again in a minute");
        }
    }

    /**
     * Sends the query to Photon, limited to buildings, streets and postal code areas.
     *
     * @param query    the trimmed query
     * @param language the language for place and country names
     * @return the Photon response, or null when the request failed or timed out
     */
    private PhotonResponse queryPhoton(String query, String language) {
        try {
            return restClient
                .get()
                .uri(builder ->
                    builder
                        .path("/api/")
                        .queryParam("q", "{query}")
                        .queryParam("limit", UPSTREAM_LIMIT)
                        .queryParam("lang", language)
                        .queryParam("layer", HOUSE_TYPE, STREET_TYPE, OTHER_TYPE)
                        .build(Map.of("query", query))
                )
                .header(HttpHeaders.USER_AGENT, userAgent())
                .retrieve()
                .body(PhotonResponse.class);
        } catch (RestClientException e) {
            log.warn("Address suggestion lookup failed: {}", e.getClass().getSimpleName());
            return null;
        }
    }

    /**
     * Builds the User-Agent header that Photon's usage policy asks for, naming this platform and where to reach it.
     *
     * @return the header value, restricted to printable ASCII characters
     */
    private String userAgent() {
        String agent = siteSettingService.getSiteName() + " address suggestions" + (clientUrl.isBlank() ? "" : " (" + clientUrl + ")");
        return agent.replaceAll("[^\\x20-\\x7E]", "");
    }

    /**
     * Maps Photon features to suggestions, dropping features without a city or postal code and features that repeat
     * an address already in the list.
     *
     * @param response the Photon response
     * @return at most five distinct suggestions in Photon's order
     */
    private List<AddressSuggestionDTO> toSuggestions(PhotonResponse response) {
        Set<AddressSuggestionDTO> distinct = new LinkedHashSet<>();
        for (PhotonFeature feature : Objects.requireNonNullElse(response.features(), List.<PhotonFeature>of())) {
            AddressSuggestionDTO suggestion = feature.properties() == null ? null : toSuggestion(feature.properties());
            if (suggestion != null) {
                distinct.add(suggestion);
            }
            if (distinct.size() == MAX_SUGGESTIONS) {
                break;
            }
        }
        return List.copyOf(distinct);
    }

    /**
     * Maps one Photon feature to a suggestion. A street feature carries the street in its name, and a postal code
     * area carries the postal code in its name; buildings carry both in their own fields.
     *
     * @param properties the properties of the feature
     * @return the suggestion, or null when the feature is neither a building, a street nor a postal code area, or has
     *         neither a city nor a postal code
     */
    private AddressSuggestionDTO toSuggestion(PhotonProperties properties) {
        boolean isPostcodeArea = POSTCODE_OSM_VALUE.equals(properties.osmValue());
        if (OTHER_TYPE.equals(properties.type()) && !isPostcodeArea) {
            return null;
        }
        String postalCode = isPostcodeArea ? properties.name() : properties.postcode();
        String city = firstPresent(properties.city(), properties.town(), properties.village());
        if (isBlank(city) && isBlank(postalCode)) {
            return null;
        }
        String street = STREET_TYPE.equals(properties.type()) ? properties.name() : properties.street();
        String houseNumber = HOUSE_TYPE.equals(properties.type()) ? properties.housenumber() : null;
        String streetLine = isPostcodeArea ? null : joinPresent(" ", street, houseNumber);
        String label = joinPresent(", ", streetLine, joinPresent(" ", postalCode, city), properties.country());
        return new AddressSuggestionDTO(street, houseNumber, postalCode, city, toCountryCode(properties.countrycode()), label);
    }

    /**
     * Turns Photon's country code into the uppercase form the client matches against its country list.
     *
     * @param countryCode the country code as Photon returns it, in any case
     * @return the uppercase country code, or null when Photon returns none
     */
    private static String toCountryCode(String countryCode) {
        return isBlank(countryCode) ? null : countryCode.toUpperCase(Locale.ROOT);
    }

    /**
     * Returns the first value that is not blank.
     *
     * @param values the candidate values, in order of preference
     * @return the first non-blank value, or null if all are blank
     */
    private static String firstPresent(String... values) {
        return Stream.of(values)
            .filter(value -> !isBlank(value))
            .findFirst()
            .orElse(null);
    }

    /**
     * Joins the values that are not blank.
     *
     * @param separator the text between two values
     * @param values    the values to join
     * @return the joined values, or null if all are blank
     */
    private static String joinPresent(String separator, String... values) {
        String joined = Stream.of(values)
            .filter(value -> !isBlank(value))
            .collect(Collectors.joining(separator));
        return joined.isEmpty() ? null : joined;
    }

    /**
     * Checks whether a value is missing or only whitespace.
     *
     * @param value the value to check
     * @return whether the value is null or blank
     */
    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    /**
     * The GeoJSON feature collection Photon answers with.
     *
     * @param features the matching features, best match first
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record PhotonResponse(List<PhotonFeature> features) {}

    /**
     * One matching place.
     *
     * @param properties the address details of the place
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record PhotonFeature(PhotonProperties properties) {}

    /**
     * The address details Photon reports for a place.
     *
     * @param type        the kind of place, such as house, street or other
     * @param osmValue    the OpenStreetMap tag value, which is postcode for postal code areas
     * @param name        the name of the place
     * @param street      the street of a building
     * @param housenumber the house number of a building
     * @param postcode    the postal code
     * @param city        the city
     * @param town        the town, for places outside cities
     * @param village     the village, for places outside cities and towns
     * @param country     the country name in the requested language
     * @param countrycode the ISO 3166-1 alpha-2 country code
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record PhotonProperties(
        String type,
        @JsonProperty("osm_value") String osmValue,
        String name,
        String street,
        String housenumber,
        String postcode,
        String city,
        String town,
        String village,
        String country,
        String countrycode
    ) {}
}
