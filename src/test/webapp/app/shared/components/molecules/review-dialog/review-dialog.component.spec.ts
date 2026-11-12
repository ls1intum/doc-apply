import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewDialogComponent } from 'app/shared/components/molecules/review-dialog/review-dialog.component';
import { provideTranslateMock } from '../../../../../util/translate.mock';
import { SelectOption } from 'app/shared/components/atoms/select/select.component';
import { provideFontAwesomeTesting } from '../../../../../util/fontawesome.testing';
import { ApplicationEvaluationDetailDTO } from 'app/generated/model/application-evaluation-detail-dto';
import { RejectDTOReasonEnum } from 'app/generated/model/reject-dto';

describe('ReviewDialogComponent', () => {
  let fixture: ComponentFixture<ReviewDialogComponent>;
  let component: ReviewDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReviewDialogComponent],
      providers: [provideTranslateMock(), provideFontAwesomeTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ReviewDialogComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('mode', 'ACCEPT');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('computed canAccept', () => {
    it.each<[boolean, string, boolean]>([
      [true, '<p></p>', false],
      [true, '<p>Hello</p>', true],
      [false, '', true],
    ])('should compute canAccept for notifyApplicant=%s editorModel=%s', (notifyApplicant, editorModel, expected) => {
      component.notifyApplicant.set(notifyApplicant);
      component.editorModel.set(editorModel);
      expect(component.canAccept()).toBe(expected);
    });
  });

  describe('computed canReject', () => {
    it('should reflect whether a reject reason is selected', () => {
      component.selectedRejectReason.set(undefined);
      expect(component.canReject()).toBe(false);

      component.selectedRejectReason.set({ name: 'test', value: RejectDTOReasonEnum.JobFilled });
      expect(component.canReject()).toBe(true);
    });
  });

  describe('translationMetaData', () => {
    it('should return undefined if no application input', () => {
      fixture.componentRef.setInput('application', undefined);
      expect(component.translationMetaData()).toBeUndefined();
    });

    it.each<[ApplicationEvaluationDetailDTO['applicationDetailDTO']['applicant'], string]>([
      [{ user: { name: 'Alice' } } as ApplicationEvaluationDetailDTO['applicationDetailDTO']['applicant'], 'Alice'],
      [undefined, ''],
    ])('should derive APPLICANT_FIRST_NAME from applicant=%o', (applicant, expectedFirstName) => {
      const application: ApplicationEvaluationDetailDTO = {
        applicationDetailDTO: { applicant, jobTitle: 'Research Job' },
        professor: {
          email: 'prof@uni.de',
          firstName: 'John',
          lastName: 'Doe',
          researchGroupName: 'GroupX',
          researchGroupWebsite: 'www.groupx.com',
        },
      } as ApplicationEvaluationDetailDTO;
      fixture.componentRef.setInput('application', application);

      const meta = component.translationMetaData();
      expect(meta?.APPLICANT_FIRST_NAME).toBe(expectedFirstName);
      expect(meta?.PROFESSOR_EMAIL).toBe('prof@uni.de');
      expect(meta?.JOB_NAME).toBe('Research Job');
    });
  });

  describe('resetDialogState', () => {
    it('should reset notifyApplicant, closeJob, and selectedRejectReason', () => {
      component.notifyApplicant.set(false);
      component.closeJob.set(true);
      component.selectedRejectReason.set({ name: 'test', value: RejectDTOReasonEnum.JobFilled });

      component.resetDialogState();

      expect(component.notifyApplicant()).toBe(true);
      expect(component.closeJob()).toBe(false);
      expect(component.selectedRejectReason()).toBeUndefined();
    });
  });

  describe('onSelectChange', () => {
    it('should update selectedRejectReason', () => {
      const option: SelectOption = { name: 'reason', value: RejectDTOReasonEnum.JobFilled };
      component.onSelectChange(option);
      expect(component.selectedRejectReason()).toEqual(option);
    });
  });

  describe('onAccept', () => {
    it('should emit accept event with current values', () => {
      const spy = vi.fn();
      component.accept.subscribe(spy);

      component.editorModel.set('Hello world');
      component.notifyApplicant.set(true);
      component.closeJob.set(true);

      component.onAccept();

      expect(spy).toHaveBeenCalledWith({
        message: 'Hello world',
        notifyApplicant: true,
        closeJob: true,
      });
    });
  });

  describe('onReject', () => {
    it('should not emit if no reason selected', () => {
      const spy = vi.fn();
      component.reject.subscribe(spy);

      component.selectedRejectReason.set(undefined);
      component.onReject();

      expect(spy).not.toHaveBeenCalled();
    });

    it('should emit reject event with correct reason and notifyApplicant', () => {
      const spy = vi.fn();
      component.reject.subscribe(spy);

      const option: SelectOption = { name: 'reason', value: RejectDTOReasonEnum.FailedRequirements };
      component.selectedRejectReason.set(option);
      component.notifyApplicant.set(false);

      component.onReject();

      expect(spy).toHaveBeenCalledWith({
        reason: RejectDTOReasonEnum.FailedRequirements,
        notifyApplicant: false,
      });
    });
  });

  describe('_defaultTextEffect', () => {
    it('should set editorModel when visible is true', () => {
      fixture.componentInstance.visible.set(true);
      fixture.detectChanges();

      expect(component.editorModel()).toBe('evaluation.defaultAcceptMessage');
    });
  });
});
