import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { SuggestionSystemComponent } from 'app/shared/components/molecules/suggestion-system/suggestion-system.component';
import { provideTranslateMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';

describe('SuggestionSystemComponent', () => {
  it.each([
    { buttonIndex: 0, output: 'dismissed' as const },
    { buttonIndex: 1, output: 'accepted' as const },
  ])('should emit $output when its button is clicked', async ({ buttonIndex, output }) => {
    await TestBed.configureTestingModule({
      imports: [SuggestionSystemComponent],
      providers: [provideTranslateMock(), provideFontAwesomeTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(SuggestionSystemComponent);
    fixture.componentRef.setInput('suggestion', 'motivated');
    const accepted = vi.fn();
    const dismissed = vi.fn();
    fixture.componentInstance.accepted.subscribe(accepted);
    fixture.componentInstance.dismissed.subscribe(dismissed);
    fixture.detectChanges();

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    buttons[buttonIndex].click();

    expect(output === 'accepted' ? accepted : dismissed).toHaveBeenCalledOnce();
    expect(output === 'accepted' ? dismissed : accepted).not.toHaveBeenCalled();
  });
});
