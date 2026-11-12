import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';

import { PasswordInputComponent } from 'app/shared/components/atoms/password-input/password-input';

type PasswordInputComponentTestInstance = Omit<
  PasswordInputComponent,
  'formControl' | 'inputState' | 'isFocused' | 'errorMessage' | 'tooltipText'
> & {
  formControl?: () => FormControl<string | null>;
  inputState?: () => 'untouched' | 'valid' | 'invalid' | string;
  isFocused?: () => boolean;
  errorMessage?: () => string | null;
  tooltipText?: () => string | undefined;
};

describe('PasswordInputComponent', () => {
  const getFormControl = (component: PasswordInputComponentTestInstance) => {
    if (!component.formControl) {
      throw new Error('formControl is not defined on PasswordInputComponent');
    }

    return component.formControl();
  };

  function createComponent(runInitialDetect = true) {
    const fixture = TestBed.createComponent(PasswordInputComponent);
    const component = fixture.componentInstance as PasswordInputComponentTestInstance;

    if (!component.formControl || component.formControl() == null) {
      const ctrl = new FormControl('');
      component.formControl = () => ctrl;
    }

    if (runInitialDetect) {
      fixture.detectChanges();
    }

    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordInputComponent],
      providers: [provideFontAwesomeTesting(), provideTranslateMock()],
    }).compileComponents();
  });

  it('should emit modelChange and update form control on input change', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as PasswordInputComponentTestInstance;

    const emitSpy = vi.spyOn(component.modelChange, 'emit');
    const value = 'MySecurePassword123!';

    component.onInputChange(value);

    const ctrl = getFormControl(component);
    expect(ctrl.value).toBe(value);
    expect(ctrl.dirty).toBe(true);
    expect(emitSpy).toHaveBeenCalledWith(value);
  });

  it('should wire template events to component methods', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as PasswordInputComponentTestInstance;

    const changeSpy = vi.spyOn(component, 'onInputChange');
    const blurSpy = vi.spyOn(component, 'onBlur');
    const focusSpy = vi.spyOn(component, 'onFocus');

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[tumAetUiInput]');
    input.value = 'test123';
    input.dispatchEvent(new Event('input'));
    expect(changeSpy).toHaveBeenCalledWith('test123');

    input.dispatchEvent(new Event('focus'));
    expect(focusSpy).toHaveBeenCalledOnce();

    input.dispatchEvent(new Event('blur'));
    expect(blurSpy).toHaveBeenCalledOnce();
  });

  it('should toggle between masked and plain text when the visibility button is clicked', () => {
    const fixture = createComponent();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[tumAetUiInput]');
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('button');

    expect(input.type).toBe('password');
    expect(toggle.getAttribute('aria-label')).toBe('auth.common.password.show');

    toggle.click();
    fixture.detectChanges();
    expect(input.type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('auth.common.password.hide');

    toggle.click();
    fixture.detectChanges();
    expect(input.type).toBe('password');
  });

  it.each<[string, string]>([
    ['', 'auth.common.password.prompt'],
    ['abc', 'auth.common.password.weakLabel'],
    ['abc123', 'auth.common.password.mediumLabel'],
    ['Abcdef12', 'auth.common.password.strongLabel'],
  ])('should rate %o with the strength label %s while focused', (value, expectedKey) => {
    const fixture = createComponent();
    fixture.componentRef.setInput('showStrength', true);
    const component = fixture.componentInstance as PasswordInputComponentTestInstance;

    component.onFocus();
    component.onInputChange(value);
    fixture.detectChanges();

    const label: HTMLElement = fixture.nativeElement.querySelector('[aria-live="polite"] .text-sm');
    expect(label.textContent?.trim()).toBe(expectedKey);
  });

  it('should hide the strength panel when the field is not focused', () => {
    const fixture = createComponent();
    fixture.componentRef.setInput('showStrength', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[aria-live="polite"]')).toBeNull();
  });
});
