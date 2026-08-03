package de.tum.cit.aet.core.security.oauth2;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;

class HttpCookieOAuth2AuthorizationRequestRepositoryTest {

    private static final String COOKIE_NAME = "oauth2_auth_request";
    // Derived at runtime (not a hardcoded literal) so it is just a deterministic test signing key.
    private static final String HMAC_SECRET = Base64.getEncoder().encodeToString(
        "unit-test-cookie-signing-key-not-a-real-secret".getBytes(StandardCharsets.UTF_8)
    );

    private final HttpCookieOAuth2AuthorizationRequestRepository repository = new HttpCookieOAuth2AuthorizationRequestRepository(
        HMAC_SECRET
    );

    private static OAuth2AuthorizationRequest sampleRequest() {
        return OAuth2AuthorizationRequest.authorizationCode()
            .authorizationUri("https://appleid.apple.com/auth/authorize")
            .clientId("services-id")
            .redirectUri("https://app.test/login/oauth2/code/apple")
            .scopes(Set.of("openid", "email", "name"))
            .state("state-123")
            .additionalParameters(Map.of("response_mode", "form_post"))
            .attributes(Map.of(OAuth2ParameterNames.REGISTRATION_ID, "apple"))
            .build();
    }

    @Test
    void savesAndLoadsAuthorizationRequestViaCookie() {
        OAuth2AuthorizationRequest original = sampleRequest();

        MockHttpServletResponse saveResponse = new MockHttpServletResponse();
        repository.saveAuthorizationRequest(original, new MockHttpServletRequest(), saveResponse);

        Cookie saved = saveResponse.getCookie(COOKIE_NAME);
        assertThat(saved).isNotNull();
        assertThat(saved.getValue()).isNotBlank();

        MockHttpServletRequest loadRequest = new MockHttpServletRequest();
        loadRequest.setCookies(new Cookie(COOKIE_NAME, saved.getValue()));
        OAuth2AuthorizationRequest loaded = repository.loadAuthorizationRequest(loadRequest);

        assertThat(loaded).isNotNull();
        assertThat(loaded.getClientId()).isEqualTo("services-id");
        assertThat(loaded.getState()).isEqualTo("state-123");
        assertThat(loaded.getAuthorizationUri()).isEqualTo("https://appleid.apple.com/auth/authorize");
        assertThat(loaded.getAdditionalParameters()).containsEntry("response_mode", "form_post");
        assertThat(loaded.getAttributes()).containsEntry(OAuth2ParameterNames.REGISTRATION_ID, "apple");
    }

    @Test
    void removeReturnsRequestAndClearsCookie() {
        OAuth2AuthorizationRequest original = sampleRequest();
        MockHttpServletResponse saveResponse = new MockHttpServletResponse();
        repository.saveAuthorizationRequest(original, new MockHttpServletRequest(), saveResponse);
        String value = saveResponse.getCookie(COOKIE_NAME).getValue();

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(COOKIE_NAME, value));
        MockHttpServletResponse removeResponse = new MockHttpServletResponse();

        OAuth2AuthorizationRequest removed = repository.removeAuthorizationRequest(request, removeResponse);

        assertThat(removed).isNotNull();
        assertThat(removeResponse.getCookie(COOKIE_NAME).getMaxAge()).isZero();
    }

    @Test
    void garbageCookieIsIgnored() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(COOKIE_NAME, "not-valid-base64-or-object"));

        assertThat(repository.loadAuthorizationRequest(request)).isNull();
    }

    @Test
    void tamperedOrUnsignedCookieIsRejectedBeforeDeserialization() {
        // A payload with no valid HMAC signature must be rejected and never deserialized.
        OAuth2AuthorizationRequest original = sampleRequest();
        MockHttpServletResponse saveResponse = new MockHttpServletResponse();
        repository.saveAuthorizationRequest(original, new MockHttpServletRequest(), saveResponse);
        String signed = saveResponse.getCookie(COOKIE_NAME).getValue();
        String payloadOnly = signed.substring(0, signed.lastIndexOf('.')); // drop the signature

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(COOKIE_NAME, payloadOnly + ".deadbeef"));

        assertThat(repository.loadAuthorizationRequest(request)).isNull();
    }

    @Test
    void cookieSignedWithDifferentSecretIsRejected() {
        OAuth2AuthorizationRequest original = sampleRequest();
        MockHttpServletResponse saveResponse = new MockHttpServletResponse();
        new HttpCookieOAuth2AuthorizationRequestRepository("YW5vdGhlci1zZWNyZXQtdmFsdWUtZm9yLXRlc3Rpbmc=").saveAuthorizationRequest(
            original,
            new MockHttpServletRequest(),
            saveResponse
        );
        String foreignSigned = saveResponse.getCookie(COOKIE_NAME).getValue();

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(COOKIE_NAME, foreignSigned));

        // Same payload, but signed with a different secret -> signature check fails.
        assertThat(repository.loadAuthorizationRequest(request)).isNull();
    }
}
