package de.tum.cit.aet.usermanagement.web;

import de.tum.cit.aet.core.exception.UnauthorizedException;
import de.tum.cit.aet.core.security.annotations.Authenticated;
import de.tum.cit.aet.core.security.annotations.Public;
import de.tum.cit.aet.core.util.CookieUtils;
import de.tum.cit.aet.core.util.HttpUtils;
import de.tum.cit.aet.usermanagement.dto.auth.AuthResponseDTO;
import de.tum.cit.aet.usermanagement.dto.auth.AuthSessionInfoDTO;
import de.tum.cit.aet.usermanagement.dto.auth.LoginRequestDTO;
import de.tum.cit.aet.usermanagement.dto.auth.OtpCompleteDTO;
import de.tum.cit.aet.usermanagement.dto.auth.PasskeyActionTokenDTO;
import de.tum.cit.aet.usermanagement.dto.auth.PasskeyDTO;
import de.tum.cit.aet.usermanagement.service.KeycloakAuthenticationService;
import de.tum.cit.aet.usermanagement.service.LocalAuthenticationService;
import de.tum.cit.aet.usermanagement.service.OtpFlowService;
import de.tum.cit.aet.usermanagement.service.TokenRefreshDispatcher;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Sets authentication cookies based on tokens.
 */
@Slf4j
@RestController
@RequestMapping("/api/auth")
@AllArgsConstructor
public class AuthenticationResource {

    private final KeycloakAuthenticationService keycloakAuthenticationService;
    private final LocalAuthenticationService localAuthenticationService;
    private final TokenRefreshDispatcher tokenRefreshDispatcher;
    private final OtpFlowService otpFlowService;

    /**
     * Authenticates a user via email and password and sets an access token as an HttpOnly cookie.
     *
     * @param loginRequest the DTO containing the user's email and password
     * @param response     the HTTP servlet response used to set the authentication cookie
     * @return HTTP 200 OK if login is successful and the cookie is set
     * @throws UnauthorizedException if login credentials are invalid
     */
    @Public
    @PostMapping("/login")
    public AuthSessionInfoDTO login(@Valid @RequestBody LoginRequestDTO loginRequest, HttpServletResponse response) {
        log.info("POST /api/auth/login - Authenticating {}", loginRequest.email());
        AuthResponseDTO tokens = localAuthenticationService.loginWithCredentials(loginRequest.email(), loginRequest.password());
        CookieUtils.setAuthCookies(response, tokens);
        return new AuthSessionInfoDTO(tokens.expiresIn(), tokens.refreshExpiresIn());
    }

    /**
     * Logs out the user by revoking the refresh token and clearing authentication cookies.
     *
     * Public on purpose: it operates on the refresh-token cookie directly and must still succeed when the
     * short-lived access token has already expired (the client calls this exactly on session expiry).
     *
     * @param request  the HTTP servlet request containing the refresh_token cookie
     * @param response the HTTP servlet response used to clear authentication cookies
     * @return HTTP 200 OK if logout is successful
     */
    @Public
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        log.info("POST /api/auth/logout - Clearing session and revoking refresh token");
        String accessToken = null;
        String refreshToken = null;
        if (request.getCookies() != null) {
            for (Cookie c : request.getCookies()) {
                if ("access_token".equals(c.getName())) {
                    accessToken = c.getValue();
                } else if ("refresh_token".equals(c.getName())) {
                    refreshToken = c.getValue();
                }
            }
        }
        if (refreshToken != null && !refreshToken.isBlank()) {
            tokenRefreshDispatcher.logout(accessToken, refreshToken);
        }

        CookieUtils.setAuthCookies(response, null);
        return ResponseEntity.ok().build();
    }

    /**
     * Refreshes authentication cookies using the refresh token cookie.
     *
     * Always returns HTTP 200. The {@code authenticated} flag in the response indicates whether a valid server
     * session is present: it is {@code false} when no auth cookies are sent (e.g. anonymous startup probe) or
     * when the cookies are stale/invalid. In the stale case the cookies are cleared as a side effect. Reserving
     * 401 for "actually unauthorized" requests keeps the dev console clean and lets the client probe without
     * treating an absent session as an error.
     *
     * @param request  the HTTP servlet request containing the refresh_token cookie
     * @param response the HTTP servlet response used to set new authentication cookies
     * @return session info with token lifetimes when authenticated, otherwise an unauthenticated marker
     */
    @Public
    @PostMapping("/refresh")
    public AuthSessionInfoDTO refresh(HttpServletRequest request, HttpServletResponse response) {
        String accessToken = null;
        String refreshToken = null;
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("access_token".equals(cookie.getName())) {
                    accessToken = cookie.getValue();
                } else if ("refresh_token".equals(cookie.getName())) {
                    refreshToken = cookie.getValue();
                }
            }
        }

        boolean hasAccessToken = accessToken != null && !accessToken.isBlank();
        boolean hasRefreshToken = refreshToken != null && !refreshToken.isBlank();
        if (!hasAccessToken && !hasRefreshToken) {
            return AuthSessionInfoDTO.unauthenticated();
        }
        log.info("POST /api/auth/refresh - Rotating session tokens");

        try {
            AuthResponseDTO tokens = tokenRefreshDispatcher.refresh(accessToken, refreshToken);
            CookieUtils.setAuthCookies(response, tokens);
            return new AuthSessionInfoDTO(tokens.expiresIn(), tokens.refreshExpiresIn());
        } catch (UnauthorizedException ex) {
            CookieUtils.setAuthCookies(response, null);
            return AuthSessionInfoDTO.unauthenticated();
        }
    }

    /**
     * Completes an OTP flow by verifying the code and executing the requested purpose (LOGIN or REGISTER). On
     * success, authentication cookies are set and the response returns token lifetimes plus whether profile
     * completion is needed.
     *
     * @param body     the OTP completion request (email, code, purpose, optional profile data)
     * @param request  the HTTP servlet request, used to determine client IP
     * @param response the HTTP servlet response used to set authentication cookies
     * @return DTO containing token lifetimes and profile completion flag
     */
    @Public
    @PostMapping("/otp-complete")
    public AuthSessionInfoDTO otpComplete(
        @Valid @RequestBody OtpCompleteDTO body,
        HttpServletRequest request,
        HttpServletResponse response
    ) {
        log.info("POST /api/auth/otp-complete - Completing {} for {}", body.purpose(), body.email());
        return otpFlowService.otpComplete(body, HttpUtils.getClientIp(request), response);
    }

    @Authenticated
    @GetMapping("/passkeys/action-token")
    public PasskeyActionTokenDTO createPasskeyActionToken(@AuthenticationPrincipal Jwt jwt) {
        log.info("GET /api/auth/passkeys/action-token - Creating passkey action token for subject={}", jwt.getSubject());
        return keycloakAuthenticationService.createPasskeyActionToken(jwt);
    }

    @Authenticated
    @GetMapping("/passkeys")
    public List<PasskeyDTO> listPasskeys(@AuthenticationPrincipal Jwt jwt) {
        log.info("GET /api/auth/passkeys - Listing Keycloak passkeys for subject={}", jwt.getSubject());
        return keycloakAuthenticationService.listPasskeys(jwt);
    }

    @Authenticated
    @DeleteMapping("/passkeys/{credentialId}")
    public ResponseEntity<Void> removePasskey(@AuthenticationPrincipal Jwt jwt, @PathVariable String credentialId) {
        log.info("DELETE /api/auth/passkeys/{} - Removing Keycloak passkey for subject={}", credentialId, jwt.getSubject());
        keycloakAuthenticationService.removePasskey(jwt, credentialId);
        return ResponseEntity.noContent().build();
    }
}
