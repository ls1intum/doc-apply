package de.tum.cit.aet.usermanagement.service;

import de.tum.cit.aet.core.service.AppTokenService;
import de.tum.cit.aet.usermanagement.dto.auth.AuthResponseDTO;
import org.springframework.stereotype.Service;

/**
 * Handles cookie-based session refresh and logout. All cookie sessions are app-issued: applicants (email/
 * password, OTP, Google/Apple, passkey) authenticate into an app session, while TUM staff use Keycloak via
 * keycloak-js with header-bearer tokens refreshed client-side (they never use these cookie endpoints).
 * Therefore refresh and logout always delegate to {@link AppTokenService}.
 */
@Service
public class TokenRefreshDispatcher {

    private final AppTokenService appTokenService;

    public TokenRefreshDispatcher(AppTokenService appTokenService) {
        this.appTokenService = appTokenService;
    }

    /**
     * Refreshes the app session from the refresh-token cookie.
     *
     * @param accessToken  the current access token (unused; retained for call-site symmetry)
     * @param refreshToken the refresh token from the cookie
     * @return a freshly issued token pair
     */
    public AuthResponseDTO refresh(String accessToken, String refreshToken) {
        return appTokenService.refresh(refreshToken);
    }

    /**
     * Revokes the app session's refresh token on logout.
     *
     * @param accessToken  the current access token (unused; retained for call-site symmetry)
     * @param refreshToken the refresh token to revoke
     */
    public void logout(String accessToken, String refreshToken) {
        appTokenService.revoke(refreshToken);
    }
}
