package de.tum.cit.aet.core.dto;

/**
 * Scalar configuration for app-issued JWTs, grouped into one value object so {@code AppTokenService} can
 * depend on a single parameter instead of a long list of individual {@code @Value} arguments.
 * <p>
 * Lives in the {@code dto} layer (rather than {@code config}) because the architecture forbids other layers
 * from depending on {@code ..config..}; the value is produced by a {@code @Bean} factory in the config layer.
 *
 * @param issuer            issuer URI embedded in app tokens and trusted by the resource server
 * @param kid               key id placed in the JWT header (enables future key rotation)
 * @param azp               authorized-party claim identifying the TUMApply client
 * @param accessTtlSeconds  access-token lifetime in seconds
 * @param refreshTtlSeconds refresh-token lifetime in seconds
 */
public record AppTokenProperties(String issuer, String kid, String azp, long accessTtlSeconds, long refreshTtlSeconds) {}
