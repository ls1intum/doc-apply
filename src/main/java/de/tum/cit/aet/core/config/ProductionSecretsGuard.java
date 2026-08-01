package de.tum.cit.aet.core.config;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

/**
 * Fails fast at startup (production profile only) when security-critical secrets are left at their built-in
 * development defaults, mirroring the RSA-key guard in {@code AppTokenKeyConfiguration}. It rejects a default
 * OTP HMAC secret (which also signs the OAuth2 authorization-request cookie, so a shared default would let an
 * attacker forge it), a {@code localhost} WebAuthn relying-party id (which silently breaks passkeys), and the
 * built-in Keycloak admin client secret (which would leave the staff-lookup admin API on a well-known default).
 */
@Component
public class ProductionSecretsGuard {

    /** SHA-256 digest of the committed default {@code security.otp.hmac-secret}; compared by hash so the value itself is not embedded here. */
    private static final String DEFAULT_OTP_HMAC_DIGEST = "1b3a468a85889caba734e305dddf88d2e4299efd95553d2598a00a25977ae548";

    /** Committed default {@code keycloak.admin.tum.client-secret} that must be overridden in production. */
    private static final String DEFAULT_KEYCLOAK_ADMIN_CLIENT_SECRET = "docapply-admin-api-secret";

    public ProductionSecretsGuard(
        Environment environment,
        @Value("${security.otp.hmac-secret:}") String otpHmacSecret,
        @Value("${app.webauthn.rp-id:localhost}") String webAuthnRpId,
        @Value("${keycloak.admin.tum.client-secret:}") String keycloakAdminClientSecret
    ) {
        if (!environment.acceptsProfiles(Profiles.of("prod"))) {
            return;
        }
        List<String> problems = new ArrayList<>();
        if (otpHmacSecret.isBlank() || DEFAULT_OTP_HMAC_DIGEST.equals(sha256Hex(otpHmacSecret))) {
            problems.add("OTP_HMAC_SECRET must be set to a unique value (not the built-in default)");
        }
        if (webAuthnRpId.isBlank() || "localhost".equalsIgnoreCase(webAuthnRpId)) {
            problems.add("APP_WEBAUTHN_RP_ID must be set to the production relying-party domain");
        }
        if (keycloakAdminClientSecret.isBlank() || DEFAULT_KEYCLOAK_ADMIN_CLIENT_SECRET.equals(keycloakAdminClientSecret)) {
            problems.add("KEYCLOAK_ADMIN_TUM_CLIENT_SECRET must be set to a unique value (not the built-in default)");
        }
        if (!problems.isEmpty()) {
            throw new IllegalStateException("Invalid production security configuration: " + String.join("; ", problems));
        }
    }

    private static String sha256Hex(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
