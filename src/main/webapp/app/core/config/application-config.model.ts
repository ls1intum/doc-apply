export interface ApplicationConfig {
  keycloak?: KeycloakConfig;
  otp?: OtpConfig;
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
