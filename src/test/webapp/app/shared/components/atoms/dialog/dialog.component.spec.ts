import { Dialog } from '@angular/cdk/dialog';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DialogComponent } from 'app/shared/components/atoms/dialog/dialog.component';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';

@Component({
  imports: [DialogComponent],
  template: `
    <jhi-dialog [visible]="visible()" (visibleChange)="visible.set($event)" [header]="header()" width="40%">
      <p class="dialog-body">Body</p>
    </jhi-dialog>
  `,
})
class DialogHostComponent {
  readonly visible = signal(false);
  readonly header = signal('dialog.title');
}

describe('DialogComponent', () => {
  let fixture: ComponentFixture<DialogHostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DialogHostComponent],
      providers: [provideTranslateMock(), provideFontAwesomeTesting()],
    });
    fixture = TestBed.createComponent(DialogHostComponent);
  });

  afterEach(() => {
    TestBed.inject(Dialog).closeAll();
  });

  function dialog(): HTMLElement | null {
    return document.body.querySelector<HTMLElement>('.cdk-overlay-container [role="dialog"]');
  }

  async function open(): Promise<void> {
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
  }

  it('should show the translated header and the projected content while visible', async () => {
    await open();

    expect(dialog()?.textContent).toContain('dialog.title');
    expect(dialog()?.querySelector('.dialog-body')).not.toBeNull();
  });

  it('should take a percentage width of the viewport', async () => {
    await open();

    expect(dialog()?.querySelector<HTMLElement>('.dialog-body')?.parentElement?.style.width).toBe('40vw');
  });

  it('should report that the user closed it with Escape', async () => {
    await open();

    dialog()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    expect(fixture.componentInstance.visible()).toBe(false);
    expect(dialog()).toBeNull();
  });

  it('should still open with an accessible name when the header is empty', async () => {
    fixture.componentInstance.header.set('');

    await open();

    expect(dialog()?.getAttribute('aria-label')).toBe('global.dialog.label');
  });
});
