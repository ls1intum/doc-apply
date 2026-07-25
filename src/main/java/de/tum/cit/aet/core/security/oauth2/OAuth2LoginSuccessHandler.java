package de.tum.cit.aet.core.security.oauth2;

import de.tum.cit.aet.core.service.AppTokenService;
import de.tum.cit.aet.core.util.CookieUtils;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.dto.auth.AuthResponseDTO;
import de.tum.cit.aet.usermanagement.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;

/**
 * Completes a Google/Apple sign-in handled directly by TUMApply (no Keycloak brokering): extracts the
 * verified email + name from the provider, provisions a local user, mints app-issued tokens via
 * {@link AppTokenService}, sets the auth cookies, and redirects back to the SPA.
 */
@Slf4j
public class OAuth2LoginSuccessHandler implements AuthenticationSuccessHandler {

    private static final String APPLE = "apple";

    private final UserService userService;
    private final AppTokenService appTokenService;
    private final String clientUrl;

    public OAuth2LoginSuccessHandler(UserService userService, AppTokenService appTokenService, String clientUrl) {
        this.userService = userService;
        this.appTokenService = appTokenService;
        this.clientUrl = stripTrailingSlash(clientUrl);
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication)
        throws IOException {
        if (!(authentication instanceof OAuth2AuthenticationToken token)) {
            response.sendRedirect(clientUrl + "/?login_error=provider");
            return;
        }
        String registrationId = token.getAuthorizedClientRegistrationId();
        OAuth2User principal = token.getPrincipal();

        String email = principal.getAttribute("email");
        if (email == null || email.isBlank() || !isEmailVerified(registrationId, principal)) {
            log.warn("Rejecting {} login: missing or unverified email", registrationId);
            response.sendRedirect(clientUrl + "/?login_error=email");
            return;
        }

        User user = userService.provisionExternalUser(
            email,
            firstName(registrationId, principal, request),
            lastName(registrationId, principal, request)
        );
        AuthResponseDTO tokens = appTokenService.issueFor(user);
        CookieUtils.setAuthCookies(response, tokens);
        response.sendRedirect(clientUrl + "/");
    }

    /**
     * Apple only returns verified emails. For Google we require the {@code email_verified} claim to be true.
     */
    private boolean isEmailVerified(String registrationId, OAuth2User principal) {
        if (APPLE.equals(registrationId)) {
            return true;
        }
        return isTrue(principal.getAttribute("email_verified"));
    }

    /**
     * Google exposes {@code given_name}; Apple sends the name only on first consent as a form field, captured
     * into a request attribute by {@link AppleUserAttributesFilter}.
     */
    private String firstName(String registrationId, OAuth2User principal, HttpServletRequest request) {
        if (APPLE.equals(registrationId)) {
            return (String) request.getAttribute(AppleUserAttributesFilter.FIRST_NAME_ATTRIBUTE);
        }
        return principal.getAttribute("given_name");
    }

    private String lastName(String registrationId, OAuth2User principal, HttpServletRequest request) {
        if (APPLE.equals(registrationId)) {
            return (String) request.getAttribute(AppleUserAttributesFilter.LAST_NAME_ATTRIBUTE);
        }
        return principal.getAttribute("family_name");
    }

    private static boolean isTrue(Object value) {
        return value instanceof Boolean bool ? bool : Boolean.parseBoolean(String.valueOf(value));
    }

    private static String stripTrailingSlash(String url) {
        return url != null && url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
