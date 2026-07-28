package de.tum.cit.aet.usermanagement.service;

import de.tum.cit.aet.core.exception.EmailVerificationFailedException;
import de.tum.cit.aet.core.security.otp.OtpUtil;
import de.tum.cit.aet.core.service.SiteSettingService;
import de.tum.cit.aet.core.util.StringUtil;
import de.tum.cit.aet.notification.service.AsyncEmailSender;
import de.tum.cit.aet.notification.service.mail.Email;
import de.tum.cit.aet.usermanagement.domain.EmailVerificationOtp;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.dto.auth.OtpCompleteDTO;
import de.tum.cit.aet.usermanagement.repository.EmailVerificationOtpRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * This service is responsible for generating, sending, and verifying OTP codes sent to users' email addresses as well as sending registration confirmation emails.
 */
@Service
public class EmailVerificationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(EmailVerificationService.class);

    private final EmailVerificationOtpRepository emailVerificationOtpRepository;
    private final AsyncEmailSender asyncEmailSender;
    private final UserRepository userRepository;
    private final SiteSettingService siteSettingService;

    @Value("${security.otp.length}")
    private int otpLength;

    @Value("${security.otp.ttl-seconds}")
    private long otpTtlSeconds;

    @Value("${security.otp.max-attempts}")
    private int otpMaxAttempts;

    @Value("${security.otp.resend-cooldown-seconds}")
    private long otpResendCooldownSeconds;

    @Value("${security.otp.hmac-secret}")
    private String otpHmacSecret;

    public EmailVerificationService(
        EmailVerificationOtpRepository emailVerificationOtpRepository,
        AsyncEmailSender asyncEmailSender,
        UserRepository userRepository,
        SiteSettingService siteSettingService
    ) {
        this.emailVerificationOtpRepository = emailVerificationOtpRepository;
        this.asyncEmailSender = asyncEmailSender;
        this.userRepository = userRepository;
        this.siteSettingService = siteSettingService;
    }

    /**
     * Sends a welcome/confirmation email after successful registration.
     *
     * @param rawEmail the raw email address of the newly registered user
     */
    public void sendRegistrationConfirmationEmail(String rawEmail) {
        String emailAddress = StringUtil.normalize(rawEmail, true);

        User user = new User();
        user.setEmail(emailAddress);

        Email email = Email.builder()
            .to(user)
            .customSubject("Welcome to " + siteSettingService.getSiteName() + "!")
            .customBody(generateRegistrationConfirmationHTML())
            .sendAlways(true)
            .build();
        asyncEmailSender.sendAsync(email);
    }

    /**
     * Generates the HTML content for the registration confirmation email.
     *
     * @return the HTML content as a String
     */
    private String generateRegistrationConfirmationHTML() {
        return """
          <h2 style="margin:0 0 16px 0;font-size:20px;color:#0A66C2;">Welcome to %s!</h2>
          <p style="margin:0 0 16px 0;">Thank you for registering with %s.</p>
          <p style="margin:0 0 16px 0;">Your account has been successfully created. You can now explore available positions and submit your applications.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="https://docapply.aet.cit.tum.de/" style="display:inline-block;padding:12px 24px;background:#0A66C2;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Get Started</a>
          </div>
          <p style="margin:16px 0 0 0;color:#555;font-size:12px;">If you did not create this account, please contact our support team.</p>
        """.formatted(siteSettingService.getSiteName(), siteSettingService.getSiteName());
    }

    /**
     * Generates a new OTP for the given email, invalidates any previous active OTPs,
     * saves the new OTP in the repository, and sends the verification code via email.
     * <p>
     * For login flow (isRegistration == false), this method only sends the OTP if the user exists,
     * to avoid user enumeration. If the user does not exist, it returns without sending.
     * For registration flow (isRegistration == true), the OTP is sent regardless of user existence.
     *
     * @param rawEmail       the raw email address to send the verification code to
     * @param ip             the IP address of the client requesting the code
     * @param isRegistration true if this is a registration flow, false for login flow
     */
    @Transactional
    public void sendCode(String rawEmail, String ip, boolean isRegistration) {
        String emailAddress = StringUtil.normalize(rawEmail, true);

        // For login flow, only send if user exists
        if (!isRegistration && !userRepository.existsByEmailIgnoreCase(emailAddress)) {
            return;
        }

        // Enforce the resend cooldown server-side: if a code was issued within the cooldown window, keep it
        // and do not send another. Silently returning (rather than erroring) avoids user enumeration and
        // prevents an attacker from flooding a target inbox with codes.
        if (isWithinResendCooldown(emailAddress)) {
            LOGGER.info("OTP send skipped: within resend cooldown - emailId={} ip={}", emailLogId(emailAddress), ip);
            return;
        }

        // Enforce single-active-code policy
        emailVerificationOtpRepository.invalidateAllForEmail(emailAddress);

        // Generate OTP
        String code = OtpUtil.generateNumeric(otpLength);
        String salt = OtpUtil.randomBase64(16);
        String hash = OtpUtil.hmacSha256Base64(otpHmacSecret, code + "|" + salt + "|" + emailAddress);

        Instant now = Instant.now();
        EmailVerificationOtp evo = new EmailVerificationOtp();
        evo.setEmail(emailAddress);
        evo.setCodeHash(hash);
        evo.setSalt(salt);
        evo.setJti(UUID.randomUUID().toString());
        evo.setCreatedAt(now);
        evo.setExpiresAt(now.plusSeconds(otpTtlSeconds));
        evo.setMaxAttempts(otpMaxAttempts);
        evo.setAttempts(0);
        evo.setUsed(false);
        evo.setIpHash(OtpUtil.hmacSha256Base64(otpHmacSecret, ip + "|" + salt));
        emailVerificationOtpRepository.save(evo);

        User user = new User();
        user.setEmail(emailAddress);

        Email email = Email.builder()
            .to(user)
            .customSubject("Your verification code")
            .customBody(generateHTML(code))
            .sendAlways(true)
            .build();
        asyncEmailSender.sendAsync(email);
    }

    /**
     * Checks whether the most recent OTP for the email was created within the configured resend cooldown.
     *
     * @param email normalized email
     * @return {@code true} if a new code must not be sent yet
     */
    private boolean isWithinResendCooldown(String email) {
        if (otpResendCooldownSeconds <= 0) {
            return false;
        }
        return emailVerificationOtpRepository
            .findTop1ByEmailAndUsedFalseOrderByCreatedAtDesc(email)
            .map(latest -> Instant.now().isBefore(latest.getCreatedAt().plusSeconds(otpResendCooldownSeconds)))
            .orElse(false);
    }

    /**
     * Verifies the submitted OTP code for the given email and IP address.
     * <p>
     * Security model: This method ONLY validates the OTP and marks it as used. It MUST NOT perform any side effects
     * like creating users, logging users in, or changing Keycloak state. Those actions are handled by OtpFlowService
     * after successful verification.
     *
     * @param body the OTP completion request containing email and code
     * @param ip   the IP address of the client submitting the code
     * @throws EmailVerificationFailedException if verification fails for any reason
     */
    @Transactional(noRollbackFor = EmailVerificationFailedException.class)
    public void verifyCode(OtpCompleteDTO body, String ip) {
        String normalizedEmail = StringUtil.normalize(body.email(), true);
        Instant now = Instant.now();

        Optional<EmailVerificationOtp> activeOtp =
            emailVerificationOtpRepository.findTop1ByEmailAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(normalizedEmail, now);
        if (activeOtp.isEmpty()) {
            LOGGER.info("OTP check: no active code - emailId={} ip={}", emailLogId(normalizedEmail), ip);
            throw new EmailVerificationFailedException();
        }

        EmailVerificationOtp otp = activeOtp.get();

        String cleanedCode = body.code() == null ? "" : body.code().trim();
        String expected = OtpUtil.hmacSha256Base64(otpHmacSecret, cleanedCode + "|" + otp.getSalt() + "|" + normalizedEmail);

        boolean ok = OtpUtil.constantTimeEquals(expected, otp.getCodeHash());

        if (!ok) {
            // Atomically increment attempts and burn if limit is reached
            emailVerificationOtpRepository.incrementAttemptsIfActive(otp.getId(), now);
            throw new EmailVerificationFailedException();
        }

        // Mark used atomically (race safety)
        if (emailVerificationOtpRepository.markUsedIfActive(otp.getId(), now) == 0) {
            LOGGER.warn("OTP race: markUsedIfActive returned 0 - emailId={} ip={}", emailLogId(normalizedEmail), ip);
            throw new EmailVerificationFailedException();
        }
    }

    /**
     * Generates the HTML content for the verification email, including the OTP code
     *
     * @param code the OTP code to include in the email
     * @return the HTML content in English as a String
     */
    private String generateHTML(String code) {
        Duration ttl = Duration.ofSeconds(otpTtlSeconds);
        long ttlMinutes = Math.max(1, ttl.toMinutes());

        return """
          <h2 style="margin:0 0 16px 0;font-size:20px;color:#0A66C2;">Verify your email</h2>
          <p style="margin:0 0 16px 0;">Use this code to verify your email address:</p>
          <div style="text-align:center;margin:24px 0;">
            <div style="display:inline-block;font-size:24px;font-weight:700;letter-spacing:3px;padding:12px 16px;border:1px dashed #0A66C2;border-radius:6px;background:#F0F7FF;">%s</div>
          </div>
          <p style="margin:0 0 8px 0;">The code expires in <strong>%d minute%s</strong>.</p>
          <p style="margin:8px 0 0 0;color:#555;font-size:12px;">If you didn’t request this, you can ignore this email.</p>
        """.formatted(code, ttlMinutes, ttlMinutes == 1 ? "" : "s");
    }

    /**
     * Generates a short, non-reversible identifier for the given email address
     * to be used in logs. The identifier is derived by computing an HMAC-SHA256
     * hash of the email using the configured {@code otpHmacSecret} and truncating
     * the result to 12 characters.
     * <p>
     * This avoids writing the plain email address into logs while still allowing
     * correlation of repeated events for the same user.
     *
     * @param email the email address to obfuscate for logging purposes
     * @return a short, stable identifier string for the given email
     */
    private String emailLogId(String email) {
        return OtpUtil.hmacSha256Base64(otpHmacSecret, email).substring(0, 12);
    }
}
