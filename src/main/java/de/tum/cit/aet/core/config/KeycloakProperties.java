package de.tum.cit.aet.core.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "keycloak", ignoreUnknownFields = false)
public class KeycloakProperties {

    private String url;
    private String tumLoginRealm;
    private String clientId;
    private String relyingPartyId;
    private Users users = new Users();
    private Admin admin = new Admin();

    @Data
    public static class Users {

        private AdminUser admin = new AdminUser();
    }

    @Data
    public static class AdminUser {

        private String username;
        private String password;
    }

    @Data
    public static class Admin {

        private RealmClient tum = new RealmClient();
    }

    @Data
    public static class RealmClient {

        private String clientId;
        private String clientSecret;
    }
}
