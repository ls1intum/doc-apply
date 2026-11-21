import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AccordionComponent, AccordionItem } from 'app/shared/components/molecules/accordion/accordion.component';
import { provideTranslateMock } from 'util/translate.mock';

const ITEMS: AccordionItem[] = [
  { value: 'login', title: 'faq.login.title', content: 'faq.login.content' },
  { value: 'documents', title: 'faq.documents.title', content: 'faq.documents.content' },
];

@Component({
  imports: [AccordionComponent],
  template: `
    <jhi-accordion [items]="items">
      <ng-template #footer let-item>
        <span class="test-footer">{{ item.value }}</span>
      </ng-template>
    </jhi-accordion>
  `,
})
class AccordionWithFooterHostComponent {
  readonly items = ITEMS;
}

describe('AccordionComponent', () => {
  let fixture: ComponentFixture<AccordionWithFooterHostComponent>;

  function setup(): HTMLElement {
    TestBed.configureTestingModule({
      imports: [AccordionWithFooterHostComponent],
      providers: [provideTranslateMock()],
    });
    fixture = TestBed.createComponent(AccordionWithFooterHostComponent);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const triggers = (element: HTMLElement): HTMLButtonElement[] => Array.from(element.querySelectorAll<HTMLButtonElement>('button'));

  const expandedStates = (element: HTMLElement): (string | null)[] =>
    triggers(element).map(trigger => trigger.getAttribute('aria-expanded'));

  it('should expand a panel with its content and footer when its title is clicked', async () => {
    const element = setup();

    triggers(element)[1].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(expandedStates(element)).toEqual(['false', 'true']);
    expect(Array.from(element.querySelectorAll('.test-footer')).map(footer => footer.textContent)).toEqual(['documents']);
  });
});
