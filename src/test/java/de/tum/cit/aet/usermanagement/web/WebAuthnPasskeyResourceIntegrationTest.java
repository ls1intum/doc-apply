package de.tum.cit.aet.usermanagement.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.zaxxer.hikari.HikariDataSource;
import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.usermanagement.dto.auth.PasskeyDTO;
import de.tum.cit.aet.utility.MvcTestClient;
import de.tum.cit.aet.utility.security.JwtPostProcessors;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.web.webauthn.api.Bytes;
import org.springframework.security.web.webauthn.api.CredentialRecord;
import org.springframework.security.web.webauthn.api.ImmutableCredentialRecord;
import org.springframework.security.web.webauthn.api.ImmutablePublicKeyCose;
import org.springframework.security.web.webauthn.api.ImmutablePublicKeyCredentialUserEntity;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialType;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialUserEntity;
import org.springframework.security.web.webauthn.management.PublicKeyCredentialUserEntityRepository;
import org.springframework.security.web.webauthn.management.UserCredentialRepository;
import org.springframework.test.context.TestPropertySource;
import tools.jackson.core.type.TypeReference;

/**
 * Integration tests for {@link WebAuthnPasskeyResource} that exercise the real WebAuthn repository beans
 * against the database.
 *
 * The connection pool is pinned to the production setting auto-commit=false, under which the pool discards
 * any work a connection did not commit before it was returned. The repository beans are invoked directly,
 * outside any Spring-managed transaction, exactly as Spring Security's ceremony filters invoke them —
 * so these tests fail unless the repositories commit their writes themselves.
 */
@TestPropertySource(properties = "spring.datasource.hikari.auto-commit=false")
class WebAuthnPasskeyResourceIntegrationTest extends AbstractResourceTest {

    private static final String PASSKEYS_PATH = "/api/auth/webauthn/passkeys";

    @Autowired
    MvcTestClient api;

    @Autowired
    UserCredentialRepository userCredentialRepository;

    @Autowired
    PublicKeyCredentialUserEntityRepository userEntityRepository;

    @Autowired
    DataSource dataSource;

    private UUID userId;
    private Bytes userHandle;

    @BeforeEach
    void setUp() throws Exception {
        // These tests only guard the fix while the pool discards uncommitted work; if the property pin
        // is ever lost, driver auto-commit would make them pass without exercising anything.
        assertThat(dataSource.unwrap(HikariDataSource.class).isAutoCommit()).isFalse();
        api.withoutPostProcessors();
        userId = UUID.randomUUID();
        userHandle = Bytes.random();
    }

    /**
     * Saves a WebAuthn user entity and one credential for {@link #userId}, as the registration ceremony does.
     *
     * @param label user-visible label for the credential
     * @return the saved credential
     */
    private CredentialRecord registerPasskey(String label) {
        PublicKeyCredentialUserEntity userEntity = ImmutablePublicKeyCredentialUserEntity.builder()
            .id(userHandle)
            .name(userId.toString())
            .displayName("Applicant")
            .build();
        userEntityRepository.save(userEntity);

        CredentialRecord credential = ImmutableCredentialRecord.builder()
            .credentialType(PublicKeyCredentialType.PUBLIC_KEY)
            .credentialId(Bytes.random())
            .userEntityUserId(userHandle)
            .publicKey(new ImmutablePublicKeyCose(new byte[] { 1, 2, 3 }))
            .label(label)
            .build();
        userCredentialRepository.save(credential);
        return credential;
    }

    private List<PasskeyDTO> listPasskeys() {
        return api
            .with(JwtPostProcessors.jwtUser(userId, "ROLE_APPLICANT"))
            .getAndRead(PASSKEYS_PATH, Map.of(), new TypeReference<List<PasskeyDTO>>() {}, 200);
    }

    @Test
    void shouldListPasskeySavedOutsideTransaction() {
        CredentialRecord credential = registerPasskey("MacBook");

        List<PasskeyDTO> passkeys = listPasskeys();

        assertThat(passkeys).hasSize(1);
        assertThat(passkeys.getFirst().id()).isEqualTo(credential.getCredentialId().toBase64UrlString());
        assertThat(passkeys.getFirst().label()).isEqualTo("MacBook");
    }

    @Test
    void shouldDeletePasskeyPersistently() {
        CredentialRecord credential = registerPasskey("Old phone");

        api
            .with(JwtPostProcessors.jwtUser(userId, "ROLE_APPLICANT"))
            .deleteAndRead(PASSKEYS_PATH + "/" + credential.getCredentialId().toBase64UrlString(), null, Void.class, 204);

        assertThat(listPasskeys()).isEmpty();
    }
}
