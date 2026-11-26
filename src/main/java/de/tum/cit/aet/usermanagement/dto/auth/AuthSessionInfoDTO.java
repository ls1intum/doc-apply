package de.tum.cit.aet.usermanagement.dto.auth;

/**
 * Lightweight response: tokens are set as HttpOnly cookies and only lifetimes are returned in the body.
 * The accountExisted flag is only meaningful for an OTP registration and tells the client that the email
 * already belonged to an account, so the registration steps for a new account must be skipped.
 */
public record AuthSessionInfoDTO(
    long expiresIn,
    long refreshExpiresIn,
    boolean profileRequired,
    boolean authenticated,
    boolean accountExisted
) {
    public AuthSessionInfoDTO(long expiresIn, long refreshExpiresIn, boolean profileRequired, boolean accountExisted) {
        this(expiresIn, refreshExpiresIn, profileRequired, true, accountExisted);
    }

    public AuthSessionInfoDTO(long expiresIn, long refreshExpiresIn) {
        this(expiresIn, refreshExpiresIn, false, true, true);
    }

    public static AuthSessionInfoDTO unauthenticated() {
        return new AuthSessionInfoDTO(0, 0, false, false, false);
    }
}
