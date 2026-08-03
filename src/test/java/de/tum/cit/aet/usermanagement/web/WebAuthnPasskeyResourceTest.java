package de.tum.cit.aet.usermanagement.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.tum.cit.aet.usermanagement.dto.auth.PasskeyDTO;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.web.webauthn.api.Bytes;
import org.springframework.security.web.webauthn.api.CredentialRecord;
import org.springframework.security.web.webauthn.api.ImmutablePublicKeyCredentialUserEntity;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialUserEntity;
import org.springframework.security.web.webauthn.management.PublicKeyCredentialUserEntityRepository;
import org.springframework.security.web.webauthn.management.UserCredentialRepository;

@ExtendWith(MockitoExtension.class)
class WebAuthnPasskeyResourceTest {

    @Mock
    private UserCredentialRepository userCredentialRepository;

    @Mock
    private PublicKeyCredentialUserEntityRepository userEntityRepository;

    private WebAuthnPasskeyResource resource;
    private Jwt jwt;
    private final Bytes userHandle = new Bytes("user-handle".getBytes());

    @BeforeEach
    void setUp() {
        resource = new WebAuthnPasskeyResource(userCredentialRepository, userEntityRepository);
        jwt = Jwt.withTokenValue("token").header("alg", "none").subject("00000000-0000-0000-0000-000000000001").build();
    }

    /** A real WebAuthn user entity whose handle is {@link #userHandle}. */
    private PublicKeyCredentialUserEntity userEntity() {
        return ImmutablePublicKeyCredentialUserEntity.builder().id(userHandle).name("applicant").displayName("Applicant").build();
    }

    @Nested
    class ListPasskeys {

        @Test
        void shouldReturnMappedPasskeysWhenUserHasCredentials() {
            Bytes credentialId = new Bytes(new byte[] { 1, 2, 3 });
            CredentialRecord record = mock(CredentialRecord.class);
            when(record.getCredentialId()).thenReturn(credentialId);
            when(record.getLabel()).thenReturn("MacBook");
            when(record.getCreated()).thenReturn(Instant.ofEpochMilli(1_710_000_000_000L));
            when(userEntityRepository.findByUsername(jwt.getSubject())).thenReturn(userEntity());
            when(userCredentialRepository.findByUserId(userHandle)).thenReturn(List.of(record));

            List<PasskeyDTO> result = resource.listPasskeys(jwt);

            assertThat(result).hasSize(1);
            assertThat(result.getFirst().id()).isEqualTo(credentialId.toBase64UrlString());
            assertThat(result.getFirst().label()).isEqualTo("MacBook");
            assertThat(result.getFirst().createdDate()).isEqualTo(1_710_000_000_000L);
        }

        @Test
        void shouldReturnEmptyWhenUserHasNoWebAuthnEntity() {
            when(userEntityRepository.findByUsername(jwt.getSubject())).thenReturn(null);

            assertThat(resource.listPasskeys(jwt)).isEmpty();
        }
    }

    @Nested
    class RemovePasskey {

        @Test
        void shouldReturnNotFoundWhenCredentialIdIsMalformed() {
            when(userEntityRepository.findByUsername(jwt.getSubject())).thenReturn(userEntity());

            ResponseEntity<Void> response = resource.removePasskey(jwt, "not-valid-base64!!");

            assertThat(response.getStatusCode().value()).isEqualTo(404);
            verify(userCredentialRepository, never()).delete(any());
        }

        @Test
        void shouldReturnNotFoundWhenCredentialOwnedByAnotherUser() {
            Bytes credentialId = new Bytes(new byte[] { 9 });
            CredentialRecord otherUsersCredential = mock(CredentialRecord.class);
            when(otherUsersCredential.getUserEntityUserId()).thenReturn(new Bytes("someone-else".getBytes()));
            when(userEntityRepository.findByUsername(jwt.getSubject())).thenReturn(userEntity());
            when(userCredentialRepository.findByCredentialId(credentialId)).thenReturn(otherUsersCredential);

            ResponseEntity<Void> response = resource.removePasskey(jwt, credentialId.toBase64UrlString());

            assertThat(response.getStatusCode().value()).isEqualTo(404);
            verify(userCredentialRepository, never()).delete(any());
        }

        @Test
        void shouldDeleteWhenCredentialOwnedByCurrentUser() {
            Bytes credentialId = new Bytes(new byte[] { 7 });
            CredentialRecord ownCredential = mock(CredentialRecord.class);
            when(ownCredential.getUserEntityUserId()).thenReturn(userHandle);
            when(userEntityRepository.findByUsername(jwt.getSubject())).thenReturn(userEntity());
            when(userCredentialRepository.findByCredentialId(credentialId)).thenReturn(ownCredential);

            ResponseEntity<Void> response = resource.removePasskey(jwt, credentialId.toBase64UrlString());

            assertThat(response.getStatusCode().value()).isEqualTo(204);
            verify(userCredentialRepository).delete(credentialId);
        }
    }
}
