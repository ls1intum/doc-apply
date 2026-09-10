package de.tum.cit.aet.core.config;

import de.tum.cit.aet.core.security.CustomJwtAuthenticationConverter;
import de.tum.cit.aet.core.security.SpaWebFilter;
import de.tum.cit.aet.core.security.UnrecoverableTokenCookieClearingEntryPoint;
import jakarta.servlet.http.Cookie;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.CsrfConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
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
     * CSRF protection is off because the API is stateless and authenticated per request by a token rather
     * than by an ambient session cookie. HTTP Strict Transport Security is off because the reverse proxy,
     * typically nginx, sets that header itself.
     *
     * The authorization rules are evaluated in the order they are declared. Two of the endpoints opened
     * there are not actually public and are guarded elsewhere: a reference letter authenticates by the
     * token in its own path, and the Prometheus endpoint is restricted by IP address. Which URLs reach
     * the client rather than a controller is decided by {@link SpaWebFilter}, worth reading alongside
     * these rules.
     *
     * @param http the {@link HttpSecurity} to modify
     * @return the {@link SecurityFilterChain}
     * @throws Exception if an error occurs
     */
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(CsrfConfigurer::disable)
            .addFilterBefore(corsFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(new SpaWebFilter(), BasicAuthenticationFilter.class)
            .headers(headers ->
                headers
                    .contentSecurityPolicy(csp -> csp.policyDirectives("script-src 'self' 'unsafe-inline'"))
                    .frameOptions(HeadersConfigurer.FrameOptionsConfig::sameOrigin)
                    .referrerPolicy(referrer -> referrer.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                    .httpStrictTransportSecurity((HeadersConfigurer.HstsConfig::disable))
                    .permissionsPolicyHeader(permissions ->
                        permissions.policy(
                            "camera=(), fullscreen=(*), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), sync-xhr=()"
                        )
                    )
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(requests ->
                requests
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
                    .requestMatchers("/management/info", "/management/health")
                    .permitAll()
                    .requestMatchers("/api/*/admin/**")
                    .hasRole("ADMIN")
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
                    .requestMatchers("/api/reference-letters/**")
                    .permitAll()
                    .requestMatchers(
                        org.springframework.http.HttpMethod.GET,
                        "/api/schools",
                        "/api/schools/with-departments",
                        "/api/schools/*"
                    )
                    .permitAll()
                    .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/departments", "/api/departments/*")
                    .permitAll()
                    .requestMatchers("/api/**")
                    .authenticated()
                    .requestMatchers("/login/webauthn")
                    .permitAll()
                    .requestMatchers("/websocket/**")
                    .permitAll()
                    .requestMatchers("/.well-known/jwks.json")
                    .permitAll()
                    .requestMatchers("/.well-known/assetlinks.json")
                    .permitAll()
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
                    .authenticationEntryPoint(new UnrecoverableTokenCookieClearingEntryPoint())
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
