package de.tum.cit.aet.core.web;

import com.nimbusds.jose.KeySourceException;
import com.nimbusds.jose.jwk.JWKMatcher;
import com.nimbusds.jose.jwk.JWKSelector;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Publishes the public JSON Web Key Set used to verify app-issued JWTs, so external/native clients and
 * future token consumers can validate TUMApply's tokens. The resource server itself verifies app tokens
 * in-process via the {@code appJwtDecoder} bean and does not call this endpoint.
 */
@Slf4j
@RestController
public class JwksResource {

    private final JWKSource<SecurityContext> appJwkSource;

    public JwksResource(JWKSource<SecurityContext> appJwkSource) {
        this.appJwkSource = appJwkSource;
    }

    /**
     * @return the JWK set containing only public key parameters
     * @throws KeySourceException if the key set cannot be read
     */
    @GetMapping("/.well-known/jwks.json")
    public Map<String, Object> jwks() throws KeySourceException {
        log.info("GET /.well-known/jwks.json - Publishing app JWK set");
        JWKSet publicKeys = new JWKSet(appJwkSource.get(new JWKSelector(new JWKMatcher.Builder().build()), null));
        return publicKeys.toJSONObject(); // public parameters only
    }
}
