package de.tum.cit.aet.usermanagement.service;

import de.tum.cit.aet.core.exception.EmailVerificationFailedException;
import de.tum.cit.aet.core.service.AppTokenService;
import de.tum.cit.aet.core.util.CookieUtils;
import de.tum.cit.aet.core.util.StringUtil;
import de.tum.cit.aet.usermanagement.constants.OtpPurpose;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.dto.auth.AuthResponseDTO;
import de.tum.cit.aet.usermanagement.dto.auth.AuthSessionInfoDTO;
import de.tum.cit.aet.usermanagement.dto.auth.OtpCompleteDTO;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Service;

/**
 * Orchestrates the OTP completion flows (login and registration) using TUMApply's internal user
 * management. The OTP itself is verified by {@link EmailVerificationService}; this service then provisions
 * the local user and mints app-issued tokens via {@link AppTokenService} (no Keycloak involvement).
 */
@Service
public class OtpFlowService {

    private final UserService userService;
    private final AppTokenService appTokenService;
    private final EmailVerificationService emailVerificationService;

    public OtpFlowService(UserService userService, AppTokenService appTokenService, EmailVerificationService emailVerificationService) {
        this.userService = userService;
        this.appTokenService = appTokenService;
        this.emailVerificationService = emailVerificationService;
    }

    /**
     * Verifies the OTP, then executes the requested purpose and sets authentication cookies.
     *
     * @param body     the OTP completion request including email, code, purpose and optional profile
     * @param ip       client IP address used for audit and rate limiting
     * @param response the HTTP servlet response to which authentication cookies will be attached
     * @return an {@link AuthSessionInfoDTO} with token lifetimes
     * @throws EmailVerificationFailedException if OTP verification fails or the user cannot be validated
     */
    public AuthSessionInfoDTO otpComplete(OtpCompleteDTO body, String ip, HttpServletResponse response) {
        emailVerificationService.verifyCode(body, ip);

        OtpPurpose purpose = body.purpose();
        return switch (purpose) {
            case LOGIN -> handleLogin(body, response);
            case REGISTER -> handleRegister(body, response);
        };
    }

    /**
     * Handles the OTP completion flow for user login. The user must already exist; no new user is created.
     *
     * @param body     the OTP completion request
     * @param response the HTTP response to which authentication cookies will be added
     * @return an {@link AuthSessionInfoDTO} with token lifetimes
     * @throws EmailVerificationFailedException if the user is not found
     */
    private AuthSessionInfoDTO handleLogin(OtpCompleteDTO body, HttpServletResponse response) {
        User user = userService.findByEmail(body.email()).orElseThrow(EmailVerificationFailedException::new);
        return getTokens(user, response, false);
    }

    /**
     * Handles the OTP completion flow for user registration: provisions a verified local user (creating one
     * if needed), applies the optional profile name, and reports whether profile completion is still needed.
     *
     * @param body     the OTP completion request containing optional profile
     * @param response the HTTP response to which authentication cookies may be added
     * @return an {@link AuthSessionInfoDTO} with token lifetimes and a flag indicating if profile completion is needed
     */
    private AuthSessionInfoDTO handleRegister(OtpCompleteDTO body, HttpServletResponse response) {
        String firstName = body.profile() != null ? body.profile().firstName() : null;
        String lastName = body.profile() != null ? body.profile().lastName() : null;
        User user = userService.provisionExternalUser(body.email(), firstName, lastName);
        boolean profileRequired = StringUtil.isBlank(user.getFirstName()) || StringUtil.isBlank(user.getLastName());
        return getTokens(user, response, profileRequired);
    }

    /**
     * Mints app-issued tokens for the given user and sets authentication cookies in the response.
     *
     * @param user            the authenticated local user
     * @param response        the HTTP response to which cookies will be added
     * @param profileRequired whether the client should prompt for profile completion
     * @return an {@link AuthSessionInfoDTO} with token lifetimes
     */
    private AuthSessionInfoDTO getTokens(User user, HttpServletResponse response, boolean profileRequired) {
        AuthResponseDTO tokens = appTokenService.issueFor(user);
        CookieUtils.setAuthCookies(response, tokens);
        return new AuthSessionInfoDTO(tokens.expiresIn(), tokens.refreshExpiresIn(), profileRequired);
    }
}
