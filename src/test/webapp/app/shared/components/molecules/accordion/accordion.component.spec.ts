import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
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
  function setup(): HTMLElement {
    TestBed.configureTestingModule({
      imports: [AccordionWithFooterHostComponent],
      providers: [provideTranslateMock(), provideNoopAnimations()],
    });
    const fixture = TestBed.createComponent(AccordionWithFooterHostComponent);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('should render one panel per item with its title', () => {
    const element = setup();

    const headers = Array.from(element.querySelectorAll('p-accordion-header')).map(header => header.textContent.trim());

    expect(headers).toEqual(['faq.login.title', 'faq.documents.title']);
  });

  it('should render the footer template with each item', () => {
    const element = setup();

    const footers = Array.from(element.querySelectorAll('.test-footer')).map(footer => footer.textContent);

    expect(footers).toEqual(['login', 'documents']);
  });
});
