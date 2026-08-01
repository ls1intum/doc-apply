export interface ApplicationConfig {
  keycloak?: KeycloakConfig;
  otp?: OtpConfig;
  siteName?: string;
}

export interface KeycloakConfig {
  url: string;
  tumLoginRealm: string;
  clientId: string;
  relyingPartyId: string;
}

export interface OtpConfig {
  length: number;
  ttlSeconds: number;
  resendCooldownSeconds: number;
}
