import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { faRobot } from '@fortawesome/free-solid-svg-icons';
import { DialogIconHeaderComponent } from 'app/shared/components/molecules/dialog-icon-header/dialog-icon-header.component';
import { provideTranslateMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';

describe('DialogIconHeaderComponent', () => {
  it.each([
    [true, 1],
    [false, 0],
  ])('should emit closed from the close button only when closable is %s', async (closable, expectedCalls) => {
    await TestBed.configureTestingModule({
      imports: [DialogIconHeaderComponent],
      providers: [provideTranslateMock(), provideFontAwesomeTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(DialogIconHeaderComponent);
    fixture.componentRef.setInput('icon', faRobot);
    fixture.componentRef.setInput('titleKey', 'title');
    fixture.componentRef.setInput('closable', closable);
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.detectChanges();

    const button: HTMLButtonElement | undefined = fixture.nativeElement.querySelector('button') ?? undefined;
    button?.click();

    expect(closed).toHaveBeenCalledTimes(expectedCalls);
  });
});
