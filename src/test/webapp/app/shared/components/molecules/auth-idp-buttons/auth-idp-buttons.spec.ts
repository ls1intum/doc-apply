import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';
import { AuthIdpButtons } from 'app/shared/components/molecules/auth-idp-buttons/auth-idp-buttons';
import { IdpProvider } from 'app/core/auth/keycloak-authentication.service';
import {
  AuthFacadeServiceMock,
  createAuthFacadeServiceMock,
  provideAuthFacadeServiceMock,
} from '../../../../../util/auth-facade.service.mock';
import { signal } from '@angular/core';
import { AuthOrchestratorService } from 'app/core/auth/auth-orchestrator.service';

describe('AuthIdpButtons', () => {
  let authFacadeMock: AuthFacadeServiceMock;

  // Mock Orchestrator with just the signal we need
  const authOrchestratorMock = {
    redirectUri: signal<string | null>(null),
    showSocialLogin: signal<boolean>(false),
  } as unknown as AuthOrchestratorService;

  function createComponent() {
    const fixture = TestBed.createComponent(AuthIdpButtons);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    authFacadeMock = createAuthFacadeServiceMock();

    await TestBed.configureTestingModule({
      imports: [AuthIdpButtons],
      providers: [
        provideFontAwesomeTesting(),
        provideTranslateMock(),
        provideAuthFacadeServiceMock(authFacadeMock),
        { provide: AuthOrchestratorService, useValue: authOrchestratorMock },
      ],
    }).compileComponents();
  });

  it.each([
    [0, IdpProvider.Apple],
    [1, IdpProvider.Google],
  ])('should call loginWithSocialProvider with the right provider when button %i is clicked', (index, provider) => {
    const buttons = createComponent().componentInstance.idpButtons().buttons;
    expect(buttons).toHaveLength(2);

    buttons[index].onClick();

    expect(authFacadeMock.loginWithSocialProvider).toHaveBeenCalledWith(provider, false);
  });
});
