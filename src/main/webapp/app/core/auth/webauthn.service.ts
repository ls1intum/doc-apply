import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PasskeyCredentialSummary } from 'app/core/auth/models/auth.model';
import { WebAuthnPasskeyResourceApi } from 'app/generated/api/web-authn-passkey-resource-api';

/**
 * Drives the in-app WebAuthn (passkey) ceremonies for applicants against Spring Security's built-in
 * endpoints (`/webauthn/register/options`, `/webauthn/register`, `/webauthn/authenticate/options`,
 * `/login/webauthn`), which are not part of the OpenAPI spec and so are called directly. Passkey management
 * (`/api/auth/webauthn/passkeys`) is a normal application endpoint and goes through the generated client.
 *
 * TUM staff passkeys are handled separately through Keycloak; this service is only for the application's own
 * (applicant) sessions. The ceremony calls include credentials so the session cookie carrying the challenge
 * is sent.
 */
@Injectable({ providedIn: 'root' })
export class WebAuthnService {
  private readonly http = inject(HttpClient);
  private readonly passkeyApi = inject(WebAuthnPasskeyResourceApi);
  private readonly options = { withCredentials: true } as const;

  /** Registers a new passkey for the currently authenticated applicant. */
  async register(label: string): Promise<void> {
    this.assertSupported();
    const optionsJson = await firstValueFrom(
      this.http.post<PublicKeyCredentialCreationOptionsJSON>('/webauthn/register/options', {}, this.options),
    );

    const created =
      (await navigator.credentials.create({
        publicKey: this.toCreationOptions(optionsJson),
      })) ?? undefined;
    if (!(created instanceof PublicKeyCredential)) {
      throw new Error('Passkey creation was cancelled');
    }

    const response = created.response;
    if (!(response instanceof AuthenticatorAttestationResponse)) {
      throw new Error('Unexpected passkey registration response');
    }
    const credential = {
      id: created.id,
      rawId: bufferToBase64Url(created.rawId),
      response: {
        attestationObject: bufferToBase64Url(response.attestationObject),
        clientDataJSON: bufferToBase64Url(response.clientDataJSON),
        transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
      },
      type: created.type,
      clientExtensionResults: created.getClientExtensionResults(),
      authenticatorAttachment: created.authenticatorAttachment ?? undefined,
    };

    await firstValueFrom(this.http.post('/webauthn/register', { publicKey: { credential, label } }, this.options));
  }

  /** Authenticates the current browser via an existing passkey and establishes an app session. */
  async authenticate(): Promise<void> {
    this.assertSupported();
    const optionsJson = await firstValueFrom(
      this.http.post<PublicKeyCredentialRequestOptionsJSON>('/webauthn/authenticate/options', {}, this.options),
    );

    const assertion =
      (await navigator.credentials.get({
        publicKey: this.toRequestOptions(optionsJson),
      })) ?? undefined;
    if (!(assertion instanceof PublicKeyCredential)) {
      throw new Error('Passkey authentication was cancelled');
    }

    const response = assertion.response;
    if (!(response instanceof AuthenticatorAssertionResponse)) {
      throw new Error('Unexpected passkey authentication response');
    }
    const credential = {
      id: assertion.id,
      rawId: bufferToBase64Url(assertion.rawId),
      response: {
        authenticatorData: bufferToBase64Url(response.authenticatorData),
        clientDataJSON: bufferToBase64Url(response.clientDataJSON),
        signature: bufferToBase64Url(response.signature),
        userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : undefined,
      },
      type: assertion.type,
      clientExtensionResults: assertion.getClientExtensionResults(),
      authenticatorAttachment: assertion.authenticatorAttachment ?? undefined,
    };

    await firstValueFrom(this.http.post('/login/webauthn', credential, this.options));
  }

  /** Lists the current applicant's registered passkeys. */
  async list(): Promise<PasskeyCredentialSummary[]> {
    const passkeys = await firstValueFrom(this.passkeyApi.listPasskeys());
    return passkeys.map(passkey => ({ id: passkey.id ?? '', label: passkey.label, createdDate: passkey.createdDate }));
  }

  /** Removes one of the current applicant's passkeys by credential id. */
  async remove(credentialId: string): Promise<void> {
    await firstValueFrom(this.passkeyApi.removePasskey(credentialId));
  }

  private assertSupported(): void {
    if (typeof window === 'undefined' || typeof window.PublicKeyCredential === 'undefined' || !window.isSecureContext) {
      throw new Error('Passkeys are not supported in this browser context');
    }
  }

  private toCreationOptions(json: PublicKeyCredentialCreationOptionsJSON): PublicKeyCredentialCreationOptions {
    return {
      rp: json.rp,
      user: { id: base64UrlToBuffer(json.user.id), name: json.user.name, displayName: json.user.displayName },
      challenge: base64UrlToBuffer(json.challenge),
      pubKeyCredParams: json.pubKeyCredParams,
      timeout: json.timeout,
      excludeCredentials: (json.excludeCredentials ?? []).map(credential => ({
        id: base64UrlToBuffer(credential.id),
        type: credential.type,
        transports: credential.transports,
      })),
      authenticatorSelection: json.authenticatorSelection,
      attestation: json.attestation,
      extensions: json.extensions,
    };
  }

  private toRequestOptions(json: PublicKeyCredentialRequestOptionsJSON): PublicKeyCredentialRequestOptions {
    return {
      challenge: base64UrlToBuffer(json.challenge),
      timeout: json.timeout,
      rpId: json.rpId,
      allowCredentials: (json.allowCredentials ?? []).map(credential => ({
        id: base64UrlToBuffer(credential.id),
        type: credential.type,
        transports: credential.transports,
      })),
      userVerification: json.userVerification,
      extensions: json.extensions,
    };
  }
}

/** Minimal shapes of Spring's option JSON (binary fields are base64url strings). */
interface PublicKeyCredentialCreationOptionsJSON {
  rp: PublicKeyCredentialRpEntity;
  user: { id: string; name: string; displayName: string };
  challenge: string;
  pubKeyCredParams: PublicKeyCredentialParameters[];
  timeout?: number;
  excludeCredentials?: { id: string; type: PublicKeyCredentialType; transports?: AuthenticatorTransport[] }[];
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  attestation?: AttestationConveyancePreference;
  extensions?: AuthenticationExtensionsClientInputs;
}

interface PublicKeyCredentialRequestOptionsJSON {
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials?: { id: string; type: PublicKeyCredentialType; transports?: AuthenticatorTransport[] }[];
  userVerification?: UserVerificationRequirement;
  extensions?: AuthenticationExtensionsClientInputs;
}

function base64UrlToBuffer(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return bytes.buffer;
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
