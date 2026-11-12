import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StringInputComponent } from 'app/shared/components/atoms/string-input/string-input.component';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

describe('StringInputComponent', () => {
  function createFixture() {
    const fixture = TestBed.createComponent(StringInputComponent);
    fixture.componentRef.setInput('label', 'Test Label');
    fixture.componentRef.setInput('placeholder', 'Enter value');
    fixture.componentRef.setInput('required', true);
    fixture.componentRef.setInput('id', 'testInput');
    fixture.componentRef.setInput('width', '300px');
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StringInputComponent, ReactiveFormsModule],
      providers: [provideFontAwesomeTesting(), provideTranslateMock()],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call onInputChange and emit modelChange with new value', () => {
    const fixture = createFixture();
    const comp = fixture.componentInstance;
    const emitSpy = vi.spyOn(comp.modelChange, 'emit');
    const mockCtrl = new FormControl('');
    vi.spyOn(comp, 'formControl').mockReturnValue(mockCtrl);

    comp.onInputChange('Hello');
    expect(emitSpy).toHaveBeenCalledWith('Hello');
    expect(mockCtrl.value).toBe('Hello');
    expect(mockCtrl.dirty).toBe(true);
  });

  it.each<[boolean]>([[true], [false]])('should focus the field after rendering only when autofocus=%s', async autofocus => {
    const fixture = createFixture();
    fixture.componentRef.setInput('autofocus', autofocus);
    fixture.detectChanges();
    await fixture.whenStable();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(document.activeElement === input).toBe(autofocus);
  });

  it('should show the field as invalid once a required control was blurred empty', () => {
    const fixture = createFixture();
    const ctrl = new FormControl('', { validators: c => (c.value === '' ? { required: true } : null) });
    fixture.componentRef.setInput('control', ctrl);
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('aria-invalid')).toBeNull();

    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.querySelector('.error-text').textContent.trim()).toBe('global.input.error.required');
  });

  describe('BaseInputDirective - isTouched computed property', () => {
    it('should return false when input has not been touched and control has no errors', () => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;
      const ctrl = new FormControl('');
      fixture.componentRef.setInput('control', ctrl);

      expect(comp.isTouched()).toBe(false);
    });

    it('should return true when input has been blurred (onBlur called)', () => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;
      fixture.detectChanges();
      comp.onBlur();
      fixture.detectChanges();

      expect(comp.isTouched()).toBe(true);
    });

    it('should pick up a control that is already touched when it is bound', () => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;
      const ctrl = new FormControl('', []);
      ctrl.setErrors({ required: true });
      ctrl.markAsTouched();

      fixture.componentRef.setInput('control', ctrl);
      fixture.detectChanges();

      expect(comp.isTouched()).toBe(true);
    });
  });

  describe('BaseInputDirective - inputState computed property', () => {
    it.each<['untouched' | 'invalid' | 'valid', string, ((c: any) => any) | undefined, boolean]>([
      ['untouched', 'valid value', undefined, false],
      ['invalid', '', c => (c.value === '' ? { required: true } : null), true],
      ['valid', 'valid value', undefined, true],
    ])('should return %s for %s value with blur=%s', (expected, value, validator, blur) => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;
      const ctrl = new FormControl(value, validator ? { validators: validator } : {});
      fixture.componentRef.setInput('control', ctrl);
      fixture.detectChanges();
      if (blur) {
        comp.onBlur();
        fixture.detectChanges();
      }

      expect(comp.inputState()).toBe(expected);
    });
  });

  describe('BaseInputDirective - errorMessage computed property', () => {
    it('should return null when control has no errors', () => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;
      const ctrl = new FormControl('valid value');
      fixture.componentRef.setInput('control', ctrl);

      expect(comp.errorMessage()).toBeNull();
    });

    it('should return minlength/maxlength/required/unknown error messages from control errors', () => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;

      const minCtrl = new FormControl('ab', {
        validators: c => (c.value.length < 5 ? { minlength: { requiredLength: 5, actualLength: 2 } } : null),
      });
      fixture.componentRef.setInput('control', minCtrl);
      expect(comp.errorMessage()).toBe('global.input.error.minLength');

      const maxCtrl = new FormControl('toolongvalue', {
        validators: c => (c.value.length > 5 ? { maxlength: { requiredLength: 5, actualLength: 12 } } : null),
      });
      fixture.componentRef.setInput('control', maxCtrl);
      expect(comp.errorMessage()).toBe('global.input.error.maxLength');

      const requiredCtrl = new FormControl('');
      requiredCtrl.setErrors({ required: true });
      fixture.componentRef.setInput('control', requiredCtrl);
      fixture.componentRef.setInput('required', true);
      expect(comp.errorMessage()).toBe('global.input.error.required');

      const customCtrl = new FormControl('test', { validators: () => ({ customUnknownError: true }) });
      fixture.componentRef.setInput('control', customCtrl);
      fixture.detectChanges();
      expect(comp.errorMessage()).toBe('Invalid: customUnknownError');
    });
  });

  describe('BaseInputDirective - focus/blur handlers', () => {
    it('should toggle isFocused on onFocus and onBlur, and mark touched on blur', () => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;

      comp.onFocus();
      expect(comp.isFocused()).toBe(true);

      comp.onBlur();
      expect(comp.isFocused()).toBe(false);
      expect(comp.isTouched()).toBe(true);
    });
  });

  describe('BaseInputDirective - form control status changes', () => {
    it('should update formValidityVersion when form control status changes', () => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;
      const ctrl = new FormControl('', { validators: c => (c.value === '' ? { required: true } : null), updateOn: 'change' });
      fixture.componentRef.setInput('control', ctrl);

      const initialVersion = comp.formValidityVersion();
      comp.isTouched(); // Access to trigger computation
      fixture.detectChanges();

      ctrl.setValue('new value');
      fixture.detectChanges();

      // The computed property should have been recalculated
      expect(comp.formValidityVersion()).toBeGreaterThan(initialVersion);
    });
  });
});
