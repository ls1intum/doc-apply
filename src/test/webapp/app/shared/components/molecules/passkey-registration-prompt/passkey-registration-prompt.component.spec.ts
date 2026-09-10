import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountServiceMock, createAccountServiceMock, provideAccountServiceMock } from 'util/account.service.mock';
import { AuthFacadeServiceMock, createAuthFacadeServiceMock, provideAuthFacadeServiceMock } from 'util/auth-facade.service.mock';
import {
  createKeycloakAuthenticationServiceMock,
  KeycloakAuthenticationServiceMock,
  provideKeycloakAuthenticationServiceMock,
} from 'util/keycloak.mock';
import { provideTranslateMock } from 'util/translate.mock';
import { signal } from '@angular/core';
import { OnboardingOrchestratorService } from 'app/service/onboarding-orchestrator.service';
import { PasskeyRegistrationPromptComponent } from 'app/shared/components/molecules/passkey-registration-prompt/passkey-registration-prompt.component';
import { WebAuthnService } from 'app/core/auth/webauthn.service';
import { ToastServiceMock, createToastServiceMock, provideToastServiceMock } from 'util/toast-service.mock';

describe('PasskeyRegistrationPromptComponent', () => {
  const promptPreferenceId = 'ui_pref_hide_passkey_prompt';
  const promptDismissedDateId = 'ui_pref_passkey_prompt_dismissed_date';

  let fixture: ComponentFixture<PasskeyRegistrationPromptComponent>;
  let component: PasskeyRegistrationPromptComponent;
  let accountServiceMock: AccountServiceMock;
  let authFacadeMock: AuthFacadeServiceMock;
  let keycloakAuthenticationServiceMock: KeycloakAuthenticationServiceMock;
  let webAuthnServiceMock: { register: ReturnType<typeof vi.fn>; list: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
  let toastServiceMock: ToastServiceMock;

  const createComponent = async (): Promise<void> => {
    fixture = TestBed.createComponent(PasskeyRegistrationPromptComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    accountServiceMock = createAccountServiceMock(true);
    authFacadeMock = createAuthFacadeServiceMock();
    keycloakAuthenticationServiceMock = createKeycloakAuthenticationServiceMock();
    webAuthnServiceMock = {
      register: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    toastServiceMock = createToastServiceMock();

    localStorage.removeItem(promptPreferenceId);
    localStorage.removeItem(promptDismissedDateId);

    await TestBed.configureTestingModule({
      imports: [PasskeyRegistrationPromptComponent],
      providers: [
        provideAccountServiceMock(accountServiceMock),
        provideAuthFacadeServiceMock(authFacadeMock),
        provideKeycloakAuthenticationServiceMock(keycloakAuthenticationServiceMock),
        provideTranslateMock(),
        { provide: OnboardingOrchestratorService, useValue: { suppressesFollowupPrompts: signal(false).asReadonly() } },
        { provide: WebAuthnService, useValue: webAuthnServiceMock },
        provideToastServiceMock(toastServiceMock),
      ],
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.removeItem(promptPreferenceId);
    localStorage.removeItem(promptDismissedDateId);
    vi.restoreAllMocks();
  });

  describe('applicant sessions', () => {
    beforeEach(() => {
      // No Keycloak client is active, so the account's passkeys live in the application, not the realm.
      keycloakAuthenticationServiceMock.isLoggedIn.mockReturnValue(false);
    });

    it('should read passkeys from the application rather than Keycloak', async () => {
      await createComponent();

      expect(webAuthnServiceMock.list).toHaveBeenCalledOnce();
      expect(keycloakAuthenticationServiceMock.listPasskeys).not.toHaveBeenCalled();
    });

    it('should report a failed registration rather than swallowing it', async () => {
      webAuthnServiceMock.register.mockRejectedValue(new Error('registration rejected'));
      await createComponent();

      await component.registerPasskey();

      expect(toastServiceMock.showErrorKey).toHaveBeenCalledOnce();
    });

    it('should register a passkey in the application rather than Keycloak', async () => {
      await createComponent();

      await component.registerPasskey();

      expect(webAuthnServiceMock.register).toHaveBeenCalledOnce();
      expect(authFacadeMock.registerPasskey).not.toHaveBeenCalled();
    });
  });

  it('should show the prompt when user is logged in and has no passkeys', async () => {
    keycloakAuthenticationServiceMock.listPasskeys.mockResolvedValue([]);

    await createComponent();

    expect(keycloakAuthenticationServiceMock.listPasskeys).toHaveBeenCalledOnce();
    expect(component.visible()).toBe(true);
  });

  it('should keep the prompt hidden when passkeys are already configured', async () => {
    keycloakAuthenticationServiceMock.listPasskeys.mockResolvedValue([{ id: 'pk-1', label: 'Laptop' }]);

    await createComponent();

    expect(keycloakAuthenticationServiceMock.listPasskeys).toHaveBeenCalledOnce();
    expect(component.visible()).toBe(false);
  });

  it('should not evaluate prompt when hidden by stored preference', async () => {
    localStorage.setItem(promptPreferenceId, 'true');

    await createComponent();

    expect(keycloakAuthenticationServiceMock.listPasskeys).not.toHaveBeenCalled();
    expect(component.visible()).toBe(false);
  });

  it('should persist preference and close when neverAskAgain is enabled', async () => {
    await createComponent();
    component.neverAskAgain.set(true);

    component.close();

    expect(localStorage.getItem(promptPreferenceId)).toBe('true');
    expect(component.visible()).toBe(false);
  });

  it('should register passkey, hide prompt and reset busy state', async () => {
    await createComponent();

    await component.registerPasskey();

    expect(authFacadeMock.registerPasskey).toHaveBeenCalledOnce();
    expect(component.busy()).toBe(false);
    expect(component.visible()).toBe(false);
  });

  it('should not evaluate prompt when dismissed on the same day', async () => {
    localStorage.setItem(promptDismissedDateId, new Date().toISOString().slice(0, 10));

    await createComponent();

    expect(keycloakAuthenticationServiceMock.listPasskeys).not.toHaveBeenCalled();
    expect(component.visible()).toBe(false);
  });
});
