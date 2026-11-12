import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DialogDataMock,
  DialogRefMock,
  createDialogRefMock,
  provideDialogRefMock,
  createDialogDataMock,
  provideDialogDataMock,
} from 'util/dialog-ref.mock';
import { createTranslateServiceMock, provideTranslateMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { GradingScaleEditDialogComponent } from 'app/application/application-creation/application-creation-page2/grading-scale-edit-dialog/grading-scale-edit-dialog';

type GradingScaleEditDialogTestable = Omit<GradingScaleEditDialogComponent, 'isValid' | 'isPercentageGrade'> & {
  isValid: () => boolean;
  isPercentageGrade: () => boolean;
};

async function configureTestBed(dialogConfig: DialogDataMock, dialogRef: DialogRefMock): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [GradingScaleEditDialogComponent],
    providers: [
      provideDialogDataMock(dialogConfig),
      provideDialogRefMock(dialogRef),
      provideTranslateMock(createTranslateServiceMock()),
      provideFontAwesomeTesting(),
    ],
  }).compileComponents();
}

describe('GradingScaleEditDialogComponent', () => {
  let fixture: ComponentFixture<GradingScaleEditDialogComponent>;
  let comp: GradingScaleEditDialogComponent;
  let dialogRef: DialogRefMock;
  let currentGrade = '1.0';
  let originalUpperLimit = '1.0';
  let originalLowerLimit = '4.0';
  let currentGradePercentage = '90%';
  let originalUpperLimitPercentage = '90%';
  let originalLowerLimitPercentage = '50%';

  beforeEach(async () => {
    dialogRef = createDialogRefMock();
    await configureTestBed(
      createDialogDataMock({
        currentGrade: currentGrade,
        currentUpperLimit: originalUpperLimit,
        currentLowerLimit: originalLowerLimit,
      }),
      dialogRef,
    );
    fixture = TestBed.createComponent(GradingScaleEditDialogComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialization', () => {
    it('should initialize fields and data signal from dialog config', () => {
      expect(comp.currentGrade).toBe(currentGrade);
      expect(comp.data().upperLimit).toBe(originalUpperLimit);
      expect(comp.data().lowerLimit).toBe(originalLowerLimit);
      expect(comp.data().isPercentage).toBe(false);
    });

    it('should set isPercentage true and isPercentageGrade true for percentage limits', async () => {
      TestBed.resetTestingModule();
      await configureTestBed(
        createDialogDataMock({
          currentGrade: currentGradePercentage,
          currentUpperLimit: originalUpperLimitPercentage,
          currentLowerLimit: originalLowerLimitPercentage,
        }),
        createDialogRefMock(),
      );
      const freshComp = TestBed.createComponent(GradingScaleEditDialogComponent).componentInstance;
      expect(freshComp.data().isPercentage).toBe(true);
      expect(freshComp.isPercentageGrade()).toBe(true);
    });

    it('should default fields to empty strings when not provided', async () => {
      TestBed.resetTestingModule();
      await configureTestBed(createDialogDataMock({}), createDialogRefMock());
      const freshComp = TestBed.createComponent(GradingScaleEditDialogComponent).componentInstance;
      expect(freshComp.currentGrade).toBe('');
      expect(freshComp.originalUpperLimit).toBe('');
      expect(freshComp.originalLowerLimit).toBe('');
    });
  });

  it('should return new form instance when data signal changes', () => {
    const before = comp.limitsForm();
    comp.data.set({ upperLimit: originalUpperLimit, lowerLimit: originalLowerLimit, isPercentage: false });
    expect(before).not.toBe(comp.limitsForm());
  });

  describe('isValid', () => {
    it.each([
      ['', '4.0'],
      ['1.0', ''],
      ['', ''],
      ['   ', '4.0'],
      ['1.0', '   '],
    ])('returns false for upper=%j, lower=%j', (upperLimit, lowerLimit) => {
      comp.data.set({ upperLimit, lowerLimit, isPercentage: false });
      expect(comp.isValid()).toBe(false);
    });
  });

  describe('syncFormToData effect', () => {
    it('should sync upper/lower form values to data signal', async () => {
      const form = comp.limitsForm();
      form.controls.upperLimit.setValue(originalUpperLimit);
      form.controls.lowerLimit.setValue(originalLowerLimit);
      await fixture.whenStable();
      expect(comp.data().upperLimit).toBe(originalUpperLimit);
      expect(comp.data().lowerLimit).toBe(originalLowerLimit);
    });

    it('should coerce null form values to empty strings', async () => {
      const form = comp.limitsForm();
      form.controls.lowerLimit.setValue(null);
      form.controls.upperLimit.setValue(null);
      await fixture.whenStable();
      expect(comp.data().upperLimit).toBe('');
      expect(comp.data().lowerLimit).toBe('');
    });

    it('should preserve data.isPercentage when form values change', async () => {
      comp.data.set({ upperLimit: originalUpperLimitPercentage, lowerLimit: originalLowerLimitPercentage, isPercentage: true });
      comp.limitsForm().controls.upperLimit.setValue('80%');
      await fixture.whenStable();
      expect(comp.data().isPercentage).toBe(true);
    });
  });

  describe('onSwap', () => {
    it.each([
      [originalUpperLimit, originalLowerLimit, originalLowerLimit, originalUpperLimit],
      [originalUpperLimit, '', '', originalUpperLimit],
      [originalUpperLimitPercentage, originalLowerLimitPercentage, originalLowerLimitPercentage, originalUpperLimitPercentage],
    ])('swap(%s, %s) -> (%s, %s)', (upper, lower, expectedUpper, expectedLower) => {
      comp.data.set({ upperLimit: upper, lowerLimit: lower, isPercentage: false });
      comp.onSwap();
      expect(comp.data().upperLimit).toBe(expectedUpper);
      expect(comp.data().lowerLimit).toBe(expectedLower);
    });
  });

  describe('onSave', () => {
    it.each([
      ['upperLimit empty', '', '4.0'],
      ['lowerLimit empty', '1.0', ''],
      ['both empty', '', ''],
    ])('should not close dialog when %s', (_label, upperLimit, lowerLimit) => {
      comp.data.set({ upperLimit, lowerLimit, isPercentage: false });
      comp.onSave();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('should close dialog exactly once with upperLimit and lowerLimit when valid and grade is non-percentage', () => {
      comp.data.set({ upperLimit: originalUpperLimit, lowerLimit: originalLowerLimit, isPercentage: false });

      comp.onSave();

      expect(dialogRef.close).toHaveBeenCalledOnce();
      expect(dialogRef.close).toHaveBeenCalledWith({ upperLimit: originalUpperLimit, lowerLimit: originalLowerLimit });
    });

    it('should add % to both limits when grade is percentage type and values have no % sign', () => {
      comp.data.set({ upperLimit: '90', lowerLimit: '50', isPercentage: true });
      (comp as unknown as GradingScaleEditDialogTestable).isValid = () => true;
      (comp as unknown as GradingScaleEditDialogTestable).isPercentageGrade = () => true;

      comp.onSave();

      expect(dialogRef.close).toHaveBeenCalledOnce();
      expect(dialogRef.close).toHaveBeenCalledWith({ upperLimit: '90%', lowerLimit: '50%' });
    });

    it('should normalize percentage values (strip and re-add %) when limits already contain %', () => {
      comp.data.set({ upperLimit: '90%', lowerLimit: '50%', isPercentage: true });
      (comp as unknown as GradingScaleEditDialogTestable).isValid = () => true;
      (comp as unknown as GradingScaleEditDialogTestable).isPercentageGrade = () => true;

      comp.onSave();

      expect(dialogRef.close).toHaveBeenCalledOnce();
      expect(dialogRef.close).toHaveBeenCalledWith({ upperLimit: '90%', lowerLimit: '50%' });
    });

    it('should not modify limit values when grade is non-percentage type, even if values contain %', () => {
      comp.data.set({ upperLimit: originalUpperLimitPercentage, lowerLimit: originalLowerLimitPercentage, isPercentage: false });
      (comp as unknown as GradingScaleEditDialogTestable).isValid = () => true;
      (comp as unknown as GradingScaleEditDialogTestable).isPercentageGrade = () => false;

      comp.onSave();

      expect(dialogRef.close).toHaveBeenCalledOnce();
      expect(dialogRef.close).toHaveBeenCalledWith({ upperLimit: originalUpperLimitPercentage, lowerLimit: originalLowerLimitPercentage });
    });
  });

  describe('onCancel', () => {
    it('should close the dialog even when form has valid data filled in', () => {
      comp.data.set({ upperLimit: originalUpperLimit, lowerLimit: originalLowerLimit, isPercentage: false });

      comp.onCancel();

      expect(dialogRef.close).toHaveBeenCalledOnce();
      expect(dialogRef.close).toHaveBeenCalledWith();
    });
  });
});
