import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckboxComponent } from 'app/shared/components/atoms/checkbox/checkbox.component';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';

describe('CheckboxComponent', () => {
  const createFixture = (inputs: Record<string, unknown> = {}): ComponentFixture<CheckboxComponent> => {
    const fixture = TestBed.createComponent(CheckboxComponent);
    Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    fixture.detectChanges();
    return fixture;
  };

  const box = (fixture: ComponentFixture<CheckboxComponent>): HTMLInputElement => {
    const root: HTMLElement = fixture.nativeElement;
    const input = root.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (input === null) {
      throw new Error('checkbox not rendered');
    }
    return input;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckboxComponent],
      providers: [provideFontAwesomeTesting(), provideTranslateMock()],
    }).compileComponents();
  });

  it('should emit the new state when the box is clicked without a form control', () => {
    const fixture = createFixture({ model: false });
    const emitSpy = vi.spyOn(fixture.componentInstance.modelChange, 'emit');

    box(fixture).click();

    expect(emitSpy).toHaveBeenCalledOnce();
    expect(emitSpy).toHaveBeenCalledWith(true);
  });

  it('should write a click into the bound form control and mark it dirty', async () => {
    const control = new FormControl(false);
    const fixture = createFixture({ control });
    await fixture.whenStable();

    box(fixture).click();

    expect(control.value).toBe(true);
    expect(control.dirty).toBe(true);
  });

  it('should show the required error once the control is touched and invalid', async () => {
    const control = new FormControl(false, Validators.requiredTrue);
    control.markAsTouched();
    const fixture = createFixture({ control });
    await fixture.whenStable();
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('global.input.error.required');
  });

  it('should keep the box out of the tab order when the tab index is negative', () => {
    const fixture = createFixture({ tabIndex: -1 });

    expect(box(fixture).closest('[inert]')).not.toBeNull();
  });
});
