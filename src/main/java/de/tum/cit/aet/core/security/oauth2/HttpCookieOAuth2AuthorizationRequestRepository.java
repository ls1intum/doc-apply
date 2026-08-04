package de.tum.cit.aet.core.security.oauth2;

import de.tum.cit.aet.core.security.otp.OtpUtil;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.ObjectInputStream;
import java.io.ObjectStreamClass;
import java.time.Duration;
import java.util.Base64;
import java.util.Optional;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.util.SerializationUtils;
import org.springframework.web.util.WebUtils;

/**
 * Stores the pending {@link OAuth2AuthorizationRequest} in a short-lived, HMAC-signed cookie instead of the
 * HTTP session.
 * <p>
 * Required for Apple Sign In: Apple returns the authorization code via a cross-site {@code form_post} (a POST
 * from {@code appleid.apple.com}), on which a {@code SameSite=Strict/Lax} session cookie would not be sent —
 * so the default session-backed repository cannot find the saved request. This cookie is written with
 * {@code SameSite=None; Secure; HttpOnly}.
 * <p>
 * Security: the cookie value is read before authentication, so it is treated as untrusted. It is signed with
 * HMAC-SHA256 using a server-side secret and the signature is verified (constant-time) <em>before</em> the
 * payload is deserialized; a forged or tampered cookie is rejected and never reaches {@link ObjectInputStream}.
 * As defence-in-depth, deserialization is additionally restricted to a small class allowlist.
 */
@Slf4j
public class HttpCookieOAuth2AuthorizationRequestRepository implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {

    private static final String COOKIE_NAME = "oauth2_auth_request";
    private static final Duration COOKIE_TTL = Duration.ofMinutes(5);
    private static final String SEPARATOR = ".";

    /** Concrete class prefixes the serialized authorization request is composed of (allowlist for deserialization). */
    private static final Set<String> ALLOWED_PACKAGES = Set.of("java.util.", "java.lang.", "org.springframework.security.oauth2.");

    private final String hmacSecret;

    public HttpCookieOAuth2AuthorizationRequestRepository(String hmacSecret) {
        this.hmacSecret = hmacSecret;
    }

    @Override
    public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
        return readCookie(request).map(this::verifyAndDeserialize).orElse(null);
    }

    @Override
    public void saveAuthorizationRequest(
        OAuth2AuthorizationRequest authorizationRequest,
        HttpServletRequest request,
        HttpServletResponse response
    ) {
        if (authorizationRequest == null) {
            writeCookie(response, "", 0);
            return;
        }
        String payload = Base64.getUrlEncoder().withoutPadding().encodeToString(SerializationUtils.serialize(authorizationRequest));
        String signed = payload + SEPARATOR + OtpUtil.hmacSha256Base64(hmacSecret, payload);
        writeCookie(response, signed, (int) COOKIE_TTL.toSeconds());
    }

    @Override
    public OAuth2AuthorizationRequest removeAuthorizationRequest(HttpServletRequest request, HttpServletResponse response) {
        OAuth2AuthorizationRequest authorizationRequest = loadAuthorizationRequest(request);
        if (authorizationRequest != null) {
            writeCookie(response, "", 0);
        }
        return authorizationRequest;
    }

    private Optional<String> readCookie(HttpServletRequest request) {
        Cookie cookie = WebUtils.getCookie(request, COOKIE_NAME);
        return cookie == null || cookie.getValue() == null || cookie.getValue().isBlank()
            ? Optional.empty()
            : Optional.of(cookie.getValue());
    }

    private void writeCookie(HttpServletResponse response, String value, int maxAgeSeconds) {
        ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, value)
            .httpOnly(true)
            .secure(true)
            .sameSite("None")
            .path("/")
            .maxAge(maxAgeSeconds)
            .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private OAuth2AuthorizationRequest verifyAndDeserialize(String value) {
        int separatorIndex = value.lastIndexOf(SEPARATOR);
        if (separatorIndex <= 0 || separatorIndex == value.length() - 1) {
            return null;
        }
        String payload = value.substring(0, separatorIndex);
        String signature = value.substring(separatorIndex + 1);
        // Verify the HMAC before doing anything with the payload; reject forged/tampered cookies.
        if (!OtpUtil.constantTimeEquals(OtpUtil.hmacSha256Base64(hmacSecret, payload), signature)) {
            log.debug("Rejecting OAuth2 authorization-request cookie with invalid signature");
            return null;
        }
        try {
            byte[] bytes = Base64.getUrlDecoder().decode(payload);
            try (ObjectInputStream in = new AllowlistObjectInputStream(new ByteArrayInputStream(bytes))) {
                return (OAuth2AuthorizationRequest) in.readObject();
            }
        } catch (IOException | ClassNotFoundException | IllegalArgumentException | ClassCastException e) {
            log.debug("Discarding unreadable OAuth2 authorization-request cookie: {}", e.getMessage());
            return null;
        }
    }

    /** {@link ObjectInputStream} that only resolves classes from a small allowlist of packages. */
    private static final class AllowlistObjectInputStream extends ObjectInputStream {

        AllowlistObjectInputStream(InputStream in) throws IOException {
            super(in);
        }

        @Override
        protected Class<?> resolveClass(ObjectStreamClass desc) throws IOException, ClassNotFoundException {
            String name = desc.getName();
            String type = name.startsWith("[") ? name.replaceAll("^\\[+L?", "") : name;
            boolean allowed = ALLOWED_PACKAGES.stream().anyMatch(type::startsWith);
            if (!allowed) {
                throw new java.io.InvalidClassException(name, "Class not allowed for deserialization");
            }
            return super.resolveClass(desc);
        }
    }
}
