import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NumberInputComponent } from 'app/shared/components/atoms/number-input/number-input.component';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

describe('NumberInputComponent', () => {
  function createFixture() {
    const fixture = TestBed.createComponent(NumberInputComponent);
    fixture.componentRef.setInput('label', 'Test Number');
    fixture.componentRef.setInput('min', 0);
    fixture.componentRef.setInput('max', 10);
    fixture.componentRef.setInput('maxFractionDigits', 2);
    fixture.componentRef.setInput('id', 'numInput');
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NumberInputComponent, ReactiveFormsModule],
      providers: [provideFontAwesomeTesting(), provideTranslateMock()],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should emit modelChange and update form control on input change', () => {
    const fixture = createFixture();
    const comp = fixture.componentInstance;
    const spyEmit = vi.spyOn(comp.modelChange, 'emit');
    const mockCtrl = new FormControl(0);
    vi.spyOn(comp, 'formControl').mockReturnValue(mockCtrl);

    comp.onInputChange(5);
    expect(spyEmit).toHaveBeenCalledWith(5);
    expect(mockCtrl.value).toBe(5);
    expect(mockCtrl.dirty).toBe(true);
  });

  it('should forward focus, blur and typed numbers from the kit field', () => {
    const fixture = createFixture();
    const comp = fixture.componentInstance;
    const emitSpy = vi.spyOn(comp.modelChange, 'emit');
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[role="spinbutton"]');

    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(comp.isFocused()).toBe(true);

    input.value = '7';
    input.dispatchEvent(new Event('input'));
    expect(emitSpy).toHaveBeenCalledWith(7);

    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(comp.isFocused()).toBe(false);
    expect(comp.isTouched()).toBe(true);
  });

  it('should mark smallerThanMin and largerThanMax correctly', async () => {
    const fixture = createFixture();
    const comp = fixture.componentInstance;

    fixture.componentRef.setInput('model', -1);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(comp.smallerThanMin()).toBe(true);

    fixture.componentRef.setInput('model', 15);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(comp.largerThanMax()).toBe(true);
  });

  it.each<[number | null | undefined, Record<string, unknown> | null]>([
    [-2, { min: { min: 0, actual: -2 } }],
    [20, { max: { max: 10, actual: 20 } }],
    [5, null],
    [null, null],
    [undefined, null],
  ])('should validate value %s', (value, expectedErrors) => {
    const fixture = createFixture();
    const ctrl = new FormControl(0);
    fixture.componentInstance['validateMinMax'](value, ctrl);
    expect(ctrl.errors).toEqual(expectedErrors);
  });

  it('should not show validation errors when model is undefined', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('model', undefined);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    expect(comp.smallerThanMin()).toBe(false);
    expect(comp.largerThanMax()).toBe(false);
  });
});
