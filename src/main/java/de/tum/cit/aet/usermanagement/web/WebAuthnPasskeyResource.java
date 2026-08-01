package de.tum.cit.aet.usermanagement.web;

import de.tum.cit.aet.core.security.annotations.Authenticated;
import de.tum.cit.aet.usermanagement.dto.auth.PasskeyDTO;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.web.webauthn.api.Bytes;
import org.springframework.security.web.webauthn.api.CredentialRecord;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialUserEntity;
import org.springframework.security.web.webauthn.management.PublicKeyCredentialUserEntityRepository;
import org.springframework.security.web.webauthn.management.UserCredentialRepository;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lists and deletes the current applicant's in-app WebAuthn passkeys. Registration and authentication use
 * Spring Security's built-in ceremony endpoints ({@code /webauthn/register*}, {@code /webauthn/authenticate/options},
 * {@code /login/webauthn}); these endpoints cover the management UI. TUM staff passkeys remain in Keycloak and
 * are served by {@link AuthenticationResource}.
 */
@Slf4j
@RestController
@RequestMapping("/api/auth/webauthn/passkeys")
@AllArgsConstructor
public class WebAuthnPasskeyResource {

    private final UserCredentialRepository userCredentialRepository;
    private final PublicKeyCredentialUserEntityRepository userEntityRepository;

    /**
     * Lists the current user's registered passkeys.
     *
     * @param jwt the authenticated user's token (subject is the local user id)
     * @return the user's passkeys, or an empty list if none are registered
     */
    @Authenticated
    @GetMapping
    public List<PasskeyDTO> listPasskeys(@AuthenticationPrincipal Jwt jwt) {
        log.info("GET /api/auth/webauthn/passkeys - Listing passkeys for subject={}", jwt.getSubject());
        PublicKeyCredentialUserEntity userEntity = userEntityRepository.findByUsername(jwt.getSubject());
        if (userEntity == null) {
            return List.of();
        }
        return userCredentialRepository.findByUserId(userEntity.getId()).stream().map(PasskeyDTO::of).toList();
    }

    /**
     * Deletes one of the current user's passkeys. Only credentials owned by the caller can be removed.
     *
     * @param jwt          the authenticated user's token
     * @param credentialId base64url credential id to remove
     * @return 204 if removed, 404 if it does not exist or is not owned by the caller
     */
    @Authenticated
    @DeleteMapping("/{credentialId}")
    public ResponseEntity<Void> removePasskey(@AuthenticationPrincipal Jwt jwt, @PathVariable String credentialId) {
        log.info("DELETE /api/auth/webauthn/passkeys/{} - Removing passkey for subject={}", credentialId, jwt.getSubject());
        PublicKeyCredentialUserEntity userEntity = userEntityRepository.findByUsername(jwt.getSubject());
        if (userEntity == null) {
            return ResponseEntity.notFound().build();
        }
        Bytes id;
        try {
            id = Bytes.fromBase64(credentialId);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.notFound().build();
        }
        CredentialRecord credential = userCredentialRepository.findByCredentialId(id);
        if (credential == null || !credential.getUserEntityUserId().equals(userEntity.getId())) {
            return ResponseEntity.notFound().build();
        }
        userCredentialRepository.delete(id);
        return ResponseEntity.noContent().build();
    }
}
