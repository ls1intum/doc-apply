import { ApplicationRef, Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DIALOG_DATA, DialogRef, DialogService } from 'app/shared/dialog/dialog.service';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';

@Component({ selector: 'jhi-test-dialog-content', template: '<p>content</p>' })
class TestDialogContentComponent {
  static lastInstance: TestDialogContentComponent | undefined;

  readonly data = inject<{ id: number } | undefined>(DIALOG_DATA);
  readonly ref = inject<DialogRef<string>>(DialogRef);

  constructor() {
    TestDialogContentComponent.lastInstance = this;
  }
}

describe('DialogService', () => {
  let service: DialogService;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideTranslateMock(), provideFontAwesomeTesting()],
    });
    service = TestBed.inject(DialogService);
    appRef = TestBed.inject(ApplicationRef);
    TestDialogContentComponent.lastInstance = undefined;
  });

  afterEach(() => {
    TestBed.inject(Dialog).closeAll();
  });

  function render(): TestDialogContentComponent {
    appRef.tick();
    const content = TestDialogContentComponent.lastInstance;
    if (content === undefined) {
      throw new Error('The dialog content was not rendered');
    }
    return content;
  }

  it('should hand the data and its ref to the dialog content', () => {
    const ref = service.open<string>(TestDialogContentComponent, { header: 'Title', data: { id: 7 } });

    const content = render();

    expect(content.data).toEqual({ id: 7 });
    expect(content.ref).toBe(ref);
  });

  it('should give the opener the result the content closes with', async () => {
    const ref = service.open<string>(TestDialogContentComponent);
    const result = ref === undefined ? Promise.resolve(undefined) : firstValueFrom(ref.closed);

    render().ref.close('saved');

    expect(await result).toBe('saved');
  });

  it('should tell the opener when the user closes the dialog without a result', async () => {
    const ref = service.open<string>(TestDialogContentComponent, { header: 'Title' });
    const result = ref === undefined ? Promise.resolve('not opened') : firstValueFrom(ref.closed);
    render();

    document.body.querySelector<HTMLButtonElement>('button[aria-label="button.close"]')?.click();
    appRef.tick();

    expect(await result).toBeUndefined();
  });

  it('should close without a result when the user presses Escape', async () => {
    const ref = service.open<string>(TestDialogContentComponent, { header: 'Title' });
    const result = ref === undefined ? Promise.resolve('not opened') : firstValueFrom(ref.closed);
    render();

    document.body.querySelector('[role="dialog"]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(await result).toBeUndefined();
  });

  it.each([
    [true, true],
    [false, false],
  ])('should close on a backdrop click when dismissableMask is %s: %s', (dismissableMask, expectedClosed) => {
    const ref = service.open(TestDialogContentComponent, { dismissableMask });
    render();
    let closed = false;
    ref?.closed.subscribe(() => (closed = true));
    const backdrop = document.body.querySelector<HTMLElement>('.cdk-overlay-backdrop');

    backdrop?.click();

    expect(backdrop).not.toBeNull();
    expect(closed).toBe(expectedClosed);
  });

  it('should allow the same component again once its dialog has closed', () => {
    service.open(TestDialogContentComponent)?.close();

    const second = service.open(TestDialogContentComponent);

    expect(second).toBeInstanceOf(DialogRef);
  });

  it('should refuse a second dialog of the same component while the first is open', () => {
    const first = service.open(TestDialogContentComponent);

    const second = service.open(TestDialogContentComponent);

    expect(first).toBeInstanceOf(DialogRef);
    expect(second).toBeUndefined();
  });

  it('should leave the data undefined for components rendered outside a dialog', () => {
    expect(TestBed.inject(DIALOG_DATA)).toBeUndefined();
  });
});
