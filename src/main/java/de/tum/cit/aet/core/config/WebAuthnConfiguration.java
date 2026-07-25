package de.tum.cit.aet.core.config;

import de.tum.cit.aet.core.security.CustomJwtAuthenticationConverter;
import de.tum.cit.aet.core.security.webauthn.WebAuthnLoginSuccessHandler;
import de.tum.cit.aet.core.service.AppTokenService;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import de.tum.cit.aet.usermanagement.service.UserService;
import jakarta.servlet.http.Cookie;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.security.config.ObjectPostProcessor;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.CsrfConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.webauthn.authentication.WebAuthnAuthenticationFilter;
import org.springframework.security.web.webauthn.management.JdbcPublicKeyCredentialUserEntityRepository;
import org.springframework.security.web.webauthn.management.JdbcUserCredentialRepository;
import org.springframework.security.web.webauthn.management.PublicKeyCredentialUserEntityRepository;
import org.springframework.security.web.webauthn.management.UserCredentialRepository;
import org.springframework.web.filter.CorsFilter;
import org.springframework.web.util.WebUtils;
import tools.jackson.databind.ObjectMapper;

/**
 * In-app WebAuthn (passkeys) for applicants, replacing the Keycloak passkey flow for the external-login realm.
 * Uses Spring Security's built-in WebAuthn support backed by JDBC credential storage (migration 045).
 *
 * WebAuthn runs on its own filter chain (matched before the stateless resource-server chain) which permits a
 * session so the two-step ceremony's challenge is persisted between the {@code /options} and finish calls.
 * Registration endpoints are protected by the same app-JWT cookie used elsewhere; on a successful passkey
 * authentication, {@link WebAuthnLoginSuccessHandler} issues an app session instead of a server-side one.
 */
@Configuration
public class WebAuthnConfiguration {

    private final String rpId;
    private final String rpName;
    private final Set<String> allowedOrigins;

    public WebAuthnConfiguration(
        @Value("${app.webauthn.rp-id:localhost}") String rpId,
        @Value("${app.webauthn.rp-name:TUM Apply}") String rpName,
        @Value("${app.webauthn.allowed-origins:http://localhost:4200,http://localhost:8080}") String allowedOrigins
    ) {
        this.rpId = rpId;
        this.rpName = rpName;
        this.allowedOrigins = Arrays.stream(allowedOrigins.split(","))
            .map(String::trim)
            .filter(origin -> !origin.isEmpty())
            .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    /**
     * Stores passkey credentials in the {@code user_credentials} table.
     *
     * @param jdbcOperations JDBC access used by the repository
     * @return the JDBC-backed user credential repository
     */
    @Bean
    public UserCredentialRepository userCredentialRepository(JdbcOperations jdbcOperations) {
        return new JdbcUserCredentialRepository(jdbcOperations);
    }

    /**
     * Stores WebAuthn user entities in the {@code user_entities} table.
     *
     * @param jdbcOperations JDBC access used by the repository
     * @return the JDBC-backed user entity repository
     */
    @Bean
    public PublicKeyCredentialUserEntityRepository publicKeyCredentialUserEntityRepository(JdbcOperations jdbcOperations) {
        return new JdbcPublicKeyCredentialUserEntityRepository(jdbcOperations);
    }

    /**
     * Loads the user behind a passkey for Spring Security's WebAuthn authentication provider. The WebAuthn
     * user-entity name is the local user id (set at registration from the JWT subject); this maps it to the
     * user's roles. The issued session is short-lived — subsequent API calls re-derive roles from the app JWT.
     *
     * @param userRepository repository used to load the user and roles
     * @return a user-details service keyed by the local user id
     */
    @Bean
    public UserDetailsService webAuthnUserDetailsService(UserRepository userRepository) {
        return username -> {
            UUID userId;
            try {
                userId = UUID.fromString(username);
            } catch (IllegalArgumentException ex) {
                throw new UsernameNotFoundException(username);
            }
            User user = userRepository
                .findWithResearchGroupRolesByUserId(userId)
                .orElseThrow(() -> new UsernameNotFoundException(username));
            List<SimpleGrantedAuthority> authorities = user
                .getResearchGroupRoles()
                .stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role.getRole().name()))
                .toList();
            return new org.springframework.security.core.userdetails.User(user.getUserId().toString(), "", authorities);
        };
    }

    /**
     * Success handler that turns a passkey authentication into an app-issued cookie session.
     *
     * @param userService     resolves the local user from the authenticated principal
     * @param appTokenService mints the app tokens
     * @param objectMapper    serializes the JSON response body
     * @return the WebAuthn login success handler
     */
    @Bean
    public WebAuthnLoginSuccessHandler webAuthnLoginSuccessHandler(
        UserService userService,
        AppTokenService appTokenService,
        ObjectMapper objectMapper
    ) {
        return new WebAuthnLoginSuccessHandler(userService, appTokenService, objectMapper);
    }

    /**
     * Filter chain for the WebAuthn endpoints. Higher priority than the resource-server chain and scoped to
     * the WebAuthn paths; permits a session for challenge persistence while still authenticating registration
     * via the app-JWT cookie.
     *
     * @param http                       the HTTP security builder
     * @param webAuthnLoginSuccessHandler issues the app session on a successful passkey authentication
     * @param jwtAuthenticationConverter  converts the app JWT to an authentication for registration calls
     * @param corsFilter                  shared CORS filter
     * @return the WebAuthn security filter chain
     * @throws Exception if the chain cannot be built
     */
    @Bean
    @Order(2)
    public SecurityFilterChain webAuthnFilterChain(
        HttpSecurity http,
        WebAuthnLoginSuccessHandler webAuthnLoginSuccessHandler,
        CustomJwtAuthenticationConverter jwtAuthenticationConverter,
        CorsFilter corsFilter
    ) throws Exception {
        http
            .securityMatcher("/webauthn/**", "/login/webauthn")
            .csrf(CsrfConfigurer::disable)
            .addFilterBefore(corsFilter, UsernamePasswordAuthenticationFilter.class)
            // A session is allowed here only to carry the WebAuthn challenge between the two ceremony calls.
            // Rotate the session id on authentication to prevent session fixation.
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED).sessionFixation(fixation -> fixation.changeSessionId())
            )
            .authorizeHttpRequests(requests ->
                requests.requestMatchers("/webauthn/authenticate/options", "/login/webauthn").permitAll().anyRequest().authenticated()
            )
            // Registration calls are authenticated via the existing app-JWT cookie.
            .oauth2ResourceServer(oauth2 ->
                oauth2
                    .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter))
                    .bearerTokenResolver(cookieBearerTokenResolver())
            )
            .webAuthn(webauthn ->
                webauthn
                    .rpId(rpId)
                    .rpName(rpName)
                    .allowedOrigins(allowedOrigins)
                    .disableDefaultRegistrationPage(true)
                    .withObjectPostProcessor(
                        new ObjectPostProcessor<Object>() {
                            @Override
                            public <O> O postProcess(O object) {
                                if (object instanceof WebAuthnAuthenticationFilter filter) {
                                    filter.setAuthenticationSuccessHandler(webAuthnLoginSuccessHandler);
                                }
                                return object;
                            }
                        }
                    )
            );
        return http.build();
    }

    /**
     * Resolves the bearer token from the {@code access_token} cookie (falling back to the Authorization header).
     */
    private BearerTokenResolver cookieBearerTokenResolver() {
        DefaultBearerTokenResolver defaultResolver = new DefaultBearerTokenResolver();
        return request -> {
            Cookie accessCookie = WebUtils.getCookie(request, "access_token");
            if (accessCookie != null && accessCookie.getValue() != null && !accessCookie.getValue().isBlank()) {
                return accessCookie.getValue();
            }
            return defaultResolver.resolve(request);
        };
    }
}
