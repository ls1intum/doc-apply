import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { CancelInterviewModalComponent } from 'app/interview/interview-process-detail/cancel-interview-modal/cancel-interview-modal.component';
import { provideTranslateMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';

describe('CancelInterviewModalComponent', () => {
  let fixture: ComponentFixture<CancelInterviewModalComponent>;
  let component: CancelInterviewModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CancelInterviewModalComponent],
      providers: [provideTranslateMock(), provideFontAwesomeTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CancelInterviewModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('onConfirm', () => {
    it('should emit confirmed with current deleteSlot and sendReinvite values', () => {
      const confirmedSpy = vi.spyOn(component.confirmed, 'emit');
      component.deleteSlot.set(true);
      component.sendReinvite.set(true);

      component.onConfirm();

      expect(confirmedSpy).toHaveBeenCalledOnce();
      expect(confirmedSpy).toHaveBeenCalledWith({ deleteSlot: true, sendReinvite: true });
    });

    it('should emit confirmed with default false values', () => {
      const confirmedSpy = vi.spyOn(component.confirmed, 'emit');

      component.onConfirm();

      expect(confirmedSpy).toHaveBeenCalledOnce();
      expect(confirmedSpy).toHaveBeenCalledWith({ deleteSlot: false, sendReinvite: false });
    });
  });

  describe('onVisibleChange', () => {
    it('should emit visibleChange and reset state on close', () => {
      const visibleChangeSpy = vi.spyOn(component.visibleChange, 'emit');
      component.deleteSlot.set(true);
      component.sendReinvite.set(true);

      component.onVisibleChange(false);

      expect(visibleChangeSpy).toHaveBeenCalledWith(false);
      expect(component.deleteSlot()).toBe(false);
      expect(component.sendReinvite()).toBe(false);
    });

    it('should not reset state when opening', () => {
      component.deleteSlot.set(true);
      component.sendReinvite.set(true);

      component.onVisibleChange(true);

      expect(component.deleteSlot()).toBe(true);
      expect(component.sendReinvite()).toBe(true);
    });
  });

  it('close() should emit visibleChange(false)', () => {
    const visibleChangeSpy = vi.spyOn(component.visibleChange, 'emit');

    component.close();

    expect(visibleChangeSpy).toHaveBeenCalledWith(false);
  });
});
