import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { CompliancePopoverComponent } from 'app/shared/components/molecules/ai-compliance-popover/ai-compliance-popover.component';
import { provideTranslateMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';

describe('CompliancePopoverComponent', () => {
  let fixture: ComponentFixture<CompliancePopoverComponent>;
  let closed: Mock<() => void>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompliancePopoverComponent],
      providers: [provideTranslateMock(), provideFontAwesomeTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CompliancePopoverComponent);
    fixture.componentRef.setInput('issue', { id: 'issue-1', text: 'young and dynamic', suggestion: 'motivated', explanation: 'Age' });
    closed = vi.fn<() => void>();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.detectChanges();
  });

  it('should close when the user clicks outside the popover', () => {
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    expect(closed).toHaveBeenCalledOnce();
  });

  it('should stay open when the user clicks inside the popover', () => {
    const inside: HTMLElement = fixture.nativeElement.querySelector('jhi-suggestion-system') ?? fixture.nativeElement;
    inside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    expect(closed).not.toHaveBeenCalled();
  });

  it('should close when the user presses Escape', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(closed).toHaveBeenCalledOnce();
  });
});
