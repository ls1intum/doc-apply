package de.tum.cit.aet.usermanagement.service;

import de.tum.cit.aet.core.service.JwtService;
import de.tum.cit.aet.core.util.StringUtil;
import de.tum.cit.aet.usermanagement.dto.auth.PasskeyActionTokenDTO;
import de.tum.cit.aet.usermanagement.dto.auth.PasskeyDTO;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.keycloak.representations.idm.CredentialRepresentation;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

/**
 * Keycloak-backed passkey (WebAuthn) operations for TUM staff in the {@code tumidpldap} realm.
 * <p>
 * Applicant authentication (registration, email/password, OTP, Google/Apple) and applicant passkeys are
 * handled internally by TUMApply and no longer involve Keycloak. TUM staff authenticate via keycloak-js
 * (header-bearer tokens refreshed client-side), so this service only brokers their passkey management.
 */
@Slf4j
@Service
public class KeycloakAuthenticationService {

    private final String tumLoginRealm;
    private final String browserClientId;
    private final JwtService jwtService;
    private final KeycloakUserService keycloakUserService;

    public KeycloakAuthenticationService(
        @Value("${keycloak.tum-login-realm}") String tumLoginRealm,
        @Value("${keycloak.client-id}") String browserClientId,
        JwtService jwtService,
        KeycloakUserService keycloakUserService
    ) {
        this.tumLoginRealm = tumLoginRealm;
        this.browserClientId = browserClientId;
        this.jwtService = jwtService;
        this.keycloakUserService = keycloakUserService;
    }

    /**
     * Creates a short-lived bridge token the client uses to perform Keycloak passkey actions.
     *
     * @param jwt the user's current access token as a JWT
     * @return DTO with realm, client ID, token value and expiry for passkey actions
     */
    public PasskeyActionTokenDTO createPasskeyActionToken(Jwt jwt) {
        return new PasskeyActionTokenDTO(tumLoginRealm, getPasskeyClientId(jwt), jwt.getTokenValue(), jwtService.secondsUntilExpiry(jwt));
    }

    /**
     * Lists the user's Keycloak credentials filtered to passkey credentials only.
     *
     * @param jwt the user's current access token as a JWT
     * @return list of passkey credentials projected as DTOs
     */
    public List<PasskeyDTO> listPasskeys(Jwt jwt) {
        return keycloakUserService.getCredentials(jwt.getSubject()).stream().filter(this::isPasskeyCredential).map(PasskeyDTO::of).toList();
    }

    /**
     * Removes a passkey credential from the user's Keycloak account.
     *
     * @param jwt          the user's current access token as a JWT
     * @param credentialId the ID of the credential to remove
     */
    public void removePasskey(Jwt jwt, String credentialId) {
        keycloakUserService.removeCredential(jwt.getSubject(), credentialId);
    }

    private String getPasskeyClientId(Jwt jwt) {
        String authorizedParty = jwtService.getAuthorizedParty(jwt);
        return StringUtil.isBlank(authorizedParty) ? browserClientId : authorizedParty;
    }

    private boolean isPasskeyCredential(CredentialRepresentation credential) {
        String type = credential.getType();
        return "webauthn-passwordless".equalsIgnoreCase(type) || "webauthn".equalsIgnoreCase(type);
    }
}
