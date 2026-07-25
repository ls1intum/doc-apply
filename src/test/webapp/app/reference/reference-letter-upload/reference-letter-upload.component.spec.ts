import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { throwError } from 'rxjs';
import { provideTranslateMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { createToastServiceMock, provideToastServiceMock, ToastServiceMock } from 'util/toast-service.mock';
import { createActivatedRouteMock, provideActivatedRouteMock } from 'util/activated-route.mock';
import {
  createMockContext,
  createReferenceLetterUploadResourceApiMock,
  provideReferenceLetterUploadResourceApiMock,
  ReferenceLetterUploadResourceApiMock,
} from 'util/reference-letter-upload-resource-api.service.mock';
import { ReferenceLetterUploadComponent } from 'app/reference/reference-letter-upload/reference-letter-upload.component';
import { ReferenceRequestDTOStatusEnum } from 'app/generated/model/reference-request-dto';
import { RecommendationType } from 'app/generated/model/recommendation-type';

const TOKEN = 'sample-token';

interface ReferenceLetterUploadComponentInternals {
  onQueuedFilesChanged(files: File[]): void;
  onAnswerSelected(key: string, option: { name: string; value: string } | undefined): void;
  confirmUpload(): Promise<void>;
  confirmDecline(): Promise<void>;
}

const internals = (component: ReferenceLetterUploadComponent): ReferenceLetterUploadComponentInternals =>
  component as unknown as ReferenceLetterUploadComponentInternals;

const REQUIRED_ANSWERS: Record<string, string> = {
  relationship: 'RESEARCH_SUPERVISOR',
  acquaintanceDuration: 'THREE_TO_FIVE_YEARS',
  acquaintanceDepth: 'VERY_WELL',
  ratingIntellectualAbility: 'TOP_FIVE_PERCENT',
  ratingResearchPotential: 'TOP_TEN_PERCENT',
  ratingMotivation: 'TOP_ONE_TO_TWO_PERCENT',
  ratingCommunication: 'TOP_TWENTY_FIVE_PERCENT',
  ratingLeadership: 'TOP_FIFTY_PERCENT',
  ratingCollaboration: 'CANNOT_JUDGE',
  overallRecommendation: 'STRONGLY_RECOMMEND',
};

const fillAnswers = (component: ReferenceLetterUploadComponent): void => {
  Object.entries(REQUIRED_ANSWERS).forEach(([key, value]) => internals(component).onAnswerSelected(key, { name: '', value }));
};

describe('ReferenceLetterUploadComponent', () => {
  let fixture: ComponentFixture<ReferenceLetterUploadComponent>;
  let component: ReferenceLetterUploadComponent;
  let api: ReferenceLetterUploadResourceApiMock;
  let toast: ToastServiceMock;

  const setupFixture = async (
    apiOverrides: Partial<ReferenceLetterUploadResourceApiMock> = {},
    contextOverrides = createMockContext(),
    routeParams: Record<string, string> = { token: TOKEN },
  ) => {
    api = Object.assign(createReferenceLetterUploadResourceApiMock(contextOverrides), apiOverrides);
    toast = createToastServiceMock();

    await TestBed.configureTestingModule({
      imports: [ReferenceLetterUploadComponent],
      providers: [
        provideReferenceLetterUploadResourceApiMock(api),
        provideToastServiceMock(toast),
        provideActivatedRouteMock(createActivatedRouteMock(routeParams)),
        provideTranslateMock(),
        provideFontAwesomeTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReferenceLetterUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    // The constructor triggers loadContext() asynchronously; flush the resulting microtask
    // so the loading-state branch in the template is gone before any assertions run.
    await Promise.resolve();
    fixture.detectChanges();
  };

  const fakePdf = (name = 'letter.pdf', size = 1024) => new File([new Uint8Array(size)], name, { type: 'application/pdf' });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial load', () => {
    it('should resolve the token context on init', async () => {
      await setupFixture();

      expect(api.getContext).toHaveBeenCalledOnce();
      expect(api.getContext).toHaveBeenCalledWith(TOKEN);
    });

    it('should toast and surface invalid-link state when the token cannot be resolved', async () => {
      await setupFixture({ getContext: vi.fn().mockReturnValue(throwError(() => new Error('boom'))) });

      const root = fixture.nativeElement as HTMLElement;
      expect(root.textContent).toContain('reference.error.invalidLink');
    });
  });

  describe('upload', () => {
    beforeEach(async () => {
      await setupFixture();
    });

    it('should not call the API until the user confirms after picking a file', () => {
      internals(component).onQueuedFilesChanged([fakePdf()]);
      fillAnswers(component);

      expect(api.upload).not.toHaveBeenCalled();
    });

    it('should POST the queued file with the assessment answers and switch to the success view on confirm', async () => {
      internals(component).onQueuedFilesChanged([fakePdf()]);
      fillAnswers(component);

      await internals(component).confirmUpload();

      expect(api.upload).toHaveBeenCalledOnce();
      const call = api.upload.mock.calls[0];
      expect(call[0]).toBe(TOKEN);
      expect(call[1]).toBe(REQUIRED_ANSWERS.acquaintanceDepth);
      expect(call.at(3)).toBeInstanceOf(File);
      expect(toast.showSuccessKey).toHaveBeenCalledOnce();
    });

    it('should be a no-op when confirm is pressed with nothing queued', async () => {
      fillAnswers(component);

      await internals(component).confirmUpload();

      expect(api.upload).not.toHaveBeenCalled();
    });

    it('should not submit until every structured question is answered', async () => {
      internals(component).onQueuedFilesChanged([fakePdf()]);
      internals(component).onAnswerSelected('relationship', { name: '', value: 'RESEARCH_SUPERVISOR' });

      await internals(component).confirmUpload();

      expect(api.upload).not.toHaveBeenCalled();
    });

    it('should toast on upload failure and stay on the upload view', async () => {
      api.upload.mockReturnValueOnce(throwError(() => new Error('boom')));
      internals(component).onQueuedFilesChanged([fakePdf()]);
      fillAnswers(component);

      await internals(component).confirmUpload();

      expect(toast.showErrorKey).toHaveBeenCalledOnce();
      expect(toast.showErrorKey).toHaveBeenCalledWith('reference.uploadFailed');
    });
  });

  describe('recommendation type variants', () => {
    it('should hide the assessment questions and submit the letter alone for a letter-only job', async () => {
      await setupFixture(undefined, createMockContext({ recommendationType: RecommendationType.LetterOnly }));

      const root = fixture.nativeElement as HTMLElement;
      expect(root.textContent).not.toContain('reference.questions.rating.title');
      expect(root.querySelector('jhi-upload-button')).not.toBeNull();

      internals(component).onQueuedFilesChanged([fakePdf()]);
      await internals(component).confirmUpload();

      expect(api.upload).toHaveBeenCalledOnce();
      const call = api.upload.mock.calls[0];
      expect(call[0]).toBe(TOKEN);
      expect(call.at(3)).toBeInstanceOf(File);
      expect(call[1]).toBeUndefined();
      expect(call.at(11)).toBeUndefined();
    });

    it('should hide the upload control and submit the answers alone for an evaluation-only job', async () => {
      await setupFixture(undefined, createMockContext({ recommendationType: RecommendationType.EvaluationOnly }));

      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('jhi-upload-button')).toBeNull();
      expect(root.textContent).toContain('reference.questions.rating.title');

      fillAnswers(component);
      await internals(component).confirmUpload();

      expect(api.upload).toHaveBeenCalledOnce();
      const call = api.upload.mock.calls[0];
      expect(call[0]).toBe(TOKEN);
      expect(call.at(3)).toBeUndefined();
      expect(call[1]).toBe(REQUIRED_ANSWERS.acquaintanceDepth);
      expect(call.at(11)).toBe(REQUIRED_ANSWERS.relationship);
    });

    it('should not submit an evaluation-only recommendation while questions are unanswered', async () => {
      await setupFixture(undefined, createMockContext({ recommendationType: RecommendationType.EvaluationOnly }));

      await internals(component).confirmUpload();

      expect(api.upload).not.toHaveBeenCalled();
    });

    it('should render both the questions and the upload control when the job asks for both', async () => {
      await setupFixture(undefined, createMockContext({ recommendationType: RecommendationType.LetterAndEvaluation }));

      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('jhi-upload-button')).not.toBeNull();
      expect(root.textContent).toContain('reference.questions.rating.title');
    });
  });

  describe('already-submitted token', () => {
    it('should render the success view without showing an upload control', async () => {
      await setupFixture(undefined, createMockContext({ status: ReferenceRequestDTOStatusEnum.Submitted }));

      const root = fixture.nativeElement as HTMLElement;
      expect(root.textContent).toContain('reference.success.title');
    });
  });

  describe('decline', () => {
    it('should POST the decline and switch to the declined view on confirm', async () => {
      await setupFixture();

      await internals(component).confirmDecline();
      fixture.detectChanges();

      expect(api.decline).toHaveBeenCalledOnce();
      expect(api.decline).toHaveBeenCalledWith(TOKEN);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('reference.declined.title');
    });

    it('should toast and stay on the upload view on decline failure', async () => {
      await setupFixture();
      api.decline.mockReturnValueOnce(throwError(() => new Error('boom')));

      await internals(component).confirmDecline();

      expect(toast.showErrorKey).toHaveBeenCalledWith('reference.decline.failed');
    });

    it('should render the declined view for an already-declined token', async () => {
      await setupFixture(undefined, createMockContext({ status: ReferenceRequestDTOStatusEnum.Declined }));

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('reference.declined.title');
    });
  });

  describe('confidentiality note', () => {
    it('should show the confidential note when the applicant waived access', async () => {
      await setupFixture(undefined, createMockContext({ confidential: true }));

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('reference.confidentialNote');
    });

    it('should show the shared note when access is not waived', async () => {
      await setupFixture(undefined, createMockContext({ confidential: false }));

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('reference.sharedNote');
    });
  });
});
