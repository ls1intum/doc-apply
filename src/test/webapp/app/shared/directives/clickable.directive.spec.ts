import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, expect, it, vi } from 'vitest';

import { ClickableDirective } from 'app/shared/directives/clickable.directive';

@Component({
  imports: [ClickableDirective],
  template: `
    <div jhiClickable [role]="role()" (click)="onClick()" data-testid="host">
      target
      <button type="button" data-testid="nested" (click)="onNestedClick()">nested</button>
    </div>
  `,
})
class HostComponent {
  readonly role = signal<'button' | 'link'>('button');
  readonly onClick = vi.fn();
  readonly onNestedClick = vi.fn();
}

function dispatch(element: HTMLElement, key: 'Enter' | ' '): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

describe('ClickableDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    host = fixture.debugElement.query(By.css('[data-testid="host"]')).nativeElement;
  });

  it('should apply role and tabindex defaults to the host element', () => {
    expect(host.getAttribute('role')).toBe('button');
    expect(host.getAttribute('tabindex')).toBe('0');
  });

  it('should fire the host click when Enter is pressed', () => {
    const event = dispatch(host, 'Enter');
    expect(fixture.componentInstance.onClick).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('should fire the host click when Space is pressed and role is button', () => {
    const event = dispatch(host, ' ');
    expect(fixture.componentInstance.onClick).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('should ignore Space when role is link', () => {
    fixture.componentInstance.role.set('link');
    fixture.detectChanges();

    const event = dispatch(host, ' ');
    expect(fixture.componentInstance.onClick).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  describe('nested interactive elements', () => {
    let nested: HTMLElement;

    beforeEach(() => {
      nested = fixture.debugElement.query(By.css('[data-testid="nested"]')).nativeElement;
    });

    it.each<['Enter' | ' ']>([['Enter'], [' ']])('should leave %s alone when it comes from a nested element', key => {
      const event = dispatch(nested, key);

      expect(fixture.componentInstance.onClick).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('should let a nested button fire its own click handler, leaving bubbling to the call site', () => {
      nested.click();

      expect(fixture.componentInstance.onNestedClick).toHaveBeenCalledOnce();
      expect(fixture.componentInstance.onClick).toHaveBeenCalledOnce();
    });
  });
});
