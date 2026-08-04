package de.tum.cit.aet.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.KeyUse;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import de.tum.cit.aet.core.dto.AppTokenProperties;
import de.tum.cit.aet.core.exception.UnauthorizedException;
import de.tum.cit.aet.usermanagement.domain.AppRefreshToken;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.dto.auth.AuthResponseDTO;
import de.tum.cit.aet.usermanagement.repository.AppRefreshTokenRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

@ExtendWith(MockitoExtension.class)
class AppTokenServiceTest {

    private static final String ISSUER = "https://docapply.test";
    private static final String KID = "docapply-test";

    @Mock
    private AppRefreshTokenRepository refreshTokenRepository;

    @Mock
    private UserRepository userRepository;

    private JwtDecoder decoder;
    private JwtDecoder accessOnlyDecoder;
    private AppTokenService service;

    @BeforeEach
    void setUp() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair keyPair = generator.generateKeyPair();
        RSAPublicKey publicKey = (RSAPublicKey) keyPair.getPublic();
        RSAPrivateKey privateKey = (RSAPrivateKey) keyPair.getPrivate();

        RSAKey rsaKey = new RSAKey.Builder(publicKey)
            .privateKey(privateKey)
            .keyID(KID)
            .keyUse(KeyUse.SIGNATURE)
            .algorithm(JWSAlgorithm.RS256)
            .build();
        JWKSource<SecurityContext> jwkSource = new ImmutableJWKSet<>(new JWKSet(rsaKey));

        NimbusJwtDecoder nimbusDecoder = NimbusJwtDecoder.withPublicKey(publicKey).signatureAlgorithm(SignatureAlgorithm.RS256).build();
        nimbusDecoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(ISSUER));
        this.decoder = nimbusDecoder;

        // Mirrors the resource-server decoder (appJwtDecoder): issuer + timestamps + typ=access.
        NimbusJwtDecoder accessDecoder = NimbusJwtDecoder.withPublicKey(publicKey).signatureAlgorithm(SignatureAlgorithm.RS256).build();
        accessDecoder.setJwtValidator(
            new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer(ISSUER), jwt ->
                "access".equals(jwt.getClaimAsString("typ"))
                    ? OAuth2TokenValidatorResult.success()
                    : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Expected typ=access", null))
            )
        );
        this.accessOnlyDecoder = accessDecoder;

        this.service = new AppTokenService(
            new NimbusJwtEncoder(jwkSource),
            nimbusDecoder,
            refreshTokenRepository,
            userRepository,
            noOpTransactionManager(),
            new AppTokenProperties(ISSUER, KID, "docapply-internal", 300, 2_592_000)
        );
    }

    /** No-op transaction manager so {@code TransactionTemplate} simply runs the callback inline in unit tests. */
    private static PlatformTransactionManager noOpTransactionManager() {
        return new PlatformTransactionManager() {
            @Override
            public TransactionStatus getTransaction(TransactionDefinition definition) {
                return new SimpleTransactionStatus();
            }

            @Override
            public void commit(TransactionStatus status) {
                // no-op
            }

            @Override
            public void rollback(TransactionStatus status) {
                // no-op
            }
        };
    }

    private static User user(UUID id) {
        User user = new User();
        user.setUserId(id);
        user.setEmail("applicant@example.org");
        user.setFirstName("Ada");
        user.setLastName("Lovelace");
        return user;
    }

    @Nested
    class IssueFor {

        @Test
        void shouldMintAccessTokenWithExpectedClaims() {
            UUID id = UUID.randomUUID();

            AuthResponseDTO tokens = service.issueFor(user(id));

            Jwt access = decoder.decode(tokens.accessToken());
            assertThat(access.getSubject()).isEqualTo(id.toString());
            assertThat(access.getClaimAsString("email")).isEqualTo("applicant@example.org");
            assertThat(access.getClaimAsString("given_name")).isEqualTo("Ada");
            assertThat(access.getClaimAsString("family_name")).isEqualTo("Lovelace");
            assertThat(access.getClaimAsString("typ")).isEqualTo("access");
            assertThat(access.getClaimAsString("azp")).isEqualTo("docapply-internal");
            assertThat(tokens.expiresIn()).isEqualTo(300);
            assertThat(tokens.refreshExpiresIn()).isEqualTo(2_592_000);
            // The refresh token id must be persisted so it can later be revoked.
            verify(refreshTokenRepository).save(any(AppRefreshToken.class));
        }
    }

    @Nested
    class Refresh {

        @Test
        void shouldRotateTokenAndRevokePreviousWhenRefreshTokenIsValid() {
            UUID id = UUID.randomUUID();
            User user = user(id);
            AuthResponseDTO issued = service.issueFor(user);
            String refreshJti = decoder.decode(issued.refreshToken()).getId();

            AppRefreshToken record = new AppRefreshToken();
            record.setJti(refreshJti);
            record.setUserId(id);
            record.setExpiresAt(Instant.now().plusSeconds(1000));
            record.setRevoked(false);
            when(refreshTokenRepository.findById(refreshJti)).thenReturn(Optional.of(record));
            when(refreshTokenRepository.revokeIfActive(refreshJti)).thenReturn(1);
            when(userRepository.findById(id)).thenReturn(Optional.of(user));

            AuthResponseDTO refreshed = service.refresh(issued.refreshToken());

            assertThat(decoder.decode(refreshed.accessToken()).getSubject()).isEqualTo(id.toString());
            verify(refreshTokenRepository).revokeIfActive(refreshJti);
            verify(refreshTokenRepository, never()).revokeAllForUser(any());
        }

        @Test
        void shouldRevokeAllWhenRefreshingARevokedToken() {
            UUID id = UUID.randomUUID();
            AuthResponseDTO issued = service.issueFor(user(id));
            String refreshJti = decoder.decode(issued.refreshToken()).getId();

            AppRefreshToken record = new AppRefreshToken();
            record.setJti(refreshJti);
            record.setUserId(id);
            record.setExpiresAt(Instant.now().plusSeconds(1000));
            record.setRevoked(true);
            when(refreshTokenRepository.findById(refreshJti)).thenReturn(Optional.of(record));

            assertThatThrownBy(() -> service.refresh(issued.refreshToken())).isInstanceOf(UnauthorizedException.class);
            verify(refreshTokenRepository).revokeAllForUser(id);
        }

        @Test
        void shouldRejectWhenRefreshTokenIsUnknown() {
            UUID id = UUID.randomUUID();
            AuthResponseDTO issued = service.issueFor(user(id));
            when(refreshTokenRepository.findById(any())).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.refresh(issued.refreshToken())).isInstanceOf(UnauthorizedException.class);
        }

        @Test
        void shouldRevokeAllWhenTheAtomicClaimIsLost() {
            UUID id = UUID.randomUUID();
            AuthResponseDTO issued = service.issueFor(user(id));
            String refreshJti = decoder.decode(issued.refreshToken()).getId();

            AppRefreshToken record = new AppRefreshToken();
            record.setJti(refreshJti);
            record.setUserId(id);
            record.setExpiresAt(Instant.now().plusSeconds(1000));
            record.setRevoked(false);
            when(refreshTokenRepository.findById(refreshJti)).thenReturn(Optional.of(record));
            // Another request claimed the token first: the atomic UPDATE affects 0 rows.
            when(refreshTokenRepository.revokeIfActive(refreshJti)).thenReturn(0);

            assertThatThrownBy(() -> service.refresh(issued.refreshToken())).isInstanceOf(UnauthorizedException.class);
            verify(refreshTokenRepository).revokeAllForUser(id);
        }

        @Test
        void shouldReturnTheSameSuccessorWhenTheSameTokenIsRefreshedTwiceWithinGrace() {
            UUID id = UUID.randomUUID();
            User user = user(id);
            AuthResponseDTO issued = service.issueFor(user);
            String refreshJti = decoder.decode(issued.refreshToken()).getId();

            AppRefreshToken record = new AppRefreshToken();
            record.setJti(refreshJti);
            record.setUserId(id);
            record.setExpiresAt(Instant.now().plusSeconds(1000));
            record.setRevoked(false);
            when(refreshTokenRepository.findById(refreshJti)).thenReturn(Optional.of(record));
            when(refreshTokenRepository.revokeIfActive(refreshJti)).thenReturn(1);
            when(userRepository.findById(id)).thenReturn(Optional.of(user));

            AuthResponseDTO first = service.refresh(issued.refreshToken());
            AuthResponseDTO second = service.refresh(issued.refreshToken());

            // The second use of the same token returns the cached successor, so it never reaches replay detection.
            assertThat(second).isSameAs(first);
            verify(refreshTokenRepository).revokeIfActive(refreshJti);
            verify(refreshTokenRepository, never()).revokeAllForUser(any());
        }
    }

    @Nested
    class TokenTypeSeparation {

        @Test
        void shouldRejectRefreshTokenAtTheResourceServerDecoder() {
            AuthResponseDTO tokens = service.issueFor(user(UUID.randomUUID()));

            // The resource-server (typ=access) decoder accepts the access token...
            assertThat(accessOnlyDecoder.decode(tokens.accessToken()).getSubject()).isNotBlank();
            // ...but rejects the refresh token, so it can never be replayed as a bearer credential.
            assertThatThrownBy(() -> accessOnlyDecoder.decode(tokens.refreshToken())).isInstanceOf(JwtException.class);
        }

        @Test
        void shouldRejectAccessTokenOnTheRefreshPath() {
            AuthResponseDTO issued = service.issueFor(user(UUID.randomUUID()));

            // The access token has typ=access; the refresh path must reject it.
            assertThatThrownBy(() -> service.refresh(issued.accessToken())).isInstanceOf(UnauthorizedException.class);
        }
    }
}
