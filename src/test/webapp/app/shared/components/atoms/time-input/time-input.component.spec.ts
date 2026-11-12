import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TimeInputComponent } from 'app/shared/components/atoms/time-input/time-input.component';

describe('TimeInputComponent', () => {
  let fixture: ComponentFixture<TimeInputComponent>;

  const getInput = (): HTMLInputElement => fixture.nativeElement.querySelector('input');

  const typeInto = (value: string): void => {
    const input = getInput();
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimeInputComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TimeInputComponent);
    fixture.componentRef.setInput('id', 'start-1');
    fixture.detectChanges();
  });

  it.each<[string, string, string]>([
    ['9', '9', '9-:--'],
    ['093', '09:3', '09:3-'],
    ['0930', '09:30', '09:30'],
    ['09:30', '09:30', '09:30'],
    ['12a:4x5', '12:45', '12:45'],
    ['123456', '12:34', '12:34'],
  ])('should format typed %o as %o and emit %o', (typed, shown, emitted) => {
    const emitSpy = vi.spyOn(fixture.componentInstance.valueChange, 'emit');

    typeInto(typed);

    expect(getInput().value).toBe(shown);
    expect(emitSpy).toHaveBeenCalledWith(emitted);
  });

  it('should emit an empty string when the field is cleared', () => {
    const emitSpy = vi.spyOn(fixture.componentInstance.valueChange, 'emit');

    typeInto('');

    expect(emitSpy).toHaveBeenCalledWith('');
  });

  it.each<[string, string]>([
    ['14:15', '14:15'],
    ['14:1-', '14:1'],
    ['', ''],
  ])('should show the bound value %o as %o', (value, shown) => {
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();

    expect(getInput().value).toBe(shown);
  });

  it('should use the given id and disabled state on the field', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    expect(getInput().id).toBe('start-1');
    expect(getInput().disabled).toBe(true);
  });
});
