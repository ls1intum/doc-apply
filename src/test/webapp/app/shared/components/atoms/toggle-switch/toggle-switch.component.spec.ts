import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToggleSwitchComponent } from 'app/shared/components/atoms/toggle-switch/toggle-switch.component';

describe('ToggleSwitchComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ToggleSwitchComponent] }).compileComponents();
  });

  it('should emit the new state when the switch is toggled', async () => {
    const fixture = TestBed.createComponent(ToggleSwitchComponent);
    fixture.componentRef.setInput('model', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const emitSpy = vi.spyOn(fixture.componentInstance.modelChange, 'emit');

    const root: HTMLElement = fixture.nativeElement;
    const input = root.querySelector<HTMLInputElement>('input[role="switch"]');
    expect(input?.checked).toBe(true);
    input?.click();

    expect(emitSpy).toHaveBeenCalledOnce();
    expect(emitSpy).toHaveBeenCalledWith(false);
  });
});
