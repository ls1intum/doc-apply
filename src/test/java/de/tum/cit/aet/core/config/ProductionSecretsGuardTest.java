package de.tum.cit.aet.core.config;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

class ProductionSecretsGuardTest {

    private static final String DEFAULT_OTP_SECRET = "3vWK1lE1FnrjAovOmWwn8O9xqq5WTtNOY/NUdSAKmoQ=";
    private static final String DEFAULT_KEYCLOAK_ADMIN_CLIENT_SECRET = "tumapply-admin-api-secret";

    private static final String GOOD_OTP_SECRET = "a-unique-production-otp-secret";
    private static final String GOOD_RP_ID = "tumapply.aet.cit.tum.de";
    private static final String GOOD_KEYCLOAK_CLIENT_SECRET = "a-unique-admin-secret";

    private static Environment environment(boolean prod) {
        Environment environment = mock(Environment.class);
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(prod);
        return environment;
    }

    private static ProductionSecretsGuard guard(Environment environment, String otp, String rpId, String kcSecret) {
        return new ProductionSecretsGuard(environment, otp, rpId, kcSecret);
    }

    @Nested
    class OutsideProduction {

        @Test
        void shouldNotThrowWhenProfileIsNotProdEvenWithBuiltInDefaults() {
            assertThatCode(() ->
                guard(environment(false), DEFAULT_OTP_SECRET, "localhost", DEFAULT_KEYCLOAK_ADMIN_CLIENT_SECRET)
            ).doesNotThrowAnyException();
        }
    }

    @Nested
    class InProduction {

        @Test
        void shouldNotThrowWhenAllSecretsAreOverridden() {
            assertThatCode(() ->
                guard(environment(true), GOOD_OTP_SECRET, GOOD_RP_ID, GOOD_KEYCLOAK_CLIENT_SECRET)
            ).doesNotThrowAnyException();
        }

        @Test
        void shouldThrowWhenOtpSecretIsTheBuiltInDefault() {
            assertThatThrownBy(() -> guard(environment(true), DEFAULT_OTP_SECRET, GOOD_RP_ID, GOOD_KEYCLOAK_CLIENT_SECRET))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("OTP_HMAC_SECRET");
        }

        @Test
        void shouldThrowWhenWebAuthnRpIdIsLocalhost() {
            assertThatThrownBy(() -> guard(environment(true), GOOD_OTP_SECRET, "localhost", GOOD_KEYCLOAK_CLIENT_SECRET))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("APP_WEBAUTHN_RP_ID");
        }

        @Test
        void shouldThrowWhenKeycloakAdminClientSecretIsTheBuiltInDefault() {
            assertThatThrownBy(() -> guard(environment(true), GOOD_OTP_SECRET, GOOD_RP_ID, DEFAULT_KEYCLOAK_ADMIN_CLIENT_SECRET))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("KEYCLOAK_ADMIN_TUM_CLIENT_SECRET");
        }
    }
}
