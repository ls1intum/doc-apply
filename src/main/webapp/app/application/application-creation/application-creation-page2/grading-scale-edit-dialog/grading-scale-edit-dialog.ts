import { Component, computed, effect, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from 'app/shared/dialog/dialog.service';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { StringInputComponent } from 'app/shared/components/atoms/string-input/string-input.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { GradingScaleLimitsData, addPercentage, getGradeType, stripPercentage } from 'app/shared/util/grading-scale.utils';

import { gradingScaleRangeValidator, gradingScaleTypeValidator } from '../../../../shared/validators/grading-scale-validators';

/** What the grading scale dialog is opened with. */
export interface GradingScaleDialogData {
  gradeType: 'bachelor' | 'master';
  currentGrade?: string;
  currentUpperLimit?: string;
  currentLowerLimit?: string;
}

/** The limits the grading scale dialog closes with when the user saves. */
export interface GradingScaleDialogResult {
  upperLimit: string;
  lowerLimit: string;
}

@Component({
  selector: 'jhi-grading-scale-edit-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, ButtonComponent, StringInputComponent, FontAwesomeModule],
  templateUrl: './grading-scale-edit-dialog.html',
})
export class GradingScaleEditDialogComponent {
  dialogData = inject<GradingScaleDialogData | undefined>(DIALOG_DATA);
  dialogRef = inject<DialogRef<GradingScaleDialogResult>>(DialogRef);
  formBuilder = inject(FormBuilder);

  currentGrade = this.dialogData?.currentGrade ?? '';

  isPercentageGrade = computed(() => {
    return getGradeType(this.currentGrade) === 'percentage';
  });

  originalUpperLimit = this.dialogData?.currentUpperLimit ?? '';
  originalLowerLimit = this.dialogData?.currentLowerLimit ?? '';

  data = signal<GradingScaleLimitsData>({
    upperLimit: this.originalUpperLimit,
    lowerLimit: this.originalLowerLimit,
    isPercentage: [this.originalUpperLimit, this.originalLowerLimit].some(v => v.includes('%')),
  });

  limitsForm = computed(() => {
    const currentData = this.data();

    return this.formBuilder.group(
      {
        upperLimit: [currentData.upperLimit, gradingScaleTypeValidator(() => this.currentGrade)],
        lowerLimit: [currentData.lowerLimit, gradingScaleTypeValidator(() => this.currentGrade)],
      },
      {
        validators: gradingScaleRangeValidator(() => this.currentGrade),
      },
    );
  });

  isValid = computed(() => {
    const upper = this.data().upperLimit.trim();
    const lower = this.data().lowerLimit.trim();

    // Both fields must be filled
    if (upper === '' || lower === '') {
      return false;
    }

    return this.limitsForm().valid;
  });

  syncFormToData = effect(onCleanup => {
    const form = this.limitsForm();

    const sub = form.valueChanges.subscribe(value => {
      this.data.set({
        upperLimit: value.upperLimit ?? '',
        lowerLimit: value.lowerLimit ?? '',
        isPercentage: this.data().isPercentage,
      });
    });

    onCleanup(() => sub.unsubscribe());
  });

  onSwap(): void {
    const upper = this.data().upperLimit;
    const lower = this.data().lowerLimit;

    this.data.set({
      upperLimit: lower,
      lowerLimit: upper,
    });
  }

  onSave(): void {
    if (this.isValid()) {
      let upperLimit = this.data().upperLimit;
      let lowerLimit = this.data().lowerLimit;

      if (this.isPercentageGrade()) {
        upperLimit = addPercentage(stripPercentage(upperLimit));
        lowerLimit = addPercentage(stripPercentage(lowerLimit));
      }

      this.dialogRef.close({
        upperLimit,
        lowerLimit,
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
