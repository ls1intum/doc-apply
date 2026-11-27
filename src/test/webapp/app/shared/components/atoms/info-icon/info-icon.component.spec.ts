import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InfoIconComponent } from 'app/shared/components/atoms/info-icon/info-icon.component';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';
import { getRequiredButton } from 'util/utility-methods/dom-query.util';

describe('InfoIconComponent', () => {
  const createFixture = (inputs: Record<string, unknown>): ComponentFixture<InfoIconComponent> => {
    const fixture = TestBed.createComponent(InfoIconComponent);
    Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InfoIconComponent],
      providers: [provideFontAwesomeTesting(), provideTranslateMock()],
    }).compileComponents();
  });

  it('should emit clicked once without passing the click on when the clickable icon is clicked', () => {
    const fixture = createFixture({ clickable: true, ariaLabel: 'Open details' });
    const emitSpy = vi.spyOn(fixture.componentInstance.clicked, 'emit');
    const root: HTMLElement = fixture.nativeElement;
    const parentListener = vi.fn();
    root.addEventListener('click', parentListener);

    const button = getRequiredButton(root, 'button');
    button.click();

    expect(button.getAttribute('aria-label')).toBe('Open details');
    expect(emitSpy).toHaveBeenCalledOnce();
    expect(parentListener).not.toHaveBeenCalled();
  });

  it('should render a keyboard-reachable icon labelled by its tooltip when it only shows a tooltip', () => {
    const fixture = createFixture({ tooltip: 'Explains the field' });
    const root: HTMLElement = fixture.nativeElement;
    const icon = root.querySelector('[role="img"]');

    expect(root.querySelector('button')).toBeNull();
    expect(icon?.getAttribute('tabindex')).toBe('0');
    expect(icon?.getAttribute('aria-label')).toBe('Explains the field');
  });

  it('should show the popover content when the popover icon is clicked', async () => {
    const fixture = createFixture({ popover: 'Read the <a href="https://example.org">guide</a>', ariaLabel: 'About this' });

    getRequiredButton(fixture.nativeElement, 'button').click();
    fixture.detectChanges();
    await fixture.whenStable();

    const link = document.body.querySelector('a[href="https://example.org"]');
    expect(link?.textContent).toBe('guide');
  });
});
