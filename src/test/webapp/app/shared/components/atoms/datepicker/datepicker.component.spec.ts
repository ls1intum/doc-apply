import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatePickerComponent } from 'app/shared/components/atoms/datepicker/datepicker.component';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { createTranslateServiceMock, provideTranslateMock } from 'util/translate.mock';

describe('DatePickerComponent', () => {
  let translateMock: ReturnType<typeof createTranslateServiceMock>;

  const createFixture = (inputs: Record<string, unknown> = {}): ComponentFixture<DatePickerComponent> => {
    const fixture = TestBed.createComponent(DatePickerComponent);
    Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    fixture.detectChanges();
    return fixture;
  };

  const textField = (fixture: ComponentFixture<DatePickerComponent>): HTMLInputElement => {
    const root: HTMLElement = fixture.nativeElement;
    const field = root.querySelector<HTMLInputElement>('input[type="text"]');
    if (field === null) {
      throw new Error('date field not rendered');
    }
    return field;
  };

  const openCalendar = async (fixture: ComponentFixture<DatePickerComponent>): Promise<HTMLElement> => {
    const root: HTMLElement = fixture.nativeElement;
    root.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const panel = document.querySelector<HTMLElement>('[role="dialog"]');
    if (panel === null) {
      throw new Error('calendar not rendered');
    }
    return panel;
  };

  const dayButton = (panel: HTMLElement, isoDate: string): HTMLButtonElement => {
    const button = panel.querySelector<HTMLButtonElement>(`[data-date="${isoDate}"]`);
    if (button === null) {
      throw new Error(`day ${isoDate} not rendered`);
    }
    return button;
  };

  const typeDate = (fixture: ComponentFixture<DatePickerComponent>, text: string): void => {
    const field = textField(fixture);
    field.value = text;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    translateMock = createTranslateServiceMock();
    await TestBed.configureTestingModule({
      imports: [DatePickerComponent],
      providers: [provideFontAwesomeTesting(), provideTranslateMock(translateMock)],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.querySelectorAll('.cdk-overlay-container').forEach(container => container.remove());
  });

  describe('Displaying the value', () => {
    it('should show the selected date in the English format', () => {
      const fixture = createFixture({ selectedDate: '2024-10-13' });

      expect(textField(fixture).value).toBe('13/10/2024');
    });

    it('should switch to the German format when the language changes', () => {
      const fixture = createFixture({ selectedDate: '2024-10-13' });

      translateMock.use('de');
      fixture.detectChanges();

      expect(textField(fixture).value).toBe('13.10.2024');
    });

    it.each(['1800-10-13', '2024-13-13', '2024-10-32', '2024-abc-13', '2024-10', 'invalid-date-format'])(
      'should leave the field empty for the invalid value %s',
      value => {
        const fixture = createFixture({ selectedDate: value });

        expect(textField(fixture).value).toBe('');
      },
    );
  });

  describe('Picking from the calendar', () => {
    it('should name months and weekdays in the active language', async () => {
      translateMock.use('de');
      const fixture = createFixture({ selectedDate: '2030-03-10' });

      const panel = await openCalendar(fixture);
      const selectedMonth = panel.querySelector<HTMLSelectElement>('select');
      const firstWeekday = panel.querySelector('th');

      expect(selectedMonth?.selectedOptions[0].textContent?.trim()).toBe('März');
      expect(firstWeekday?.getAttribute('aria-label')).toBe('Montag');
    });

    it('should emit the clicked day as an ISO date and close the calendar', async () => {
      const fixture = createFixture({ selectedDate: '2030-03-10' });
      const emitSpy = vi.spyOn(fixture.componentInstance.selectedDateChange, 'emit');

      const panel = await openCalendar(fixture);
      dayButton(panel, '2030-03-21').click();
      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledOnce();
      expect(emitSpy).toHaveBeenCalledWith('2030-03-21');
      expect(textField(fixture).value).toBe('21/03/2030');
      expect(fixture.componentInstance.isCalendarOpen()).toBe(false);
    });

    it('should ignore days before today when no minimum date is set', async () => {
      const fixture = createFixture();
      const emitSpy = vi.spyOn(fixture.componentInstance.selectedDateChange, 'emit');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const isoYesterday = [
        yesterday.getFullYear(),
        String(yesterday.getMonth() + 1).padStart(2, '0'),
        String(yesterday.getDate()).padStart(2, '0'),
      ].join('-');

      const panel = await openCalendar(fixture);
      fixture.componentInstance.shiftMonth(-1);
      fixture.componentInstance.shiftMonth(1);
      fixture.detectChanges();
      dayButton(panel, isoYesterday).click();

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should ignore days after the maximum date', async () => {
      const fixture = createFixture({
        minDate: new Date(2030, 2, 1),
        maxDate: new Date(2030, 2, 15),
        defaultDate: new Date(2030, 2, 10),
      });
      const emitSpy = vi.spyOn(fixture.componentInstance.selectedDateChange, 'emit');

      const panel = await openCalendar(fixture);
      dayButton(panel, '2030-03-20').click();

      expect(dayButton(panel, '2030-03-20').getAttribute('aria-disabled')).toBe('true');
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should open on the default date when nothing is selected', async () => {
      const fixture = createFixture({ minDate: new Date(1900, 0, 1), defaultDate: new Date(2000, 0, 1) });

      const panel = await openCalendar(fixture);
      const selects = panel.querySelectorAll<HTMLSelectElement>('select');

      expect(selects[0].selectedOptions[0].textContent?.trim()).toBe('January');
      expect(selects[1].value).toBe('2000');
    });

    it('should mark the highlighted reference date', async () => {
      const fixture = createFixture({
        selectedDate: '2030-03-10',
        highlightedDate: new Date(2030, 2, 18),
        highlightedDateLabel: 'reference.label',
      });

      const panel = await openCalendar(fixture);

      expect(dayButton(panel, '2030-03-18').className).toContain('ring-primary-default');
      expect(dayButton(panel, '2030-03-17').className).not.toContain('ring-primary-default');
    });

    it('should emit undefined when the date is cleared', async () => {
      const fixture = createFixture({ selectedDate: '2030-03-10' });
      const emitSpy = vi.spyOn(fixture.componentInstance.selectedDateChange, 'emit');

      await openCalendar(fixture);
      fixture.componentInstance.clearDate();
      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledWith(undefined);
      expect(textField(fixture).value).toBe('');
    });

    it('should move the focused day with the arrow keys and change month at the edge', async () => {
      const fixture = createFixture({ selectedDate: '2030-03-31' });

      const panel = await openCalendar(fixture);
      dayButton(panel, '2030-03-31').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      fixture.detectChanges();

      expect(dayButton(panel, '2030-04-01').getAttribute('tabindex')).toBe('0');
      expect(panel.querySelector<HTMLSelectElement>('select')?.selectedOptions[0].textContent?.trim()).toBe('April');
    });
  });

  describe('Typing a date', () => {
    it('should emit a typed date on blur', () => {
      const fixture = createFixture({ minDate: new Date(1900, 0, 1) });
      const emitSpy = vi.spyOn(fixture.componentInstance.selectedDateChange, 'emit');

      typeDate(fixture, '5/6/2001');

      expect(emitSpy).toHaveBeenCalledWith('2001-06-05');
      expect(textField(fixture).value).toBe('05/06/2001');
    });

    it('should restore the committed date when the typed text is no allowed date', () => {
      const fixture = createFixture({ selectedDate: '2030-03-10' });
      const emitSpy = vi.spyOn(fixture.componentInstance.selectedDateChange, 'emit');

      typeDate(fixture, '31.02.2030');

      expect(emitSpy).not.toHaveBeenCalled();
      expect(textField(fixture).value).toBe('10/03/2030');
    });

    it('should clear the date when the text is removed', () => {
      const fixture = createFixture({ selectedDate: '2030-03-10' });
      const emitSpy = vi.spyOn(fixture.componentInstance.selectedDateChange, 'emit');

      typeDate(fixture, '');

      expect(emitSpy).toHaveBeenCalledOnce();
      expect(emitSpy).toHaveBeenCalledWith(undefined);
    });
  });
});
