package de.tum.cit.aet.core.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.core.dto.AddressSuggestionDTO;
import de.tum.cit.aet.core.service.AddressSuggestionService;
import de.tum.cit.aet.utility.MvcTestClient;
import java.net.SocketTimeoutException;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.client.ResponseCreator;
import org.springframework.web.client.RestClient;
import tools.jackson.core.type.TypeReference;

/**
 * Integration tests for {@link AddressSuggestionResource}. Photon is replaced by a stub server bound to the service's
 * HTTP client, so the tests never call the real address search.
 */
class AddressSuggestionResourceTest extends AbstractResourceTest {

    private static final String URL = "/api/public/address-suggestions";

    private static final TypeReference<List<AddressSuggestionDTO>> SUGGESTION_LIST = new TypeReference<>() {};

    private static final String PHOTON_RESPONSE = """
        {
          "type": "FeatureCollection",
          "features": [
            { "properties": { "type": "house", "osm_value": "university", "name": "TUM School of CIT", "street": "Boltzmannstraße",
              "housenumber": "3", "postcode": "85748", "city": "Garching bei München", "country": "Deutschland", "countrycode": "DE" } },
            { "properties": { "type": "house", "osm_value": "research", "name": "Rostlab", "street": "Boltzmannstraße",
              "housenumber": "3", "postcode": "85748", "city": "Garching bei München", "country": "Deutschland", "countrycode": "DE" } },
            { "properties": { "type": "street", "osm_value": "residential", "name": "Boltzmannstraße", "postcode": "4020",
              "town": "Linz", "country": "Österreich", "countrycode": "AT" } },
            { "properties": { "type": "other", "osm_value": "postcode", "name": "85748", "city": "Garching bei München",
              "country": "Deutschland", "countrycode": "DE" } },
            { "properties": { "type": "other", "osm_value": "school", "name": "Boltzmann School", "city": "Berlin", "countrycode": "DE" } },
            { "properties": { "type": "street", "osm_value": "path", "name": "Boltzmannweg", "countrycode": "DE" } }
          ]
        }
        """;

    @Autowired
    MvcTestClient api;

    @Autowired
    AddressSuggestionService addressSuggestionService;

    private RestClient originalRestClient;
    private MockRestServiceServer photon;

    @BeforeEach
    void setup() {
        api.withoutPostProcessors();
        originalRestClient = (RestClient) ReflectionTestUtils.getField(addressSuggestionService, "restClient");
        RestClient.Builder builder = RestClient.builder().baseUrl("https://photon.test");
        photon = MockRestServiceServer.bindTo(builder).build();
        ReflectionTestUtils.setField(addressSuggestionService, "restClient", builder.build());
    }

    @AfterEach
    void restoreRestClient() {
        ReflectionTestUtils.setField(addressSuggestionService, "restClient", originalRestClient);
    }

    @Test
    void shouldReturnDistinctMappedSuggestionsWhenPhotonFindsAddresses() {
        photon
            .expect(once(), requestTo(containsString("q=Boltzmannstr%203")))
            .andExpect(method(HttpMethod.GET))
            .andExpect(queryParam("lang", "de"))
            .andExpect(queryParam("layer", "house", "street", "other"))
            .andRespond(withSuccess(PHOTON_RESPONSE, MediaType.APPLICATION_JSON));

        List<AddressSuggestionDTO> suggestions = withClientIp("198.51.100.1").getAndRead(
            URL,
            Map.of("query", "Boltzmannstr 3", "lang", "de"),
            SUGGESTION_LIST,
            200
        );

        photon.verify();
        assertThat(suggestions).containsExactly(
            new AddressSuggestionDTO(
                "Boltzmannstraße",
                "3",
                "85748",
                "Garching bei München",
                "DE",
                "Boltzmannstraße 3, 85748 Garching bei München, Deutschland"
            ),
            new AddressSuggestionDTO("Boltzmannstraße", null, "4020", "Linz", "AT", "Boltzmannstraße, 4020 Linz, Österreich"),
            new AddressSuggestionDTO(null, null, "85748", "Garching bei München", "DE", "85748 Garching bei München, Deutschland")
        );
    }

    @Test
    void shouldAnswerRepeatedQueryFromCacheWhenSameQueryIsAskedTwice() {
        photon.expect(once(), requestTo(containsString("q=Arcisstr"))).andRespond(withSuccess(PHOTON_RESPONSE, MediaType.APPLICATION_JSON));
        MvcTestClient client = withClientIp("198.51.100.2");

        client.getAndRead(URL, Map.of("query", "Arcisstr", "lang", "en"), SUGGESTION_LIST, 200);
        List<AddressSuggestionDTO> repeated = client.getAndRead(URL, Map.of("query", "arcisstr ", "lang", "en"), SUGGESTION_LIST, 200);

        photon.verify();
        assertThat(repeated).hasSize(3);
    }

    @Test
    void shouldReturnEmptyListWithoutCallingPhotonWhenQueryIsShorterThanThreeCharacters() {
        List<AddressSuggestionDTO> suggestions = withClientIp("198.51.100.3").getAndRead(URL, Map.of("query", "Bo "), SUGGESTION_LIST, 200);

        photon.verify();
        assertThat(suggestions).isEmpty();
    }

    @ParameterizedTest
    @MethodSource("failingPhotonResponses")
    void shouldReturnEmptyListWhenPhotonFails(String query, ResponseCreator failure) {
        photon.expect(once(), requestTo(containsString("q=" + query))).andRespond(failure);

        List<AddressSuggestionDTO> suggestions = withClientIp("198.51.100.4").getAndRead(URL, Map.of("query", query), SUGGESTION_LIST, 200);

        photon.verify();
        assertThat(suggestions).isEmpty();
    }

    @Test
    void shouldRejectRequestsWhenClientChangesForwardedForHeaderToEvadeRequestLimit() {
        for (int request = 0; request < 60; request++) {
            String spoofedAddress = "203.0.113." + request;
            api
                .with(httpRequest -> {
                    httpRequest.addHeader("X-Real-IP", "198.51.100.7");
                    httpRequest.addHeader("X-Forwarded-For", spoofedAddress);
                    return httpRequest;
                })
                .getAndRead(URL, Map.of("query", "ab"), SUGGESTION_LIST, 200);
        }

        withClientIp("198.51.100.7").getAndRead(URL, Map.of("query", "ab"), Void.class, 429);
    }

    @Test
    void shouldRejectRequestsWhenClientExceedsRequestLimit() {
        MvcTestClient client = withClientIp("198.51.100.5");
        for (int request = 0; request < 60; request++) {
            client.getAndRead(URL, Map.of("query", "ab"), SUGGESTION_LIST, 200);
        }

        client.getAndRead(URL, Map.of("query", "ab"), Void.class, 429);
        List<AddressSuggestionDTO> otherClient = withClientIp("198.51.100.6").getAndRead(URL, Map.of("query", "ab"), SUGGESTION_LIST, 200);

        assertThat(otherClient).isEmpty();
    }

    /**
     * Provides upstream failures, each with its own query so no cached result hides the failure.
     *
     * @return the query and the stubbed Photon failure
     */
    static Stream<Arguments> failingPhotonResponses() {
        return Stream.of(
            Arguments.of("Leopoldstr", withServerError()),
            Arguments.of("Ludwigstr", withException(new SocketTimeoutException("Read timed out")))
        );
    }

    /**
     * Sends the following requests as if they came from the given client behind the reverse proxy.
     *
     * @param ip the client IP address that the reverse proxy places in the X-Real-IP header
     * @return the test client, configured for that IP address
     */
    private MvcTestClient withClientIp(String ip) {
        return api.with(request -> {
            request.addHeader("X-Real-IP", ip);
            return request;
        });
    }
}
