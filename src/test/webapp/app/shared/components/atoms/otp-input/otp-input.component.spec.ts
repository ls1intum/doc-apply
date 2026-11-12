import { TestBed } from '@angular/core/testing';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';

import { OtpInput } from 'app/shared/components/atoms/otp-input/otp-input';
import {
  ApplicationConfigServiceMock,
  createApplicationConfigServiceMock,
  provideApplicationConfigServiceMock,
} from '../../../../../util/application-config.service.mock';
import {
  AuthFacadeServiceMock,
  createAuthFacadeServiceMock,
  provideAuthFacadeServiceMock,
} from '../../../../../util/auth-facade.service.mock';
import { DialogDataMock, createDialogDataMock, provideDialogDataMock } from 'util/dialog-ref.mock';
import { InputOtpChangeEvent } from 'primeng/inputotp';

import {
  AuthOrchestratorServiceMock,
  createAuthOrchestratorServiceMock,
  provideAuthOrchestratorServiceMock,
} from '../../../../../util/auth-orchestrator.service.mock';
import { createToastServiceMock, provideToastServiceMock, ToastServiceMock } from '../../../../../util/toast-service.mock';

describe('OtpInput', () => {
  let applicationConfigMock: ApplicationConfigServiceMock;
  let authFacadeMock: AuthFacadeServiceMock;
  let authOrchestratorServiceMock: AuthOrchestratorServiceMock;
  let toastServiceMock: ToastServiceMock;
  let dialogDataMock: DialogDataMock;
  let breakpointState: Record<string, boolean>;

  const createInputOtpChangeEvent = (value: string | undefined): InputOtpChangeEvent => ({
    originalEvent: new Event('change'),
    value: value ?? null,
  });

  const createKeyboardEvent = (key: string, preventDefault: () => void): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key });
    Object.defineProperty(event, 'preventDefault', { value: preventDefault });
    return event;
  };

  const getIsRegistration = (component: OtpInput): boolean => component.getRegistrationFlag();

  const getFormControl = (component: OtpInput) => component.formControl();

  function createComponent() {
    const fixture = TestBed.createComponent(OtpInput);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    applicationConfigMock = createApplicationConfigServiceMock({
      otp: {
        length: 6,
        ttlSeconds: 90,
        resendCooldownSeconds: 60,
      },
    });
    authFacadeMock = createAuthFacadeServiceMock();
    authOrchestratorServiceMock = createAuthOrchestratorServiceMock();
    toastServiceMock = createToastServiceMock();
    breakpointState = {
      [Breakpoints.XLarge]: false,
      [Breakpoints.XSmall]: false,
      [Breakpoints.Small]: false,
    };
    dialogDataMock = createDialogDataMock();

    await TestBed.configureTestingModule({
      imports: [OtpInput],
      providers: [
        provideFontAwesomeTesting(),
        provideTranslateMock(),
        provideApplicationConfigServiceMock(applicationConfigMock),
        provideAuthFacadeServiceMock(authFacadeMock),
        provideToastServiceMock(toastServiceMock),
        provideAuthOrchestratorServiceMock(authOrchestratorServiceMock),
        provideDialogDataMock(dialogDataMock),
        {
          provide: BreakpointObserver,
          useValue: {
            observe: () => of({ breakpoints: breakpointState }),
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each<[boolean, boolean, 'large' | 'small' | null]>([
    [true, false, 'large'],
    [false, true, 'small'],
    [false, false, null],
  ])('should resolve otpSize when xLarge=%s xSmall=%s', (xLarge, xSmall, expected) => {
    breakpointState[Breakpoints.XLarge] = xLarge;
    breakpointState[Breakpoints.XSmall] = xSmall;
    breakpointState[Breakpoints.Small] = false;
    const fixture = createComponent();
    expect(fixture.componentInstance.otpSize()).toBe(expected);
  });

  it.each<[unknown, boolean, boolean]>([
    [{ registration: true }, false, true],
    [{}, true, true],
    [undefined, true, true],
  ])('should resolve registration flag from dialog data %o vs input %s', (dialogData, inputFlag, expected) => {
    dialogDataMock.data = dialogData;
    const fixture = createComponent();
    fixture.componentRef.setInput('registration', inputFlag);
    fixture.detectChanges();

    expect(getIsRegistration(fixture.componentInstance)).toBe(expected);
  });

  it('should normalize OTP input, mark control dirty for non-empty values, and reset to pristine on undefined', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component.onChange(createInputOtpChangeEvent('12$3'));
    fixture.detectChanges();

    const ctrl = getFormControl(component);
    expect(component.otpValue()).toBe('123');
    expect(ctrl.value).toBe('123');
    expect(ctrl.dirty).toBe(true);

    component.onChange(createInputOtpChangeEvent(undefined));
    fixture.detectChanges();

    expect(component.otpValue()).toBe('');
    expect(ctrl.value).toBe('');
    expect(ctrl.pristine).toBe(true);
  });

  it('should clear error on submit and only call verifyOtp when form is valid', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    const clearSpy = vi.spyOn(authOrchestratorServiceMock, 'clearError');

    component.onSubmit();
    expect(clearSpy).toHaveBeenCalledOnce();
    expect(authFacadeMock.verifyOtp).not.toHaveBeenCalled();

    component.onChange(createInputOtpChangeEvent('123456'));
    fixture.detectChanges();
    component.onSubmit();
    expect(authFacadeMock.verifyOtp).toHaveBeenCalledWith('123456', getIsRegistration(component));
  });

  it('should trigger submit when pressing Enter key and prevent default', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    const submitSpy = vi.spyOn(component, 'onSubmit');
    const preventDefault = vi.fn();

    component.onKeyDown(createKeyboardEvent('Enter', preventDefault));

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(submitSpy).toHaveBeenCalledOnce();
  });

  it.each<[string, boolean]>([
    ['Backspace', false],
    ['@', true],
    ['A', false],
  ])('should preventDefault=%s for key %s', (key, shouldPrevent) => {
    const fixture = createComponent();
    const preventDefault = vi.fn();

    fixture.componentInstance.onKeyDown(createKeyboardEvent(key, preventDefault));

    if (shouldPrevent) {
      expect(preventDefault).toHaveBeenCalledOnce();
    } else {
      expect(preventDefault).not.toHaveBeenCalled();
    }
  });

  it('should not resend OTP when disableResend is true (busy or cooldown)', () => {
    authOrchestratorServiceMock.isBusy.set(true);
    authOrchestratorServiceMock.cooldownSeconds.set(10);

    const fixture = createComponent();
    const component = fixture.componentInstance;

    component.onResend();

    expect(authFacadeMock.requestOtp).not.toHaveBeenCalled();
  });

  it('should resend OTP, clear errors and reset value when allowed', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component.onChange(createInputOtpChangeEvent('ABCD'));
    fixture.detectChanges();

    const registrationFlagBefore = getIsRegistration(component);

    const clearSpy = vi.spyOn(authOrchestratorServiceMock, 'clearError');

    component.onResend();

    const ctrl = getFormControl(component);
    expect(component.otpValue()).toBe('');
    expect(ctrl.value).toBe('');
    expect(ctrl.pristine).toBe(true);
    expect(clearSpy).toHaveBeenCalledOnce();
    expect(authFacadeMock.requestOtp).toHaveBeenCalledWith(registrationFlagBefore, true);
  });

  it('should derive disableResend and disabledSubmit from busy state', () => {
    let fixture = createComponent();
    expect(fixture.componentInstance.disableResend()).toBe(false);
    expect(fixture.componentInstance.disabledSubmit()).toBe(true);

    authOrchestratorServiceMock.isBusy.set(true);
    fixture = createComponent();
    expect(fixture.componentInstance.disableResend()).toBe(true);
    expect(fixture.componentInstance.disabledSubmit()).toBe(true);
  });

  it('should allow submit when OTP length is correct even if an error is present', () => {
    authOrchestratorServiceMock.isBusy.set(false);
    authOrchestratorServiceMock.error.set({ message: 'error' } as unknown as string);

    const fixture = createComponent();
    const component = fixture.componentInstance;

    // Error does not keep submit disabled when length is valid
    component.onChange(createInputOtpChangeEvent('123456'));
    fixture.detectChanges();

    expect(component.disabledSubmit()).toBe(false);
  });
});
