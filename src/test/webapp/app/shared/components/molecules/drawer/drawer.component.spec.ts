import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DrawerComponent } from 'app/shared/components/molecules/drawer/drawer.component';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';

@Component({
  imports: [DrawerComponent],
  template: `
    <jhi-drawer [(open)]="open" [modal]="modal()" [dismissible]="dismissible()">
      <span drawer-header>Filters</span>
      <button type="button" class="drawer-content">Apply</button>
    </jhi-drawer>
    <button type="button" class="outside">Outside</button>
  `,
})
class DrawerHostComponent {
  readonly open = signal(false);
  readonly modal = signal(true);
  readonly dismissible = signal(true);
}

describe('DrawerComponent', () => {
  let fixture: ComponentFixture<DrawerHostComponent>;
  let host: DrawerHostComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DrawerHostComponent],
      providers: [provideTranslateMock(), provideFontAwesomeTesting()],
    });
    fixture = TestBed.createComponent(DrawerHostComponent);
    host = fixture.componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function openDrawer(): Promise<void> {
    host.open.set(true);
    await fixture.whenStable();
  }

  function panel(): HTMLElement | null {
    return document.body.querySelector<HTMLElement>('.cdk-overlay-container [role="dialog"]');
  }

  it('should render the header and content in an overlay only while open', async () => {
    await fixture.whenStable();
    expect(panel()).toBeNull();

    await openDrawer();

    expect(panel()?.textContent).toContain('Filters');
    expect(panel()?.querySelector('.drawer-content')).not.toBeNull();
  });

  it('should close when the close button is clicked', async () => {
    await openDrawer();

    panel()?.querySelector<HTMLButtonElement>('button[aria-label="button.close"]')?.click();
    await fixture.whenStable();

    expect(host.open()).toBe(false);
    expect(panel()).toBeNull();
  });

  it('should close when Escape is pressed', async () => {
    await openDrawer();

    panel()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(host.open()).toBe(false);
  });

  it.each([
    [true, false],
    [false, true],
  ])('should close on a backdrop click when dismissible is %s', async (dismissible, expectedOpen) => {
    host.dismissible.set(dismissible);
    await openDrawer();

    document.body.querySelector<HTMLElement>('.cdk-overlay-backdrop')?.click();

    expect(host.open()).toBe(expectedOpen);
  });

  it('should close a non-modal drawer on a click outside it but not on a click inside it', async () => {
    vi.useFakeTimers();
    host.modal.set(false);
    await openDrawer();
    vi.runAllTimers();

    panel()?.querySelector<HTMLButtonElement>('.drawer-content')?.click();
    expect(host.open()).toBe(true);

    fixture.nativeElement.querySelector('.outside').click();
    expect(host.open()).toBe(false);
  });
});
