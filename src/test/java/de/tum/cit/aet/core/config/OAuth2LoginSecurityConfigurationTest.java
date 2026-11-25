package de.tum.cit.aet.core.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.ECKey;
import com.nimbusds.jose.jwk.JWK;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class OAuth2LoginSecurityConfigurationTest {

    private static final String KEY_ID = "ABC123DEFG";

    private static OAuth2LoginSecurityConfiguration configuration(String privateKeyPem) {
        return new OAuth2LoginSecurityConfiguration("http://localhost:4200", "TEAM123456", KEY_ID, "de.tum.docapply", privateKeyPem);
    }

    private static KeyPair generateKeyPair() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        return generator.generateKeyPair();
    }

    private static String toPrivateKeyPem(KeyPair keyPair) {
        String base64 = Base64.getMimeEncoder(64, "\n".getBytes()).encodeToString(keyPair.getPrivate().getEncoded());
        return "-----BEGIN PRIVATE KEY-----\n" + base64 + "\n-----END PRIVATE KEY-----";
    }

    @Test
    void shouldDeriveTheMatchingPublicKeyFromApplesPrivateKeyFile() throws Exception {
        KeyPair keyPair = generateKeyPair();

        JWK actual = configuration(toPrivateKeyPem(keyPair)).appleSigningJwk();

        ECKey actualKey = actual.toECKey();
        assertThat(actualKey.isPrivate()).isTrue();
        assertThat(actualKey.toECPublicKey().getW()).isEqualTo(((ECPublicKey) keyPair.getPublic()).getW());
        assertThat(actualKey.getKeyID()).isEqualTo(KEY_ID);
        assertThat(actualKey.getAlgorithm()).isEqualTo(JWSAlgorithm.ES256);
    }

    @Test
    void shouldAcceptAPrivateKeyWithEscapedLineBreaksFromAnEnvironmentVariable() throws Exception {
        KeyPair keyPair = generateKeyPair();

        JWK actual = configuration(toPrivateKeyPem(keyPair).replace("\n", "\\n")).appleSigningJwk();

        assertThat(actual.toECKey().toECPublicKey().getW()).isEqualTo(((ECPublicKey) keyPair.getPublic()).getW());
    }

    @Test
    void shouldThrowWhenThePrivateKeyIsInvalid() {
        assertThatThrownBy(() -> configuration("not a key").appleSigningJwk())
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("aet.apple.private-key");
    }
}
