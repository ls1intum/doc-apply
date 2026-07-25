package de.tum.cit.aet.usermanagement.dto.auth;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.keycloak.representations.idm.CredentialRepresentation;
import org.springframework.security.web.webauthn.api.CredentialRecord;

/**
 * Public projection of a Keycloak passkey credential exposed to the client.
 *
 * @param id           Keycloak credential identifier
 * @param label        user-defined label for the credential, if any
 * @param createdDate  creation timestamp in milliseconds since epoch, if known
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record PasskeyDTO(String id, String label, Long createdDate) {
    /**
     * Builds a {@link PasskeyDTO} from a Keycloak {@link CredentialRepresentation}.
     *
     * @param credential the Keycloak credential to project
     * @return DTO containing only the fields the client needs
     */
    public static PasskeyDTO of(CredentialRepresentation credential) {
        return new PasskeyDTO(credential.getId(), credential.getUserLabel(), credential.getCreatedDate());
    }

    /**
     * Builds a {@link PasskeyDTO} from an in-app WebAuthn {@link CredentialRecord}.
     *
     * @param credential the stored WebAuthn credential to project
     * @return DTO containing only the fields the client needs
     */
    public static PasskeyDTO of(CredentialRecord credential) {
        Long created = credential.getCreated() != null ? credential.getCreated().toEpochMilli() : null;
        return new PasskeyDTO(credential.getCredentialId().toBase64UrlString(), credential.getLabel(), created);
    }
}
