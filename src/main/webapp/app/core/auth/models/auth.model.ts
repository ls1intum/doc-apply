/**
 * Modes the dialog can run in
 * - 'login'         : regular login flow
 * - 'register'      : regular registration flow (verify -> profile -> optional password)
 */
export type AuthFlowMode = 'login' | 'register';

export interface AuthOpenOptions {
  mode?: AuthFlowMode;
  prefill?: {
    email?: string;
    firstName?: string;
    lastName?: string;
  };
  // optional callback when user is fully authenticated
  onSuccess?: () => void;
  // post-login redirect (e.g. back to booking page instead of home)
  redirectUri?: string;
  offerTumLogin?: boolean;
}

export interface PasskeyCredentialSummary {
  id: string;
  label?: string;
  createdDate?: number;
}

// Substates within the login flow:
// - 'email'    : user enters their email (decides between password or OTP)
// - 'password' : user is prompted for their password
// - 'otp'      : user enters a one-time code sent by email
export type LoginStep = 'email' | 'password' | 'otp';

// Steps within the registration flow:
// - 'null'       : initial pre-step to allow progress bar animation on flow start
// - 'email'    : user enters their email
// - 'otp'   : user verifies their email with a code
// - 'profile'   : user enters first name, last name, and consents
// - 'password' : optional step to set a password for future logins
export const REGISTER_STEPS = [null, 'email', 'otp', 'profile', 'password'] as const;
export type RegisterStep = (typeof REGISTER_STEPS)[number];
