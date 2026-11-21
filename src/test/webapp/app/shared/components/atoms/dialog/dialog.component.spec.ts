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
    <jhi-dialog [visible]="visible()" (visibleChange)="visible.set($event)" [header]="header()">
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

  it('should still open with an accessible name when the header is empty', async () => {
    fixture.componentInstance.header.set('');

    await open();

    expect(dialog()?.getAttribute('aria-label')).toBe('global.dialog.label');
  });
});
