import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { provideTranslateMock } from 'util/translate.mock';
import { RatingGridComponent, RatingGridRow } from 'app/shared/components/atoms/rating-grid/rating-grid.component';
import { SelectOption } from 'app/shared/components/atoms/select/select.component';

const ROWS: RatingGridRow[] = [
  { key: 'motivation', labelKey: 'rows.motivation' },
  { key: 'communication', labelKey: 'rows.communication' },
];

const OPTIONS: SelectOption[] = [
  { name: 'options.low', value: 'LOW' },
  { name: 'options.medium', value: 'MEDIUM' },
  { name: 'options.high', value: 'HIGH' },
];

describe('RatingGridComponent', () => {
  const createFixture = (selected: Record<string, SelectOption | undefined> = {}) => {
    const fixture = TestBed.createComponent(RatingGridComponent);
    fixture.componentRef.setInput('rows', ROWS);
    fixture.componentRef.setInput('options', OPTIONS);
    fixture.componentRef.setInput('selected', selected);
    fixture.detectChanges();
    return fixture;
  };

  const radiosOf = (fixture: ReturnType<typeof createFixture>): NodeListOf<HTMLInputElement> =>
    (fixture.nativeElement as HTMLElement).querySelectorAll('input[type="radio"]');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RatingGridComponent],
      providers: [provideTranslateMock()],
    }).compileComponents();
  });

  it('should render one radio group per row with one radio per option', () => {
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('[role="radiogroup"]')).toHaveLength(ROWS.length);
    expect(radiosOf(fixture)).toHaveLength(ROWS.length * OPTIONS.length);
  });

  it('should emit the row key and the picked option when a radio is selected', () => {
    const fixture = createFixture();
    const emitSpy = vi.spyOn(fixture.componentInstance.selectedChange, 'emit');

    // Second row, second option: radios are rendered row by row in option order
    radiosOf(fixture)[OPTIONS.length + 1].click();

    expect(emitSpy).toHaveBeenCalledOnce();
    expect(emitSpy).toHaveBeenCalledWith({ key: 'communication', option: OPTIONS[1] });
  });

  it('should check exactly the radio matching each row selection, keeping rows independent', async () => {
    const fixture = createFixture({ motivation: OPTIONS[2], communication: OPTIONS[0] });
    await fixture.whenStable();
    fixture.detectChanges();

    const radios = radiosOf(fixture);
    const checkedStates = Array.from(radios).map(radio => radio.checked);

    expect(checkedStates).toEqual([false, false, true, true, false, false]);
  });
});
