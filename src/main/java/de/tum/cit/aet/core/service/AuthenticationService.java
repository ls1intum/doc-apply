package de.tum.cit.aet.core.service;

import de.tum.cit.aet.core.util.CookieUtils;
import de.tum.cit.aet.usermanagement.domain.DeletedUser;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.repository.DeletedUserRepository;
import de.tum.cit.aet.usermanagement.service.UserService;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Service
public class AuthenticationService {

    private final UserService userService;
    private final DeletedUserRepository deletedUserRepository;

    public AuthenticationService(UserService userService, DeletedUserRepository deletedUserRepository) {
        this.userService = userService;
        this.deletedUserRepository = deletedUserRepository;
    }

    /**
     * Provisions a user from the JWT claims and assigns the default APPLICANT role if missing.
     * If the user already exists, basic fields are updated. Returns the managed entity.
     *
     * A deleted account is not provisioned again from a token that predates its deletion, since
     * that token outlives the row and would otherwise recreate it on the very next request. Signing
     * in again is a different matter and is allowed: the fresh token clears the deletion marker.
     *
     * Refusing such a token also expires the session cookies on the current response, since the
     * browser would otherwise present them forever and be refused every time, including on the
     * endpoint that would have cleared them.
     *
     * @param jwt The decoded JWT token.
     * @return the existing or newly created {@link User} entity
     * @throws InvalidBearerTokenException if the account was deleted after this token was issued
     */
    @Transactional
    public User provisionUserIfMissing(Jwt jwt) {
        // 1) Refuse a token that was already in the user's hands when their account was deleted.
        UUID userId = UUID.fromString(jwt.getSubject());
        Optional<DeletedUser> tombstone = deletedUserRepository.findById(userId);
        if (tombstone.isPresent()) {
            if (!isIssuedAfterDeletion(jwt, tombstone.get())) {
                // Applicant sessions live in httpOnly cookies the browser keeps sending, and this
                // refusal happens before authorization, so even the public logout endpoint is turned
                // away. Clearing them here is what lets the browser reach the site again.
                clearSessionCookies();
                throw new InvalidBearerTokenException("The account behind this token was deleted.");
            }
            // 2) A newer token means the person signed in again, so let the account come back.
            deletedUserRepository.delete(tombstone.get());
        }

        // 3) Provision from the token's claims as usual.
        String email = jwt.getClaimAsString("email");
        String givenName = jwt.getClaimAsString("given_name");
        String familyName = jwt.getClaimAsString("family_name");
        return userService.upsertUser(jwt.getSubject(), email, givenName, familyName);
    }

    /**
     * Expires the cookies carrying an applicant session, so the next request arrives without one.
     */
    private void clearSessionCookies() {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        HttpServletResponse response = attributes == null ? null : attributes.getResponse();
        if (response != null) {
            CookieUtils.setAuthCookies(response, null);
        }
    }

    /**
     * Whether the token was issued after the account was deleted, which marks it as a fresh sign-in
     * rather than one left over from before. A token without an issued-at claim cannot be placed on
     * either side of the deletion, so it counts as the older one.
     *
     * @param jwt       the token presented with the request
     * @param tombstone the record of when the account was deleted
     * @return true when the token is newer than the deletion
     */
    private boolean isIssuedAfterDeletion(Jwt jwt, DeletedUser tombstone) {
        Instant issuedAt = jwt.getIssuedAt();
        return issuedAt != null && issuedAt.isAfter(tombstone.getDeletedAt().toInstant(ZoneOffset.UTC));
    }
}
