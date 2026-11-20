/**
 * A strong password has at least 8 characters with a lowercase letter, an uppercase letter and a digit. Admins must
 * meet it when they set a password, and the password field's strength meter calls such a password strong.
 */
export const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
