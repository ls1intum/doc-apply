package de.tum.cit.aet.core.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

class MultiRealmJwtDecoderTest {

    private static final String KEYCLOAK_URL = "http://localhost:9080";
    private static final String TUM_REALM = "tumidpldap";
    private static final String APP_ISSUER = "https://tumapply.test";

    @Nested
    class Routing {

        @Test
        void shouldUseRemoteDecoderForTrustedTumIssuer() {
            String tumIssuer = KEYCLOAK_URL + "/realms/" + TUM_REALM;
            String token = jwtWithIssuer(tumIssuer);

            AtomicReference<String> factoryIssuer = new AtomicReference<>();
            AtomicReference<String> decodedToken = new AtomicReference<>();
            Jwt expectedJwt = sampleJwt("decoded-subject");

            MultiRealmJwtDecoder decoder = new MultiRealmJwtDecoder(KEYCLOAK_URL, TUM_REALM, APP_ISSUER, appDecoderThatFails(), issuer -> {
                factoryIssuer.set(issuer);
                return rawToken -> {
                    decodedToken.set(rawToken);
                    return expectedJwt;
                };
            });

            Jwt result = decoder.decode(token);

            assertThat(factoryIssuer.get()).isEqualTo(tumIssuer);
            assertThat(decodedToken.get()).isEqualTo(token);
            assertThat(result).isSameAs(expectedJwt);
        }

        @Test
        void shouldUseLocalAppDecoderForAppIssuer() {
            String token = jwtWithIssuer(APP_ISSUER);
            Jwt expectedJwt = sampleJwt("app-subject");
            AtomicInteger remoteFactoryCalls = new AtomicInteger(0);

            MultiRealmJwtDecoder decoder = new MultiRealmJwtDecoder(
                KEYCLOAK_URL,
                TUM_REALM,
                APP_ISSUER,
                rawToken -> expectedJwt,
                issuer -> {
                    remoteFactoryCalls.incrementAndGet();
                    return rawToken -> sampleJwt("should-not-be-used");
                }
            );

            Jwt result = decoder.decode(token);

            assertThat(result).isSameAs(expectedJwt);
            // The app issuer must be validated locally, never via the remote (network) factory.
            assertThat(remoteFactoryCalls.get()).isZero();
        }

        @Test
        void shouldReuseCachedRemoteDecoderPerIssuer() {
            String tumIssuer = KEYCLOAK_URL + "/realms/" + TUM_REALM;
            String token = jwtWithIssuer(tumIssuer);

            AtomicInteger factoryCalls = new AtomicInteger(0);
            JwtDecoder fixedDecoder = rawToken -> sampleJwt("cached");

            MultiRealmJwtDecoder decoder = new MultiRealmJwtDecoder(KEYCLOAK_URL, TUM_REALM, APP_ISSUER, appDecoderThatFails(), issuer -> {
                factoryCalls.incrementAndGet();
                return fixedDecoder;
            });

            decoder.decode(token);
            decoder.decode(token);

            assertThat(factoryCalls.get()).isEqualTo(1);
        }
    }

    @Nested
    class Rejection {

        @ParameterizedTest
        @ValueSource(strings = { "http://localhost:9080/realms/external-login", "http://malicious.example/realms/evil" })
        void shouldRejectWhenIssuerIsUntrusted(String issuer) {
            String token = jwtWithIssuer(issuer);
            MultiRealmJwtDecoder decoder = newDecoder();

            assertThatThrownBy(() -> decoder.decode(token))
                .isInstanceOf(BadJwtException.class)
                .hasMessageContaining("Untrusted token issuer");
        }

        @Test
        void shouldRejectWhenTokenIsMalformed() {
            MultiRealmJwtDecoder decoder = newDecoder();

            assertThatThrownBy(() -> decoder.decode("not-a-jwt"))
                .isInstanceOf(BadJwtException.class)
                .hasMessageContaining("Invalid JWT");
        }

        @Test
        void shouldRejectWhenIssuerIsMissing() {
            String token = jwtWithoutIssuer();
            MultiRealmJwtDecoder decoder = newDecoder();

            assertThatThrownBy(() -> decoder.decode(token))
                .isInstanceOf(BadJwtException.class)
                .hasMessageContaining("Missing token issuer");
        }
    }

    private static MultiRealmJwtDecoder newDecoder() {
        return new MultiRealmJwtDecoder(KEYCLOAK_URL, TUM_REALM, APP_ISSUER, appDecoderThatFails(), issuer -> rawToken -> sampleJwt("x"));
    }

    private static JwtDecoder appDecoderThatFails() {
        return rawToken -> {
            throw new AssertionError("app decoder should not be called for non-app issuers");
        };
    }

    private static Jwt sampleJwt(String subject) {
        return new Jwt("token", Instant.now(), Instant.now().plusSeconds(300), Map.of("alg", "none"), Map.of("sub", subject));
    }

    private static String jwtWithIssuer(String issuer) {
        String payloadJson = "{\"iss\":\"" + issuer + "\",\"sub\":\"user-1\"}";
        return unsignedJwt(payloadJson);
    }

    private static String jwtWithoutIssuer() {
        return unsignedJwt("{\"sub\":\"user-1\"}");
    }

    private static String unsignedJwt(String payloadJson) {
        Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();
        String header = encoder.encodeToString("{\"alg\":\"none\"}".getBytes(StandardCharsets.UTF_8));
        String payload = encoder.encodeToString(payloadJson.getBytes(StandardCharsets.UTF_8));
        return header + "." + payload + ".";
    }
}
