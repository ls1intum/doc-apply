import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';

import { provideTranslateMock } from 'util/translate.mock';
import { createToastServiceMock, provideToastServiceMock, ToastServiceMock } from '../../../../../util/toast-service.mock';
import { AuthFacadeServiceMock, createAuthFacadeServiceMock, provideAuthFacadeServiceMock } from 'util/auth-facade.service.mock';
import { AuthOrchestratorServiceMock, provideAuthOrchestratorServiceMock } from 'util/auth-orchestrator.service.mock';

import { Login } from 'app/shared/components/organisms/login/login';
import { createAuthOrchestratorServiceMock } from '../../../../../util/auth-orchestrator.service.mock';
import { provideFontAwesomeTesting } from '../../../../../util/fontawesome.testing';
import { provideDynamicDialogConfigMock } from '../../../../../util/dynamicdialogref.mock';
import {
  ApplicationConfigServiceMock,
  createApplicationConfigServiceMock,
  provideApplicationConfigServiceMock,
} from '../../../../../util/application-config.service.mock';

describe('Login Component', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  let authFacade: AuthFacadeServiceMock;
  let authOrchestrator: AuthOrchestratorServiceMock;
  let toastService: ToastServiceMock;
  let applicationConfigService: ApplicationConfigServiceMock;

  beforeEach(async () => {
    authFacade = createAuthFacadeServiceMock();
    authOrchestrator = createAuthOrchestratorServiceMock();
    toastService = createToastServiceMock();
    applicationConfigService = createApplicationConfigServiceMock();

    TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideAuthFacadeServiceMock(authFacade),
        provideToastServiceMock(toastService),
        provideTranslateMock(),
        provideAuthOrchestratorServiceMock(authOrchestrator),
        provideFontAwesomeTesting(),
        provideDynamicDialogConfigMock(),
        provideApplicationConfigServiceMock(applicationConfigService),
      ],
    });

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;

    authOrchestrator.loginStep = signal('email');
    authOrchestrator.email = signal('');

    fixture.detectChanges();
  });

  describe('login steps', () => {
    it('should show password fields when login step is "password" and OTP input when step is "otp"', () => {
      authOrchestrator.loginStep.set('password');
      fixture.detectChanges();
      expect(component.showPassword()).toBe(true);

      authOrchestrator.loginStep.set('otp');
      fixture.detectChanges();
      expect(fixture.debugElement.query(de => de.name === 'jhi-otp-input')).toBeTruthy();
      expect(fixture.debugElement.query(de => de.name === 'jhi-credentials-group')).toBeFalsy();
    });
  });

  describe('submitHandler', () => {
    it('should request OTP on submit when in email step', async () => {
      const email = 'test@example.com';
      const requestOtpSpy = vi.spyOn(authFacade, 'requestOtp').mockResolvedValue(undefined);

      const result = await component.submitHandler(email);

      expect(authOrchestrator.email()).toBe(email);
      expect(requestOtpSpy).toHaveBeenCalledOnce();
      expect(result).toBe(true);
    });

    it('should attempt email login on submit when in password step', async () => {
      authOrchestrator.loginStep.set('password');
      fixture.detectChanges();

      const email = 'test@example.com';
      const test_pw = 'password123';
      const loginSpy = vi.spyOn(component, 'onEmailLogin').mockResolvedValue(true);

      await component.submitHandler(email, test_pw);

      expect(loginSpy).toHaveBeenCalledWith(email, test_pw);
    });
  });

  describe('navigation', () => {
    it('should switch to password step on second button click', () => {
      const setStepSpy = vi.spyOn(authOrchestrator.loginStep, 'set');
      component.secondButtonHandler();
      expect(setStepSpy).toHaveBeenCalledWith('password');
    });

    it('should go to previous step on back button click', () => {
      const previousStepSpy = vi.spyOn(authOrchestrator, 'previousStep');
      component.backButtonHandler();
      expect(previousStepSpy).toHaveBeenCalledOnce();
    });

    it('should call orchestrator to switch to register view', () => {
      const switchToRegisterSpy = vi.spyOn(authOrchestrator, 'switchToRegister');
      const registerButton = fixture.debugElement.query(
        de => de.nativeElement?.tagName === 'BUTTON' && de.attributes['jhiTranslate'] === 'auth.login.texts.accountMissing.link',
      );
      registerButton.triggerEventHandler('click', null);

      expect(switchToRegisterSpy).toHaveBeenCalledOnce();
    });
  });

  describe('onEmailLogin', () => {
    it('should return false without calling loginWithEmail when password is missing', async () => {
      expect(await component.onEmailLogin('test@example.com')).toBe(false);
    });

    it.each<[boolean, boolean, number]>([
      [true, true, 0],
      [false, false, 1],
    ])('should return %s and call showError %i times when loginWithEmail returns %s', async (loginResult, expectedReturn, errorCount) => {
      vi.spyOn(authFacade, 'loginWithEmail').mockResolvedValue(loginResult);
      const showErrorSpy = vi.spyOn(toastService, 'showError');

      expect(await component.onEmailLogin('test@example.com', 'password')).toBe(expectedReturn);
      expect(showErrorSpy).toHaveBeenCalledTimes(errorCount);
    });
  });
});
