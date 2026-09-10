package de.tum.cit.aet.core.security;

import de.tum.cit.aet.core.util.CookieUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.JwtValidationException;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationEntryPoint;
import org.springframework.security.web.AuthenticationEntryPoint;

/**
 * Answers a rejected bearer token, and expires the session cookies when that token can never be
 * accepted again.
 *
 * Applicant sessions travel in httpOnly cookies, which only a response can clear and which the browser
 * presents on every request. A token that fails to decode — signed with a key the server no longer has,
 * for instance — is refused before anything else runs, including on the endpoints a signed-out page
 * needs and on the one that would have cleared the cookies. Without this the browser has no way out but
 * for the person to clear their site data by hand.
 *
 * An expired token is different and is left alone: the refresh cookie still mints a new one, so dropping
 * it here would end sessions that were merely idle.
 */
public class UnrecoverableTokenCookieClearingEntryPoint implements AuthenticationEntryPoint {

    private final BearerTokenAuthenticationEntryPoint delegate = new BearerTokenAuthenticationEntryPoint();

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException)
        throws IOException {
        if (isUnrecoverable(authException)) {
            CookieUtils.setAuthCookies(response, null);
        }
        delegate.commence(request, response, authException);
    }

    /**
     * Whether presenting this token again could never succeed, which is true when it did not decode at
     * all and false when it decoded but failed validation, such as by having expired.
     *
     * @param authException the failure the resource server reported
     * @return true when the credentials are worth discarding
     */
    private boolean isUnrecoverable(AuthenticationException authException) {
        for (Throwable cause = authException; cause != null; cause = cause.getCause()) {
            if (cause instanceof JwtValidationException) {
                return false;
            }
            if (cause instanceof BadJwtException) {
                return true;
            }
        }
        return false;
    }
}
