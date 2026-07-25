package de.tum.cit.aet.core.security;

import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.JWTParser;
import java.text.ParseException;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.function.Function;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Decodes JWTs from multiple trusted issuers by selecting the matching decoder from the token's {@code iss}
 * claim before validating the token. Trusts the TUM Keycloak realm (validated remotely against its JWKS) and
 * TUMApply's own issuer (validated in-process against the application's public key).
 */
public class MultiRealmJwtDecoder implements JwtDecoder {

    private final Set<String> trustedIssuers;
    private final String appIssuer;
    private final JwtDecoder appDecoder;
    private final Function<String, JwtDecoder> decoderFactory;
    private final ConcurrentMap<String, JwtDecoder> decoders = new ConcurrentHashMap<>();

    /**
     * Creates a decoder that trusts the TUM Keycloak realm and the application's own issuer.
     *
     * @param keycloakUrl base URL of the Keycloak instance
     * @param tumLoginRealm name of the TUM IDP/LDAP realm
     * @param appIssuer issuer URI used by TUMApply for its self-issued tokens
     * @param appDecoder decoder that validates app-issued tokens locally (no network)
     */
    public MultiRealmJwtDecoder(String keycloakUrl, String tumLoginRealm, String appIssuer, JwtDecoder appDecoder) {
        this(keycloakUrl, tumLoginRealm, appIssuer, appDecoder, JwtDecoders::fromIssuerLocation);
    }

    MultiRealmJwtDecoder(
        String keycloakUrl,
        String tumLoginRealm,
        String appIssuer,
        JwtDecoder appDecoder,
        Function<String, JwtDecoder> decoderFactory
    ) {
        this.appIssuer = appIssuer;
        this.appDecoder = appDecoder;
        this.trustedIssuers = trustedIssuers(keycloakUrl, tumLoginRealm, appIssuer);
        this.decoderFactory = decoderFactory;
    }

    @Override
    public Jwt decode(String token) throws JwtException {
        String issuer = extractIssuer(token);
        if (!trustedIssuers.contains(issuer)) {
            throw new BadJwtException("Untrusted token issuer");
        }
        if (issuer.equals(appIssuer)) {
            return appDecoder.decode(token);
        }
        return decoders.computeIfAbsent(issuer, decoderFactory).decode(token);
    }

    private String extractIssuer(String token) {
        try {
            JWTClaimsSet claims = JWTParser.parse(token).getJWTClaimsSet();
            String issuer = claims.getIssuer();
            if (issuer == null || issuer.isBlank()) {
                throw new BadJwtException("Missing token issuer");
            }
            return issuer;
        } catch (ParseException e) {
            throw new BadJwtException("Invalid JWT", e);
        }
    }

    private static Set<String> trustedIssuers(String keycloakUrl, String tumLoginRealm, String appIssuer) {
        LinkedHashSet<String> issuers = new LinkedHashSet<>();
        addIssuer(issuers, keycloakUrl, tumLoginRealm);
        if (appIssuer != null && !appIssuer.isBlank()) {
            issuers.add(appIssuer);
        }
        return Set.copyOf(issuers);
    }

    private static void addIssuer(Set<String> issuers, String keycloakUrl, String realm) {
        if (realm == null || realm.isBlank()) {
            return;
        }
        issuers.add(UriComponentsBuilder.fromUriString(keycloakUrl).pathSegment("realms", realm).build().toUriString());
    }
}
