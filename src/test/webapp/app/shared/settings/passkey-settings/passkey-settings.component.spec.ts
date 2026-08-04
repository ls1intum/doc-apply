import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthFacadeServiceMock, createAuthFacadeServiceMock, provideAuthFacadeServiceMock } from 'util/auth-facade.service.mock';
import {
  createKeycloakAuthenticationServiceMock,
  KeycloakAuthenticationServiceMock,
  provideKeycloakAuthenticationServiceMock,
} from 'util/keycloak.mock';
import { PasskeyCredentialSummary } from 'app/core/auth/models/auth.model';
import { WebAuthnService } from 'app/core/auth/webauthn.service';
import { PasskeySettingsComponent } from 'app/shared/settings/passkey-settings/passkey-settings.component';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { createToastServiceMock, provideToastServiceMock } from 'util/toast-service.mock';
import { createTranslateServiceMock, provideTranslateMock, TranslateServiceMock } from 'util/translate.mock';
import { ToastServiceMock } from '../../../../util/toast-service.mock';

describe('PasskeySettingsComponent', () => {
  let fixture: ComponentFixture<PasskeySettingsComponent>;
  let component: PasskeySettingsComponent;

  let authFacadeMock: AuthFacadeServiceMock;
  let keycloakAuthenticationServiceMock: KeycloakAuthenticationServiceMock;
  let toastServiceMock: ToastServiceMock;
  let translateServiceMock: TranslateServiceMock;
  let webAuthnServiceMock: { register: ReturnType<typeof vi.fn>; list: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };

  const existingPasskeys: PasskeyCredentialSummary[] = [
    { id: 'passkey-1', label: 'MacBook Pro', createdDate: 1_710_000_000_000 },
    { id: 'passkey-2' },
  ];

  const createComponent = async (): Promise<void> => {
    fixture = TestBed.createComponent(PasskeySettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    authFacadeMock = createAuthFacadeServiceMock();
    keycloakAuthenticationServiceMock = createKeycloakAuthenticationServiceMock();
    toastServiceMock = createToastServiceMock();
    translateServiceMock = createTranslateServiceMock();
    webAuthnServiceMock = {
      register: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [PasskeySettingsComponent],
      providers: [
        provideAuthFacadeServiceMock(authFacadeMock),
        provideKeycloakAuthenticationServiceMock(keycloakAuthenticationServiceMock),
        provideToastServiceMock(toastServiceMock),
        provideTranslateMock(translateServiceMock),
        provideFontAwesomeTesting(),
        // The component picks the passkey backend by session type; provide a stub for the in-app path.
        { provide: WebAuthnService, useValue: webAuthnServiceMock },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load passkeys on init when the user can manage them', async () => {
    keycloakAuthenticationServiceMock.listPasskeys.mockResolvedValue(existingPasskeys);

    await createComponent();

    expect(component.canManagePasskeys()).toBe(true);
    expect(component.loaded()).toBe(true);
    expect(component.loadFailed()).toBe(false);
    expect(component.passkeys()).toEqual(existingPasskeys);
    expect(keycloakAuthenticationServiceMock.listPasskeys).toHaveBeenCalledOnce();
    expect(component.hasPasskeys()).toBe(true);
  });

  it('should show the unavailable state and skip loading when the current session cannot manage passkeys', async () => {
    keycloakAuthenticationServiceMock.canManagePasskeys.mockReturnValue(false);

    await createComponent();

    expect(component.canManagePasskeys()).toBe(false);
    expect(component.loaded()).toBe(true);
    expect(component.passkeys()).toEqual([]);
    expect(component.loadFailed()).toBe(false);
    expect(keycloakAuthenticationServiceMock.listPasskeys).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('settings.passkeys.unavailable.title');
  });

  it('should show an error state and toast when loading passkeys fails', async () => {
    keycloakAuthenticationServiceMock.listPasskeys.mockRejectedValue(new Error('load failed'));

    await createComponent();

    expect(component.loaded()).toBe(true);
    expect(component.loadFailed()).toBe(true);
    expect(component.passkeys()).toEqual([]);
    expect(toastServiceMock.showErrorKey).toHaveBeenCalledWith('settings.passkeys.loadFailed');
    expect(component.hasPasskeys()).toBe(false);
  });

  it('should create a passkey and reload the list', async () => {
    keycloakAuthenticationServiceMock.listPasskeys.mockResolvedValueOnce([]).mockResolvedValueOnce(existingPasskeys);

    await createComponent();
    await component.createPasskey();
    fixture.detectChanges();

    expect(authFacadeMock.registerPasskey).toHaveBeenCalledOnce();
    expect(keycloakAuthenticationServiceMock.listPasskeys).toHaveBeenCalledTimes(2);
    expect(component.creating()).toBe(false);
    expect(component.passkeys()).toEqual(existingPasskeys);
  });

  it('should remove a passkey and keep the remaining entries', async () => {
    keycloakAuthenticationServiceMock.listPasskeys.mockResolvedValue(existingPasskeys);

    await createComponent();
    await component.removePasskey('passkey-1');
    fixture.detectChanges();

    expect(keycloakAuthenticationServiceMock.removePasskey).toHaveBeenCalledWith('passkey-1');
    expect(component.passkeys()).toEqual([{ id: 'passkey-2' }]);
    expect(component.removingId()).toBeUndefined();
    expect(toastServiceMock.showSuccessKey).toHaveBeenCalledWith('settings.passkeys.removed');
  });

  it('should show an error toast and reset removing state when removing a passkey fails', async () => {
    keycloakAuthenticationServiceMock.listPasskeys.mockResolvedValue(existingPasskeys);
    keycloakAuthenticationServiceMock.removePasskey.mockRejectedValue(new Error('remove failed'));

    await createComponent();
    await component.removePasskey('passkey-1');

    expect(component.passkeys()).toEqual(existingPasskeys);
    expect(component.removingId()).toBeUndefined();
    expect(toastServiceMock.showErrorKey).toHaveBeenCalledWith('settings.passkeys.removeFailed');
  });

  it('should expose fallback labels, safe date formatting, and removal state in passkey items', async () => {
    await createComponent();

    component.passkeys.set([
      { id: 'passkey-1', label: '   ' },
      { id: 'passkey-2', createdDate: Number.NaN },
    ]);

    expect(component.passkeyItems()).toEqual([
      { id: 'passkey-1', label: 'Passkey 1', createdAtLabel: undefined, removeDisabled: false, removing: false },
      { id: 'passkey-2', label: 'Passkey 2', createdAtLabel: undefined, removeDisabled: false, removing: false },
    ]);

    component.removingId.set('passkey-2');

    expect(component.passkeyItems()).toEqual([
      { id: 'passkey-1', label: 'Passkey 1', createdAtLabel: undefined, removeDisabled: true, removing: false },
      { id: 'passkey-2', label: 'Passkey 2', createdAtLabel: undefined, removeDisabled: false, removing: true },
    ]);
  });

  it('should format passkey dates using the current translation language', async () => {
    await createComponent();

    component.passkeys.set([{ id: 'passkey-1', label: 'Phone', createdDate: Date.UTC(2024, 2, 9, 12, 0, 0) }]);
    const englishLabel = component.passkeyItems()[0]?.createdAtLabel;
    expect(englishLabel).toBeDefined();

    translateServiceMock.use('de');
    fixture.detectChanges();
    const germanLabel = component.passkeyItems()[0]?.createdAtLabel;
    expect(germanLabel).toBeDefined();
    expect(germanLabel).not.toBe(englishLabel);
  });

  describe('applicant (in-app WebAuthn) session', () => {
    beforeEach(() => {
      // Not a Keycloak/TUM session -> the component must use the in-app WebAuthn service.
      keycloakAuthenticationServiceMock.isLoggedIn.mockReturnValue(false);
    });

    it('should load, create, and remove passkeys via the in-app WebAuthn service (not Keycloak)', async () => {
      webAuthnServiceMock.list.mockResolvedValueOnce(existingPasskeys).mockResolvedValueOnce(existingPasskeys);

      await createComponent();
      expect(webAuthnServiceMock.list).toHaveBeenCalled();
      expect(keycloakAuthenticationServiceMock.listPasskeys).not.toHaveBeenCalled();
      expect(component.passkeys()).toEqual(existingPasskeys);

      await component.createPasskey();
      expect(webAuthnServiceMock.register).toHaveBeenCalledOnce();
      expect(authFacadeMock.registerPasskey).not.toHaveBeenCalled();

      await component.removePasskey('passkey-1');
      expect(webAuthnServiceMock.remove).toHaveBeenCalledWith('passkey-1');
      expect(keycloakAuthenticationServiceMock.removePasskey).not.toHaveBeenCalled();
    });
  });
});
