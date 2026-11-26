import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';

type ButtonForTest = {
  label: string;
  icon: string;
  disabled: boolean;
  isExternalLink: boolean;
  numberOfFavorites: number;
  severity: 'primary' | 'secondary' | 'contrast' | 'success' | 'warn' | 'danger' | 'info';
  variant: 'outlined' | 'text';
  fullWidth: boolean;
  shouldTranslate: boolean;
  size: 'sm' | 'md' | 'lg';
  loading: boolean;
  type: 'button' | 'submit' | 'reset';
  tooltip: string;
  disabledReason: string;
};

describe('ButtonComponent', () => {
  function createButtonFixture(overrideInputs: Partial<ButtonForTest>) {
    const fixture = TestBed.createComponent(ButtonComponent);

    const defaults: Partial<ButtonForTest> = {
      disabled: false,
      isExternalLink: false,
      severity: 'primary',
      variant: 'text',
      shouldTranslate: false,
      size: 'lg',
      loading: false,
      type: 'button',
    };

    const inputs = Object.assign({}, defaults, overrideInputs);

    Object.entries(inputs).forEach(([key, value]) => {
      fixture.componentRef.setInput(key as keyof ButtonForTest, value);
    });

    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonComponent],
      providers: [provideFontAwesomeTesting(), provideTranslateMock()],
    }).compileComponents();
  });

  it('should render label and default to type=button when no overrides are provided', () => {
    const fixture = createButtonFixture({ label: 'Click Me' });

    const buttonElement: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(buttonElement.disabled).toBe(false);
    expect(buttonElement.type).toBe('button');
    expect(buttonElement.textContent).toContain('Click Me');
  });

  it('should show icon when icon input is set', () => {
    const fixture = createButtonFixture({ icon: 'google' });

    expect(fixture.nativeElement.querySelector('fa-icon')).toBeTruthy();
  });

  it('should show external link icon if isExternalLink is true', () => {
    const fixture = createButtonFixture({ isExternalLink: true });

    expect(fixture.nativeElement.querySelector('.external-icon')).toBeTruthy();
  });

  it.each<[number, string | undefined]>([
    [5, '5'],
    [0, undefined],
  ])('should show %o favorites as the badge text %o', (numberOfFavorites, badgeText) => {
    const fixture = createButtonFixture({ numberOfFavorites });

    const badge: HTMLElement | null = fixture.nativeElement.querySelector('.favorites-badge');
    expect(badge?.textContent?.trim()).toBe(badgeText);
  });

  it('should disable the button and mark it busy while loading', () => {
    const fixture = createButtonFixture({ label: 'Save', loading: true });

    const buttonElement: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(buttonElement.disabled).toBe(true);
    expect(buttonElement.getAttribute('aria-busy')).toBe('true');
  });

  it.each([
    { disabled: true, loading: false, expectedClicks: 0 },
    { disabled: false, loading: true, expectedClicks: 0 },
    { disabled: false, loading: false, expectedClicks: 1 },
  ])(
    'should pass a click on the button wrapper on $expectedClicks time(s) when disabled is $disabled and loading is $loading',
    ({ disabled, loading, expectedClicks }) => {
      const fixture = createButtonFixture({ disabled, loading, label: 'Next' });
      const hostClick = vi.fn();
      fixture.nativeElement.addEventListener('click', hostClick);

      const wrapper: HTMLElement = fixture.nativeElement.querySelector('div.relative');
      wrapper.click();

      expect(hostClick).toHaveBeenCalledTimes(expectedClicks);
    },
  );

  it.each([
    { disabled: true, loading: false, explained: true },
    { disabled: false, loading: false, explained: false },
    { disabled: true, loading: true, explained: false },
  ])(
    'should explain the disabled state with the reason ($explained) when disabled is $disabled and loading is $loading',
    ({ disabled, loading, explained }) => {
      const fixture = createButtonFixture({ disabled, loading, label: 'Next', disabledReason: 'Fill in the required fields' });

      const buttonElement: HTMLButtonElement = fixture.nativeElement.querySelector('button');
      const reason: HTMLElement | null = fixture.nativeElement.querySelector('.disabled-reason');
      expect(buttonElement.getAttribute('aria-disabled')).toBe(explained ? 'true' : null);
      expect(buttonElement.disabled).toBe(disabled && !explained);
      expect(reason?.textContent).toBe(explained ? 'Fill in the required fields' : undefined);
      expect(buttonElement.getAttribute('aria-describedby') ?? undefined).toBe(reason?.id);
    },
  );

  it('should block the click and the form submit of a button that explains its disabled state', () => {
    const fixture = createButtonFixture({ disabled: true, label: 'Save', type: 'submit', disabledReason: 'Nothing changed yet' });
    const hostClick = vi.fn();
    fixture.nativeElement.addEventListener('click', hostClick);
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });

    fixture.nativeElement.querySelector('button').dispatchEvent(clickEvent);

    expect(hostClick).not.toHaveBeenCalled();
    expect(clickEvent.defaultPrevented).toBe(true);
  });

  it('should keep the tooltip as accessible name of an icon-only button while it shows the disabled reason', () => {
    const fixture = createButtonFixture({ icon: 'trash', tooltip: 'Delete', disabled: true, disabledReason: 'Already in use' });

    expect(fixture.nativeElement.querySelector('button').getAttribute('aria-label')).toBe('Delete');
  });

  it('should use the tooltip as accessible name of an icon-only button', () => {
    const fixture = createButtonFixture({ icon: 'trash', tooltip: 'Delete' });

    expect(fixture.nativeElement.querySelector('button').getAttribute('aria-label')).toBe('Delete');
  });

  it('should focus the button on render when autofocus is set', async () => {
    const fixture = TestBed.createComponent(ButtonComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.componentRef.setInput('label', 'Login');
    fixture.componentRef.setInput('autofocus', true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('button'));
    fixture.nativeElement.remove();
  });
});
