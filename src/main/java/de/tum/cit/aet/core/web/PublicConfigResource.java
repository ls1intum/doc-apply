package de.tum.cit.aet.core.web;

import de.tum.cit.aet.core.dto.PublicConfigDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/public")
public class PublicConfigResource {

    private final Environment env;

    public PublicConfigResource(Environment env) {
        this.env = env;
    }

    /**
     * Get public configuration details such as Keycloak settings and OTP parameters.
     *
     * @return a DTO containing Keycloak and OTP configuration details
     */
    @GetMapping("/config")
    public PublicConfigDTO config() {
        log.info("GET /api/public/config - Retrieving public configuration");
        PublicConfigDTO.KeycloakConfig keycloak = new PublicConfigDTO.KeycloakConfig(
            env.getProperty("keycloak.url"),
            env.getProperty("keycloak.tum-login-realm"),
            env.getProperty("keycloak.client-id"),
            env.getProperty("keycloak.relying-party-id", "")
        );

        PublicConfigDTO.OtpConfig otp = new PublicConfigDTO.OtpConfig(
            env.getProperty("security.otp.length", Integer.class),
            env.getProperty("security.otp.ttl-seconds", Integer.class),
            env.getProperty("security.otp.resend-cooldown-seconds", Integer.class)
        );

        return new PublicConfigDTO(keycloak, otp);
    }
}
