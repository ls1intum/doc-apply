package de.tum.cit.aet.core.config;

import de.tum.cit.aet.core.security.CustomJwtAuthenticationConverter;
import de.tum.cit.aet.core.security.SpaWebFilter;
import jakarta.servlet.http.Cookie;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.CsrfConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationEntryPoint;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.filter.CorsFilter;
import org.springframework.web.util.WebUtils;

@Configuration
@EnableMethodSecurity(securedEnabled = true)
public class SecurityConfiguration {

    private final CustomJwtAuthenticationConverter customJwtAuthenticationConverter;
    private final CorsFilter corsFilter;

    public SecurityConfiguration(CustomJwtAuthenticationConverter customJwtAuthenticationConverter, CorsFilter corsFilter) {
        this.customJwtAuthenticationConverter = customJwtAuthenticationConverter;
        this.corsFilter = corsFilter;
    }

    /**
     * Spring Security configuration.
     *
     * @param http the {@link HttpSecurity} to modify
     * @return the {@link SecurityFilterChain}
     * @throws Exception if an error occurs
     */
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // Disables CSRF (Cross-Site Request Forgery) protection; useful in stateless
            // APIs where the token management is unnecessary.
            .csrf(CsrfConfigurer::disable)
            // Adds a CORS (Cross-Origin Resource Sharing) filter before the
            // username/password authentication to handle cross-origin requests.
            .addFilterBefore(corsFilter, UsernamePasswordAuthenticationFilter.class)
            // Adds a custom filter for Single Page Applications (SPA), i.e. the client,
            // after the basic authentication filter.
            .addFilterAfter(new SpaWebFilter(), BasicAuthenticationFilter.class)
            // Configures security headers.
            .headers(headers ->
                headers
                    // Sets Content Security Policy (CSP) directives to prevent XSS attacks.
                    .contentSecurityPolicy(csp -> csp.policyDirectives("script-src 'self' 'unsafe-inline'"))
                    // Prevents the website from being framed, avoiding clickjacking attacks.
                    .frameOptions(HeadersConfigurer.FrameOptionsConfig::sameOrigin)
                    // Sets Referrer Policy to limit the amount of referrer information sent with requests.
                    .referrerPolicy(referrer -> referrer.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                    // Disables HTTP Strict Transport Security as it is managed at the reverse proxy
                    // level (typically nginx).
                    .httpStrictTransportSecurity((HeadersConfigurer.HstsConfig::disable))
                    // Defines Permissions Policy to restrict what features the browser is allowed
                    // to use.
                    .permissionsPolicyHeader(permissions ->
                        permissions.policy(
                            "camera=(), fullscreen=(*), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), sync-xhr=()"
                        )
                    )
            )
            // Configures sessions to be stateless; appropriate for REST APIs where no
            // session is required.
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // Configures authorization for various URL patterns. The patterns are
            // considered in order.
            .authorizeHttpRequests(requests ->
                requests
                    // NOTE: Always have a look at {@link
                    // de.tum.cit.aet.artemis.core.security.filter.SpaWebFilter} to see which URLs
                    // are forwarded to the SPA
                    // Client related URLs and publicly accessible information (allowed for
                    // everyone).
                    .requestMatchers("/", "/index.html", "/public/**")
                    .permitAll()
                    .requestMatchers("/*.js", "/*.css", "/*.map", "/*.json")
                    .permitAll()
                    .requestMatchers("/manifest.webapp", "/robots.txt")
                    .permitAll()
                    .requestMatchers("/googledd0b8a13f86d0918.html")
                    .permitAll()
                    .requestMatchers("/sitemap.xml")
                    .permitAll()
                    .requestMatchers("/assets/**")
                    .permitAll()
                    .requestMatchers("/content/**", "/i18n/*.json", "/logo/*")
                    .permitAll()
                    .requestMatchers("/media/**")
                    .permitAll()
                    .requestMatchers("/images/**")
                    .permitAll()
                    .requestMatchers("/favicon.ico")
                    .permitAll()
                    // Information and health endpoints do not need authentication
                    .requestMatchers("/management/info", "/management/health")
                    .permitAll()
                    // Admin area requires specific authority.
                    .requestMatchers("/api/*/admin/**")
                    .hasRole("ADMIN")
                    // Publicly accessible API endpoints (allowed for everyone).
                    .requestMatchers("/api/*/public/**")
                    .permitAll()
                    .requestMatchers("/api/public/config")
                    .permitAll()
                    .requestMatchers("/api/jobs/available", "/api/jobs/filters", "/api/jobs/available/**", "/api/jobs/detail/**")
                    .permitAll()
                    .requestMatchers("/api/auth/login")
                    .permitAll()
                    .requestMatchers("/api/auth/send-code")
                    .permitAll()
                    .requestMatchers("/api/auth/otp-complete")
                    .permitAll()
                    .requestMatchers("/api/auth/logout")
                    .permitAll()
                    .requestMatchers("/api/auth/refresh")
                    .permitAll()
                    .requestMatchers("/api/export/job/**")
                    .permitAll()
                    // External recommendation letter upload - token in the path is the only auth.
                    .requestMatchers("/api/reference-letters/**")
                    .permitAll()
                    // Public GET endpoints for schools
                    .requestMatchers(
                        org.springframework.http.HttpMethod.GET,
                        "/api/schools",
                        "/api/schools/with-departments",
                        "/api/schools/*"
                    )
                    .permitAll()
                    // Public GET endpoints for departments
                    .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/departments", "/api/departments/*")
                    .permitAll()
                    .requestMatchers("/api/**")
                    .authenticated()
                    .requestMatchers("/login/webauthn")
                    .permitAll()
                    // Websocket and other specific endpoints allowed without authentication.
                    .requestMatchers("/websocket/**")
                    .permitAll()
                    .requestMatchers("/.well-known/jwks.json")
                    .permitAll()
                    .requestMatchers("/.well-known/assetlinks.json")
                    .permitAll()
                    // Prometheus endpoint protected by IP address.
                    .requestMatchers("/management/prometheus/**")
                    .permitAll()
                    .requestMatchers(("/api-docs"))
                    .permitAll()
                    .requestMatchers(("/api-docs.yaml"))
                    .permitAll()
                    .requestMatchers("/swagger-ui/**")
                    .permitAll()
            )
            .oauth2ResourceServer(oauth2 ->
                oauth2
                    // Don't clear cookies on a 401: an expired access token stays recoverable via the refresh cookie.
                    .authenticationEntryPoint(new BearerTokenAuthenticationEntryPoint())
                    .bearerTokenResolver(bearerTokenResolver())
                    .jwt(jwt -> jwt.jwtAuthenticationConverter(customJwtAuthenticationConverter))
            );
        return http.build();
    }

    /**
     * Resolves the bearer token read-only: it returns the 'access_token' cookie value (app-issued applicant
     * sessions) and otherwise falls back to the Authorization header (TUM staff Keycloak tokens).
     *
     * It intentionally never refreshes here. Refresh-token rotation is single-use with replay detection, so
     * performing it during request resolution races the concurrent requests a page reload fires and trips
     * replay detection, revoking the whole session. Refreshing an expired app session is handled solely by
     * POST /api/auth/refresh.
     *
     * @return a read-only BearerTokenResolver
     */
    private BearerTokenResolver bearerTokenResolver() {
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
