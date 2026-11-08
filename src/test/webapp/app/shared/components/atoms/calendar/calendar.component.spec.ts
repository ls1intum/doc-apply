import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CalendarComponent } from 'app/shared/components/atoms/calendar/calendar.component';
import { provideTranslateMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';

describe('CalendarComponent', () => {
  let fixture: ComponentFixture<CalendarComponent>;
  let component: CalendarComponent;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 3, 15, 10, 30));

    await TestBed.configureTestingModule({
      imports: [CalendarComponent],
      providers: [provideTranslateMock(), provideFontAwesomeTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function dayButton(dayOfMonth: number): HTMLButtonElement {
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('tbody button'));
    const match = buttons.find(button => button.getAttribute('aria-label')?.includes(`April ${dayOfMonth},`));
    if (match === undefined) {
      throw new Error(`No button for 2026-04-${dayOfMonth}`);
    }
    return match;
  }

  function navigationButtons(): HTMLButtonElement[] {
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    return buttons.filter(button => button.closest('table') === null);
  }

  it('should start the grid on the Monday before the first of the month', () => {
    const firstCell: HTMLButtonElement = fixture.nativeElement.querySelector('tbody button');

    expect(firstCell.getAttribute('aria-label')).toContain('Monday, March 30, 2026');
  });

  it('should add a clicked day to the picked days', () => {
    const emitSpy = vi.spyOn(component.selectedDatesChange, 'emit');
    fixture.componentRef.setInput('selectedDates', [new Date(2026, 3, 10)]);
    fixture.detectChanges();

    dayButton(20).click();

    expect(emitSpy).toHaveBeenCalledExactlyOnceWith([new Date(2026, 3, 10), new Date(2026, 3, 20)]);
  });

  it('should remove a clicked day that was already picked', () => {
    const emitSpy = vi.spyOn(component.selectedDatesChange, 'emit');
    fixture.componentRef.setInput('selectedDates', [new Date(2026, 3, 10), new Date(2026, 3, 20)]);
    fixture.detectChanges();

    dayButton(20).click();

    expect(emitSpy).toHaveBeenCalledExactlyOnceWith([new Date(2026, 3, 10)]);
  });

  it('should disable days before the minimum date and the way back to earlier months', () => {
    fixture.componentRef.setInput('minDate', new Date(2026, 3, 15, 10, 30));
    fixture.detectChanges();
    const [previousMonth] = navigationButtons();

    expect(dayButton(14).disabled).toBe(true);
    expect(dayButton(15).disabled).toBe(false);
    expect(previousMonth.disabled).toBe(true);
  });

  it('should show the next month after clicking the next-month button', () => {
    const [, nextMonth] = navigationButtons();

    nextMonth.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('May 2026');
  });
});
