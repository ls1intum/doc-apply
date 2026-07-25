package de.tum.cit.aet.core.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Public configuration values exposed to the client at startup so the SPA can wire up Keycloak and the OTP flow without
 * embedding environment-specific values at build time.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PublicConfigDTO(KeycloakConfig keycloak, OtpConfig otp) {
    public record KeycloakConfig(String url, String tumLoginRealm, String clientId, String relyingPartyId) {}

    public record OtpConfig(Integer length, Integer ttlSeconds, Integer resendCooldownSeconds) {}
}
