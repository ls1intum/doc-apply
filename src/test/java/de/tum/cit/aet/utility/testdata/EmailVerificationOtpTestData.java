package de.tum.cit.aet.utility.testdata;

import de.tum.cit.aet.core.security.otp.OtpUtil;
import de.tum.cit.aet.usermanagement.domain.EmailVerificationOtp;
import de.tum.cit.aet.usermanagement.repository.EmailVerificationOtpRepository;
import java.time.Instant;
import java.util.UUID;

/**
 * Test data helpers for EmailVerificationOtp.
 */
public final class EmailVerificationOtpTestData {

    private static final String SALT = "dGVzdC1zYWx0LXZhbHVl";

    private EmailVerificationOtpTestData() {}

    /**
     * Saves an active one-time code for the given email, hashed the same way the server hashes a code it sends.
     *
     * @param repo       the repository to save the code with
     * @param email      the normalized email the code belongs to
     * @param code       the plain code a test submits
     * @param hmacSecret the configured OTP HMAC secret
     * @return the saved code
     */
    public static EmailVerificationOtp savedActiveOtp(EmailVerificationOtpRepository repo, String email, String code, String hmacSecret) {
        Instant now = Instant.now();
        EmailVerificationOtp otp = new EmailVerificationOtp();
        otp.setEmail(email);
        otp.setCodeHash(OtpUtil.hmacSha256Base64(hmacSecret, code + "|" + SALT + "|" + email));
        otp.setSalt(SALT);
        otp.setJti(UUID.randomUUID().toString());
        otp.setCreatedAt(now);
        otp.setExpiresAt(now.plusSeconds(600));
        otp.setMaxAttempts(5);
        otp.setAttempts(0);
        otp.setUsed(false);
        otp.setIpHash(OtpUtil.hmacSha256Base64(hmacSecret, "127.0.0.1|" + SALT));
        return repo.save(otp);
    }
}
