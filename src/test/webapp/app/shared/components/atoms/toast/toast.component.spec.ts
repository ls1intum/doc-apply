import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastComponent } from 'app/shared/components/atoms/toast/toast.component';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';

describe('ToastComponent', () => {
  let fixture: ComponentFixture<ToastComponent>;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [ToastComponent],
      providers: [provideTranslateMock(), provideFontAwesomeTesting()],
    });
    fixture = TestBed.createComponent(ToastComponent);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function toastElements(): HTMLElement[] {
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    return Array.from(host.querySelectorAll<HTMLElement>('.pointer-events-auto'));
  }

  it('should show the summary and detail of each toast', () => {
    fixture.componentInstance.show({ severity: 'success', summary: 'Saved', detail: 'All good', life: 3000 });
    fixture.componentInstance.show({ severity: 'info', summary: 'Note', life: 3000 });

    const toasts = toastElements();

    expect(toasts).toHaveLength(2);
    expect(toasts[0].textContent).toContain('Saved');
    expect(toasts[0].textContent).toContain('All good');
    expect(toasts[1].textContent).toContain('Note');
  });

  it('should remove a toast once its life has passed', () => {
    fixture.componentInstance.show({ severity: 'info', summary: 'Short', life: 1000 });
    fixture.componentInstance.show({ severity: 'warn', summary: 'Long', life: 5000 });

    vi.advanceTimersByTime(1000);
    const toasts = toastElements();

    expect(toasts).toHaveLength(1);
    expect(toasts[0].textContent).toContain('Long');
  });

  it('should remove a toast when its close button is clicked', () => {
    fixture.componentInstance.show({ severity: 'success', summary: 'Saved', life: 3000 });

    toastElements()[0].querySelector<HTMLButtonElement>('button[aria-label="button.close"]')?.click();

    expect(toastElements()).toHaveLength(0);
  });

  it('should announce errors as alerts', () => {
    fixture.componentInstance.show({ severity: 'error', summary: 'Failed', life: 6000 });
    fixture.componentInstance.show({ severity: 'success', summary: 'Saved', life: 3000 });

    const toasts = toastElements();

    expect(toasts[0].getAttribute('role')).toBe('alert');
    expect(toasts[1].getAttribute('role')).toBeNull();
  });
});
