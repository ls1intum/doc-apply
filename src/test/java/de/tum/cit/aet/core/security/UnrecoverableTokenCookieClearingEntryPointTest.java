package de.tum.cit.aet.core.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.JwtValidationException;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;

class UnrecoverableTokenCookieClearingEntryPointTest {

    private final UnrecoverableTokenCookieClearingEntryPoint entryPoint = new UnrecoverableTokenCookieClearingEntryPoint();

    @Test
    void shouldClearTheSessionCookiesWhenTheTokenCannotBeDecoded() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        entryPoint.commence(
            new MockHttpServletRequest(),
            response,
            new InvalidBearerTokenException("bad signature", new BadJwtException("Signed JWT rejected: Invalid signature"))
        );

        assertThat(response.getStatus()).isEqualTo(401);
        List<String> cookies = response.getHeaders(HttpHeaders.SET_COOKIE);
        assertThat(cookies).anyMatch(cookie -> cookie.startsWith("access_token=;"));
        assertThat(cookies).anyMatch(cookie -> cookie.startsWith("refresh_token=;"));
    }

    @Test
    void shouldKeepTheSessionCookiesWhenTheTokenHasMerelyExpired() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        JwtValidationException expired = new JwtValidationException("expired", List.of(new OAuth2Error("invalid_token")));

        entryPoint.commence(new MockHttpServletRequest(), response, new InvalidBearerTokenException("expired", expired));

        assertThat(response.getStatus()).isEqualTo(401);
        // The refresh cookie can still mint a new access token, so dropping it would end a live session.
        assertThat(response.getHeaders(HttpHeaders.SET_COOKIE)).isEmpty();
    }
}
