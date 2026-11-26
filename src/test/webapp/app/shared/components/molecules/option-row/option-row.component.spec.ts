import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { OptionRowComponent } from 'app/shared/components/molecules/option-row/option-row.component';
import { provideTranslateMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { getRequiredButton } from 'util/utility-methods/dom-query.util';

describe('OptionRowComponent', () => {
  let fixture: ComponentFixture<OptionRowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OptionRowComponent],
      providers: [provideTranslateMock(), provideFontAwesomeTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(OptionRowComponent);
    fixture.componentRef.setInput('titleKey', 'option.title');
    fixture.componentRef.setInput('descriptionKey', 'option.description');
    fixture.detectChanges();
  });

  it.each([
    [false, true],
    [true, false],
  ])('should switch the option from %s to %s when the row is clicked', async (initial, expected) => {
    fixture.componentRef.setInput('checked', initial);
    fixture.detectChanges();
    const emitted: boolean[] = [];
    fixture.componentInstance.checked.subscribe(value => emitted.push(value));

    const row = getRequiredButton(fixture.nativeElement, 'button[role="checkbox"]');
    row.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(emitted).toEqual([expected]);
    expect(row.getAttribute('aria-checked')).toBe(String(expected));
  });
});
