package de.tum.cit.aet.core.security.webauthn;

import de.tum.cit.aet.core.service.AppTokenService;
import de.tum.cit.aet.core.util.CookieUtils;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.dto.auth.AuthResponseDTO;
import de.tum.cit.aet.usermanagement.dto.auth.AuthSessionInfoDTO;
import de.tum.cit.aet.usermanagement.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import tools.jackson.databind.ObjectMapper;

/**
 * Turns a successful in-app WebAuthn (passkey) authentication into an app-issued cookie session, instead of
 * the default session-based behaviour. The authenticated principal name corresponds to the WebAuthn user
 * entity (set to the local user id at registration); this handler resolves the {@link User}, mints app tokens
 * via {@link AppTokenService}, writes the auth cookies and returns the session info as JSON (no redirect).
 */
@Slf4j
public class WebAuthnLoginSuccessHandler implements AuthenticationSuccessHandler {

    private final UserService userService;
    private final AppTokenService appTokenService;
    private final ObjectMapper objectMapper;

    public WebAuthnLoginSuccessHandler(UserService userService, AppTokenService appTokenService, ObjectMapper objectMapper) {
        this.userService = userService;
        this.appTokenService = appTokenService;
        this.objectMapper = objectMapper;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication)
        throws IOException {
        User user = resolveUser(authentication.getName());
        if (user == null) {
            log.warn("Passkey authentication succeeded but no local user matched principal");
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }
        AuthResponseDTO tokens = appTokenService.issueFor(user);
        CookieUtils.setAuthCookies(response, tokens);
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), new AuthSessionInfoDTO(tokens.expiresIn(), tokens.refreshExpiresIn()));
    }

    /**
     * The WebAuthn user-entity name is the local user id set at registration; fall back to an email lookup
     * to be tolerant of either identifier.
     */
    private User resolveUser(String principalName) {
        if (principalName == null || principalName.isBlank()) {
            return null;
        }
        try {
            return userService.findById(principalName);
        } catch (RuntimeException ex) {
            return userService.findByEmail(principalName).orElse(null);
        }
    }
}
