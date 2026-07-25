import { vi } from 'vitest';
import { KeycloakPasskeyManager } from 'app/core/auth/keycloak-passkey-manager';

class MockPublicKeyCredential {
  constructor(
    readonly rawId: ArrayBuffer,
    readonly response: unknown,
  ) {}
}

class MockAuthenticatorAssertionResponse {
  constructor(
    readonly clientDataJSON: ArrayBuffer,
    readonly authenticatorData: ArrayBuffer,
    readonly signature: ArrayBuffer,
    readonly userHandle: ArrayBuffer | undefined,
  ) {}
}

class MockAuthenticatorAttestationResponse {
  constructor(
    readonly clientDataJSON: ArrayBuffer,
    readonly attestationObject: ArrayBuffer,
  ) {}
}

function buffer(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

function stubWebAuthn(credentials: { create?: ReturnType<typeof vi.fn>; get?: ReturnType<typeof vi.fn> }): void {
  vi.stubGlobal('PublicKeyCredential', MockPublicKeyCredential);
  vi.stubGlobal('AuthenticatorAssertionResponse', MockAuthenticatorAssertionResponse);
  vi.stubGlobal('AuthenticatorAttestationResponse', MockAuthenticatorAttestationResponse);
  vi.stubGlobal('navigator', Object.assign({}, navigator, { credentials }));
}

type PasskeyManagerDependencies = ConstructorParameters<typeof KeycloakPasskeyManager>[0];

describe('KeycloakPasskeyManager', () => {
  let manager: KeycloakPasskeyManager;
  let deps: PasskeyManagerDependencies;
  let fetchMock: ReturnType<typeof vi.fn>;
  let tokenParsed: Record<string, unknown>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    tokenParsed = {
      sub: 'mock-subject',
      preferred_username: 'mock-user',
      name: 'Mock User',
    };

    deps = {
      keycloakUrl: 'http://mock-keycloak',
      tumRealmName: 'tumidpldap',
      clientId: 'mock-client',
      relyingPartyId: '',
      getTokenParsed: vi.fn(() => tokenParsed),
      canManagePasskeys: vi.fn().mockReturnValue(true),
      getPasskeyUserIdentity: vi.fn().mockReturnValue({ id: 'mock-subject', username: 'mock-user', displayName: 'Mock User' }),
      listPasskeys: vi.fn().mockResolvedValue([]),
      removePasskey: vi.fn().mockResolvedValue(undefined),
      createPasskeyActionToken: vi.fn().mockResolvedValue({
        realm: 'tumidpldap',
        clientId: 'mock-action-client',
        accessToken: 'mock-action-token',
      }),
    };

    manager = new KeycloakPasskeyManager(deps);
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('should authenticate with a discoverable passkey and send the user handle', async () => {
    const credentialsGet = vi
      .fn()
      .mockResolvedValue(
        new MockPublicKeyCredential(
          buffer([4, 5, 6]),
          new MockAuthenticatorAssertionResponse(buffer([7]), buffer([8]), buffer([9]), buffer([10, 11])),
        ),
      );
    stubWebAuthn({ get: credentialsGet });
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ challenge: 'AQID', credentialId: 'legacy-allow-credential' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

    await manager.loginWithPasskey();

    const credentialRequest = credentialsGet.mock.calls[0][0] as CredentialRequestOptions;
    expect(credentialRequest.publicKey?.userVerification).toBe('required');
    expect(credentialRequest.publicKey?.rpId).toBe(window.location.hostname);
    expect(credentialRequest.publicKey?.allowCredentials).toBeUndefined();
    expect(Array.from(new Uint8Array(credentialRequest.publicKey?.challenge as ArrayBuffer))).toEqual([1, 2, 3]);

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://mock-keycloak/realms/tumidpldap/passkey/mock-client/challenge', {
      credentials: 'include',
    });
    const authenticateRequest = fetchMock.mock.calls[1][1] as RequestInit;
    expect(fetchMock.mock.calls[1][0]).toBe('http://mock-keycloak/realms/tumidpldap/passkey/mock-client/authenticate');
    expect(authenticateRequest.method).toBe('POST');
    expect(authenticateRequest.credentials).toBe('include');
    expect(authenticateRequest.headers).toEqual({ 'Content-Type': 'application/json', Accept: 'application/json' });
    expect(JSON.parse(authenticateRequest.body as string)).toEqual({
      credentialId: 'BAUG',
      userHandle: 'Cgs',
      clientDataJSON: 'Bw',
      authenticatorData: 'CA',
      signature: 'CQ',
      challenge: 'AQID',
    });
  });

  it('should reject passkey authentication when the assertion has no user handle', async () => {
    const credentialsGet = vi
      .fn()
      .mockResolvedValue(
        new MockPublicKeyCredential(
          buffer([4, 5, 6]),
          new MockAuthenticatorAssertionResponse(buffer([7]), buffer([8]), buffer([9]), undefined),
        ),
      );
    stubWebAuthn({ get: credentialsGet });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ challenge: 'AQID' }),
    });

    await expect(manager.loginWithPasskey()).rejects.toThrow('Passkey did not return a user handle');

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('should register passkeys with the Keycloak subject as WebAuthn user id', async () => {
    tokenParsed = {
      sub: 'subject-123',
      preferred_username: 'jane',
      name: 'Jane Doe',
      iss: 'http://mock-keycloak/realms/tumidpldap',
    };
    deps.relyingPartyId = 'apply.example.test';
    const credentialsCreate = vi
      .fn()
      .mockResolvedValue(new MockPublicKeyCredential(buffer([12]), new MockAuthenticatorAttestationResponse(buffer([13]), buffer([14]))));
    stubWebAuthn({ create: credentialsCreate });
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ challenge: 'AQID' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

    await manager.registerPasskey();

    const credentialCreation = credentialsCreate.mock.calls[0][0] as CredentialCreationOptions;
    expect(Array.from(credentialCreation.publicKey?.user.id as Uint8Array)).toEqual(Array.from(new TextEncoder().encode('subject-123')));
    expect(credentialCreation.publicKey?.user.name).toBe('jane');
    expect(credentialCreation.publicKey?.user.displayName).toBe('Jane Doe');
    expect(credentialCreation.publicKey?.rp).toEqual({ name: 'TUM AET', id: 'apply.example.test' });
    expect(credentialCreation.publicKey?.authenticatorSelection).toEqual({
      residentKey: 'required',
      userVerification: 'required',
    });

    expect(deps.createPasskeyActionToken).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://mock-keycloak/realms/tumidpldap/passkey/mock-action-client/challenge', {
      credentials: 'include',
    });
    const saveRequest = fetchMock.mock.calls[1][1] as RequestInit;
    expect(fetchMock.mock.calls[1][0]).toBe('http://mock-keycloak/realms/tumidpldap/passkey/mock-action-client/save');
    expect(saveRequest.credentials).toBe('include');
    expect(saveRequest.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer mock-action-token',
    });
    expect(JSON.parse(saveRequest.body as string)).toEqual({
      credentialId: 'DA',
      clientDataJSON: 'DQ',
      attestationObject: 'Dg',
      challenge: 'AQID',
    });
  });

  it('should reject passkey registration when the Keycloak subject exceeds the WebAuthn user id limit', async () => {
    tokenParsed = {
      sub: 'a'.repeat(65),
      preferred_username: 'jane',
    };
    stubWebAuthn({ create: vi.fn() });

    await expect(manager.registerPasskey()).rejects.toThrow('User id is too long for WebAuthn user.id');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      description: 'the configured relying party id and TUM AET name for a TUM realm session',
      iss: 'http://mock-keycloak/realms/tumidpldap' as string | undefined,
      relyingPartyId: 'staging.apply.in.tum.de',
      expectedRp: { name: 'TUM AET', id: 'staging.apply.in.tum.de' },
    },
    {
      description: 'the current hostname and TUM Apply name when the relying party id and issuer are absent',
      iss: undefined,
      relyingPartyId: '   ',
      expectedRp: { name: 'TUM Apply', id: window.location.hostname },
    },
  ])('should register the passkey with $description', async ({ iss, relyingPartyId, expectedRp }) => {
    tokenParsed = { sub: 'subject-123', preferred_username: 'jane', iss };
    deps.relyingPartyId = relyingPartyId;
    const credentialsCreate = vi
      .fn()
      .mockResolvedValue(new MockPublicKeyCredential(buffer([1]), new MockAuthenticatorAttestationResponse(buffer([2]), buffer([3]))));
    stubWebAuthn({ create: credentialsCreate });
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ challenge: 'AQID' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

    await manager.registerPasskey();

    const credentialCreation = credentialsCreate.mock.calls[0][0] as CredentialCreationOptions;
    expect(credentialCreation.publicKey?.rp).toEqual(expectedRp);
  });

  it('should list passkeys returned by the server', async () => {
    const credentialsPayload = [
      { id: ' passkey-1 ', label: 'MacBook Pro', createdDate: 1_710_000_000_000 },
      { id: 'passkey-2', label: 'Backup key' },
      { id: '' },
    ];
    vi.mocked(deps.listPasskeys).mockResolvedValue(credentialsPayload);

    await expect(manager.listPasskeys()).resolves.toEqual([
      { id: 'passkey-1', label: 'MacBook Pro', createdDate: 1_710_000_000_000 },
      { id: 'passkey-2', label: 'Backup key' },
    ]);
    expect(deps.listPasskeys).toHaveBeenCalledOnce();
  });

  it('should surface API errors when loading passkeys fails', async () => {
    vi.mocked(deps.listPasskeys).mockRejectedValue(new Error('temporarily unavailable'));

    await expect(manager.listPasskeys()).rejects.toThrow('temporarily unavailable');
  });

  it('should remove a passkey via the encoded account credential endpoint', async () => {
    await manager.removePasskey('passkey/with slash');

    expect(deps.removePasskey).toHaveBeenCalledWith('passkey/with slash');
  });
});
