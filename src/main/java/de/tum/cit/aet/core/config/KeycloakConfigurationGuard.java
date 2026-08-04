package de.tum.cit.aet.core.config;

import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class KeycloakConfigurationGuard {

    private final KeycloakProperties properties;

    public KeycloakConfigurationGuard(KeycloakProperties properties) {
        this.properties = properties;
        validate();
    }

    private void validate() {
        List<String> missingOrBlank = new ArrayList<>();
        requireNonBlank(missingOrBlank, "keycloak.url", properties.getUrl());
        requireNonBlank(missingOrBlank, "keycloak.tum-login-realm", properties.getTumLoginRealm());
        requireNonBlank(missingOrBlank, "keycloak.client-id", properties.getClientId());
        requireNonBlank(missingOrBlank, "keycloak.admin.tum.client-id", properties.getAdmin().getTum().getClientId());
        requireNonBlank(missingOrBlank, "keycloak.admin.tum.client-secret", properties.getAdmin().getTum().getClientSecret());
        if (!missingOrBlank.isEmpty()) {
            throw new IllegalStateException(
                "Invalid Keycloak configuration. The following properties must be set and non-blank: " + String.join(", ", missingOrBlank)
            );
        }
    }

    private void requireNonBlank(List<String> missingOrBlank, String key, String value) {
        if (value == null || value.isBlank()) {
            missingOrBlank.add(key);
        }
    }
}
