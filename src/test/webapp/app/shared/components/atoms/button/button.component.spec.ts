import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';

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

  it('should show favorites badge with the count if numberOfFavorites is set', () => {
    const fixture = createButtonFixture({ numberOfFavorites: 5 });

    expect(fixture.nativeElement.querySelector('.favorites-badge').textContent.trim()).toBe('5');
  });

  it('should not show favorites badge when there are no favorites', () => {
    const fixture = createButtonFixture({ numberOfFavorites: 0 });

    expect(fixture.nativeElement.querySelector('.favorites-badge')).toBeNull();
  });

  it('should disable the button and mark it busy while loading', () => {
    const fixture = createButtonFixture({ label: 'Save', loading: true });

    const buttonElement: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(buttonElement.disabled).toBe(true);
    expect(buttonElement.getAttribute('aria-busy')).toBe('true');
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
