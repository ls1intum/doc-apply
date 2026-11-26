import { Dialog } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';

describe('ConfirmDialog', () => {
  async function createFixture(): Promise<ComponentFixture<ConfirmDialog>> {
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.componentRef.setInput('label', 'Delete');
    fixture.componentRef.setInput('header', 'Confirm Deletion');
    fixture.componentRef.setInput('message', 'Are you sure you want to delete this item?');
    fixture.componentRef.setInput('confirmIcon', 'trash');
    fixture.componentRef.setInput('severity', 'danger');
    await fixture.whenStable();
    return fixture;
  }

  function dialog(): HTMLElement | null {
    return document.body.querySelector<HTMLElement>('[role="alertdialog"]');
  }

  function dialogButton(label: string): HTMLButtonElement | undefined {
    return Array.from(dialog()?.querySelectorAll('button') ?? []).find(button => button.textContent?.trim() === label);
  }

  async function openDialog(fixture: ComponentFixture<ConfirmDialog>): Promise<void> {
    fixture.componentInstance.confirm();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialog],
      providers: [provideFontAwesomeTesting(), provideTranslateMock()],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(Dialog).closeAll();
    vi.restoreAllMocks();
  });

  describe('Confirm Button Label', () => {
    it.each<[string | undefined, string]>([
      ['Delete', 'Delete'],
      [undefined, 'button.confirm'],
    ])('should label the confirm button %o as %o, never blank', (label, expected) => {
      const fixture = TestBed.createComponent(ConfirmDialog);
      fixture.componentRef.setInput('label', label);

      expect(fixture.componentInstance.confirmLabel()).toBe(expected);
    });
  });

  describe('Open Button Behaviour', () => {
    it('should hide open button when showOpenButton is false and open the dialog when shown and clicked', async () => {
      const fixture = await createFixture();

      fixture.componentRef.setInput('showOpenButton', false);
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('jhi-button')).toBeFalsy();

      fixture.componentRef.setInput('showOpenButton', true);
      await fixture.whenStable();
      fixture.nativeElement.querySelector('jhi-button button').click();
      await fixture.whenStable();

      expect(dialog()).not.toBeNull();
    });
  });

  describe('Dialog Content', () => {
    it('should open when visible becomes true', async () => {
      const fixture = await createFixture();

      fixture.componentRef.setInput('visible', true);
      await fixture.whenStable();

      expect(dialog()).not.toBeNull();
    });

    it.each<[string | undefined, string]>([
      ['Confirm Deletion', 'Confirm Deletion'],
      [undefined, 'Are you sure you want to delete this item?'],
    ])('should name the dialog after header %o as %o and describe it with the message', async (header, expectedName) => {
      const fixture = await createFixture();
      fixture.componentRef.setInput('header', header);
      await openDialog(fixture);

      const describedBy = dialog()?.getAttribute('aria-describedby') ?? '';
      expect(dialog()?.getAttribute('aria-label')).toBe(expectedName);
      expect(document.getElementById(describedBy)?.textContent?.trim()).toBe('Are you sure you want to delete this item?');
    });
  });

  describe('Accept and Reject Behaviour', () => {
    it.each<[string | undefined]>([['test-data-123'], [undefined]])(
      'should emit confirmed with data %s and close when confirmed',
      async data => {
        const fixture = await createFixture();
        if (data !== undefined) {
          fixture.componentRef.setInput('data', data);
        }
        const confirmedSpy = vi.spyOn(fixture.componentInstance.confirmed, 'emit');
        const closedSpy = vi.spyOn(fixture.componentInstance.closed, 'emit');
        await openDialog(fixture);

        dialogButton('Delete')?.click();
        await fixture.whenStable();

        expect(confirmedSpy).toHaveBeenCalledExactlyOnceWith(data);
        expect(closedSpy).toHaveBeenCalledOnce();
        expect(dialog()).toBeNull();
      },
    );

    it('should close without confirming when cancelled', async () => {
      const fixture = await createFixture();
      const confirmedSpy = vi.spyOn(fixture.componentInstance.confirmed, 'emit');
      const closedSpy = vi.spyOn(fixture.componentInstance.closed, 'emit');
      await openDialog(fixture);

      dialogButton('entity.action.cancel')?.click();
      await fixture.whenStable();

      expect(confirmedSpy).not.toHaveBeenCalled();
      expect(closedSpy).toHaveBeenCalledOnce();
      expect(dialog()).toBeNull();
    });

    it('should close without confirming when the user presses Escape', async () => {
      const fixture = await createFixture();
      const confirmedSpy = vi.spyOn(fixture.componentInstance.confirmed, 'emit');
      const closedSpy = vi.spyOn(fixture.componentInstance.closed, 'emit');
      await openDialog(fixture);

      dialog()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await fixture.whenStable();

      expect(confirmedSpy).not.toHaveBeenCalled();
      expect(closedSpy).toHaveBeenCalledOnce();
    });
  });
});
