package de.tum.cit.aet;

import de.tum.cit.aet.core.service.AuthenticationService;
import de.tum.cit.aet.core.service.ImageService;
import de.tum.cit.aet.usermanagement.repository.ResearchGroupRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import de.tum.cit.aet.usermanagement.repository.UserResearchGroupRoleRepository;
import de.tum.cit.aet.usermanagement.service.KeycloakAuthenticationService;
import de.tum.cit.aet.usermanagement.service.KeycloakUserService;
import de.tum.cit.aet.usermanagement.service.UserService;
import java.time.Instant;
import org.mockito.Mockito;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

@TestConfiguration
public class TestSecurityConfiguration {

    @Bean
    public KeycloakAuthenticationService keycloakAuthenticationService() {
        return Mockito.mock(KeycloakAuthenticationService.class);
    }

    @Bean
    public AuthenticationService authenticationService() {
        return Mockito.mock(AuthenticationService.class);
    }

    /**
     * A spy rather than a mock, so behaviour that is only reachable through this service can still be
     * exercised against the real database. Stubbing individual methods works exactly as before;
     * anything left unstubbed now runs for real.
     *
     * @param userRepository                  repository of users
     * @param userResearchGroupRoleRepository repository of the role a user holds in a research group
     * @param researchGroupRepository         repository of research groups
     * @param imageService                    service used to resolve avatars
     * @param passwordEncoder                 encoder used for locally managed passwords
     * @return a spy wrapping a real {@link UserService}
     */
    @Bean
    public UserService userService(
        UserRepository userRepository,
        UserResearchGroupRoleRepository userResearchGroupRoleRepository,
        ResearchGroupRepository researchGroupRepository,
        ImageService imageService,
        PasswordEncoder passwordEncoder
    ) {
        return Mockito.spy(
            new UserService(userRepository, userResearchGroupRoleRepository, researchGroupRepository, imageService, passwordEncoder)
        );
    }

    @Bean
    public KeycloakUserService keycloakUserService() {
        return Mockito.mock(KeycloakUserService.class);
    }

    @Bean
    public JwtDecoder jwtDecoder() {
        return token ->
            Jwt.withTokenValue(token)
                .header("alg", "none")
                .claim("email", "authenticated@example.com")
                .claim("preferred_username", "authenticated@example.com")
                .claim("given_name", "Test")
                .claim("family_name", "User")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build();
    }
}
