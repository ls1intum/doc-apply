package de.tum.cit.aet.core.config;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.ECKey;
import com.nimbusds.jose.jwk.JWK;
import de.tum.cit.aet.core.security.oauth2.AppleAuthorizationRequestResolver;
import de.tum.cit.aet.core.security.oauth2.AppleUserAttributesFilter;
import de.tum.cit.aet.core.security.oauth2.HttpCookieOAuth2AuthorizationRequestRepository;
import de.tum.cit.aet.core.security.oauth2.OAuth2LoginSuccessHandler;
import de.tum.cit.aet.core.service.AppTokenService;
import de.tum.cit.aet.usermanagement.service.UserService;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.function.Function;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.CsrfConfigurer;
import org.springframework.security.oauth2.client.endpoint.NimbusJwtClientAuthenticationParametersConverter;
import org.springframework.security.oauth2.client.endpoint.OAuth2AuthorizationCodeGrantRequest;
import org.springframework.security.oauth2.client.endpoint.RestClientAuthorizationCodeTokenResponseClient;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.OAuth2LoginAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import tools.jackson.databind.ObjectMapper;

/**
 * Security chain that lets DocApply perform Google/Apple sign-in directly (replacing Keycloak IdP
 * brokering for the decommissioned external-login realm). It is a separate, higher-priority filter chain
 * matching only the OAuth2 endpoints, so the stateless resource-server chain ({@code /api/**}) is untouched.
 *
 * Activated only under the {@code social-login} profile: this keeps the {@code ClientRegistrationRepository}
 * auto-configuration (and this chain) out of dev/test/CI, where no OAuth2 client credentials are configured.
 * Enable in deployments via {@code SPRING_PROFILES_ACTIVE=...,social-login} together with the Google and
 * Apple client credentials.
 */
@Configuration
@Profile("social-login")
public class OAuth2LoginSecurityConfiguration {

    private static final String APPLE_REGISTRATION_ID = "apple";
    private static final String APPLE_AUDIENCE = "https://appleid.apple.com";

    private final String clientUrl;
    private final String appleTeamId;
    private final String appleKeyId;
    private final String appleClientId;
    private final String applePrivateKeyPem;

    public OAuth2LoginSecurityConfiguration(
        @Value("${aet.client.url}") String clientUrl,
        @Value("${aet.apple.team-id:}") String appleTeamId,
        @Value("${aet.apple.key-id:}") String appleKeyId,
        @Value("${aet.apple.client-id:}") String appleClientId,
        @Value("${aet.apple.private-key:}") String applePrivateKeyPem
    ) {
        this.clientUrl = clientUrl;
        this.appleTeamId = appleTeamId;
        this.appleKeyId = appleKeyId;
        this.appleClientId = appleClientId;
        this.applePrivateKeyPem = applePrivateKeyPem;
    }

    /**
     * Success handler that turns a completed Google/Apple sign-in into an app-issued cookie session.
     *
     * @param userService     provisions the local user from the verified provider identity
     * @param appTokenService mints the app access/refresh tokens
     * @return the configured success handler
     */
    @Bean
    public OAuth2LoginSuccessHandler oauth2LoginSuccessHandler(UserService userService, AppTokenService appTokenService) {
        return new OAuth2LoginSuccessHandler(userService, appTokenService, clientUrl);
    }

    /**
     * Stores the pending authorization request in a {@code SameSite=None}, HMAC-signed cookie so Apple's
     * cross-site {@code form_post} callback can recover it.
     *
     * @param hmacSecret server-side secret used to sign and verify the cookie
     * @return the cookie-based authorization request repository
     */
    @Bean
    public HttpCookieOAuth2AuthorizationRequestRepository authorizationRequestRepository(
        @Value("${security.otp.hmac-secret}") String hmacSecret
    ) {
        return new HttpCookieOAuth2AuthorizationRequestRepository(hmacSecret);
    }

    /**
     * Captures the name Apple returns only on first consent (as a {@code user} form field).
     *
     * @param objectMapper JSON mapper used to parse the payload
     * @return the Apple name-capturing filter
     */
    @Bean
    public AppleUserAttributesFilter appleUserAttributesFilter(ObjectMapper objectMapper) {
        return new AppleUserAttributesFilter(objectMapper);
    }

    /**
     * Adds {@code response_mode=form_post} to Apple authorization requests.
     *
     * @param clientRegistrationRepository the configured client registrations
     * @return the Apple-aware authorization request resolver
     */
    @Bean
    public AppleAuthorizationRequestResolver appleAuthorizationRequestResolver(ClientRegistrationRepository clientRegistrationRepository) {
        return new AppleAuthorizationRequestResolver(clientRegistrationRepository);
    }

    /**
     * Token-response client that authenticates Apple's token request with an ES256 {@code client_assertion}
     * (Apple requires {@code private_key_jwt} with {@code iss}=team id, {@code sub}=services id,
     * {@code aud=https://appleid.apple.com}). The converter is a no-op for providers (e.g. Google) that do not
     * use {@code private_key_jwt}.
     *
     * @return the access-token response client
     */
    @Bean
    public RestClientAuthorizationCodeTokenResponseClient accessTokenResponseClient() {
        RestClientAuthorizationCodeTokenResponseClient client = new RestClientAuthorizationCodeTokenResponseClient();
        client.addParametersConverter(appleClientAssertionConverter());
        return client;
    }

    private NimbusJwtClientAuthenticationParametersConverter<OAuth2AuthorizationCodeGrantRequest> appleClientAssertionConverter() {
        JWK appleJwk = appleSigningJwk();
        Function<ClientRegistration, JWK> jwkResolver = registration ->
            APPLE_REGISTRATION_ID.equals(registration.getRegistrationId()) ? appleJwk : null;

        NimbusJwtClientAuthenticationParametersConverter<OAuth2AuthorizationCodeGrantRequest> converter =
            new NimbusJwtClientAuthenticationParametersConverter<>(jwkResolver);
        converter.setJwtClientAssertionCustomizer(context -> {
            Instant now = Instant.now();
            context
                .getClaims()
                .issuer(appleTeamId)
                .subject(appleClientId)
                .audience(List.of(APPLE_AUDIENCE))
                .issuedAt(now)
                .expiresAt(now.plus(5, ChronoUnit.MINUTES));
        });
        return converter;
    }

    private JWK appleSigningJwk() {
        try {
            JWK parsed = JWK.parseFromPEMEncodedObjects(applePrivateKeyPem.replace("\\n", "\n"));
            return new ECKey.Builder((ECKey) parsed).keyID(appleKeyId).algorithm(JWSAlgorithm.ES256).build();
        } catch (Exception e) {
            throw new IllegalStateException("Invalid Apple sign-in private key (aet.apple.private-key)", e);
        }
    }

    /**
     * Higher-priority filter chain that handles only the OAuth2 login endpoints via redirect-based
     * {@code oauth2Login}, leaving the stateless resource-server chain to serve {@code /api/**}.
     *
     * @param http                          the HTTP security builder
     * @param oauth2LoginSuccessHandler     handler that issues the app session on success
     * @param authorizationRequestRepository cookie-based repository for the pending authorization request
     * @param appleAuthorizationRequestResolver resolver adding {@code form_post} for Apple
     * @param accessTokenResponseClient     token client with the Apple {@code client_assertion} converter
     * @param appleUserAttributesFilter     captures Apple's first-login name
     * @return the OAuth2 login security filter chain
     * @throws Exception if the chain cannot be built
     */
    @Bean
    @Order(1)
    public SecurityFilterChain oauth2LoginFilterChain(
        HttpSecurity http,
        OAuth2LoginSuccessHandler oauth2LoginSuccessHandler,
        HttpCookieOAuth2AuthorizationRequestRepository authorizationRequestRepository,
        AppleAuthorizationRequestResolver appleAuthorizationRequestResolver,
        RestClientAuthorizationCodeTokenResponseClient accessTokenResponseClient,
        AppleUserAttributesFilter appleUserAttributesFilter
    ) throws Exception {
        String redirectBase = clientUrl.endsWith("/") ? clientUrl.substring(0, clientUrl.length() - 1) : clientUrl;
        AuthenticationFailureHandler failureHandler = (request, response, exception) ->
            response.sendRedirect(redirectBase + "/?login_error=oauth");

        http
            // Only the redirect-based OAuth2 endpoints; the resource-server chain handles everything else.
            .securityMatcher("/oauth2/**", "/login/oauth2/**")
            // OAuth2 login relies on the `state` parameter for CSRF protection on these endpoints.
            .csrf(CsrfConfigurer::disable)
            .authorizeHttpRequests(requests -> requests.anyRequest().permitAll())
            // Apple posts the name as a `user` form field on first consent; capture it before authentication.
            .addFilterBefore(appleUserAttributesFilter, OAuth2LoginAuthenticationFilter.class)
            .oauth2Login(oauth ->
                oauth
                    .authorizationEndpoint(authorization ->
                        authorization
                            .authorizationRequestResolver(appleAuthorizationRequestResolver)
                            .authorizationRequestRepository(authorizationRequestRepository)
                    )
                    .tokenEndpoint(token -> token.accessTokenResponseClient(accessTokenResponseClient))
                    .successHandler(oauth2LoginSuccessHandler)
                    .failureHandler(failureHandler)
            );
        return http.build();
    }
}
