package de.tum.cit.aet.core.config;

import de.tum.cit.aet.core.security.MultiRealmJwtDecoder;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.security.oauth2.jwt.JwtDecoder;

@Configuration
public class JwtDecoderConfiguration {

    /**
     * Provides the resource-server {@link JwtDecoder} that accepts tokens from the TUM Keycloak realm
     * (validated remotely) and from TUMApply's own issuer (validated locally via {@code appJwtDecoder}).
     *
     * @param keycloakUrl base URL of the Keycloak instance
     * @param tumLoginRealm name of the TUM IDP/LDAP realm
     * @param appIssuer issuer URI used by TUMApply for self-issued tokens
     * @param appJwtDecoder local decoder for app-issued tokens
     * @return a decoder that selects the matching decoder per token issuer
     */
    @Bean
    @Primary
    public JwtDecoder jwtDecoder(
        @Value("${keycloak.url}") String keycloakUrl,
        @Value("${keycloak.tum-login-realm}") String tumLoginRealm,
        @Value("${app.token.issuer}") String appIssuer,
        @Qualifier("appJwtDecoder") JwtDecoder appJwtDecoder
    ) {
        return new MultiRealmJwtDecoder(keycloakUrl, tumLoginRealm, appIssuer, appJwtDecoder);
    }
}
