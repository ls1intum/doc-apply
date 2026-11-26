import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { StatusPillComponent } from 'app/shared/components/atoms/status-pill/status-pill.component';
import { provideTranslateMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';

describe('StatusPillComponent', () => {
  it.each([
    { count: 2, interactive: true, expectedSelections: 1 },
    { count: 0, interactive: true, expectedSelections: 0 },
    { count: 2, interactive: false, expectedSelections: 0 },
  ])(
    'should emit selected $expectedSelections time(s) when a pill with $count items and interactive $interactive is clicked',
    async ({ count, interactive, expectedSelections }) => {
      await TestBed.configureTestingModule({
        imports: [StatusPillComponent],
        providers: [provideTranslateMock(), provideFontAwesomeTesting()],
      }).compileComponents();
      const fixture = TestBed.createComponent(StatusPillComponent);
      fixture.componentRef.setInput('labelKey', 'label');
      fixture.componentRef.setInput('dotColor', 'bg-negative-default');
      fixture.componentRef.setInput('count', count);
      fixture.componentRef.setInput('interactive', interactive);
      const selected = vi.fn();
      fixture.componentInstance.selected.subscribe(selected);
      fixture.detectChanges();

      const pill: HTMLElement = fixture.nativeElement.firstElementChild;
      pill.click();

      expect(selected).toHaveBeenCalledTimes(expectedSelections);
      expect(pill.tagName).toBe(interactive ? 'BUTTON' : 'DIV');
    },
  );
});
