import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { AiResourceApi } from 'app/generated/api/ai-resource-api';
import { AiFeatureStatusService } from 'app/service/ai-feature-status.service';
import { AiExtractionBoxComponent } from 'app/shared/components/molecules/ai-extraction-box/ai-extraction-box.component';
import { provideHttpClientMock } from 'util/http-client.mock';
import { provideTranslateMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { createToastServiceMock, provideToastServiceMock } from 'util/toast-service.mock';
import { provideAccountServiceMock } from 'util/account.service.mock';

describe('AiExtractionBoxComponent', () => {
  const toastServiceMock = createToastServiceMock();
  const extractPdfData = vi.fn();

  const createComponent = (applicationId: string): AiExtractionBoxComponent => {
    const fixture = TestBed.createComponent(AiExtractionBoxComponent);
    fixture.componentRef.setInput('applicationId', applicationId);
    fixture.componentRef.setInput('documentIds', [{ id: 'doc-1', size: 1 }]);
    fixture.componentRef.setInput('isCv', true);
    TestBed.inject(AiFeatureStatusService).aiSystemEnabled.set(true);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [AiExtractionBoxComponent],
      providers: [
        provideHttpClientMock(),
        provideTranslateMock(),
        provideFontAwesomeTesting(),
        provideToastServiceMock(toastServiceMock),
        provideAccountServiceMock(),
        { provide: AiResourceApi, useValue: { extractPdfData } },
      ],
    });
  });

  it('should show a success toast and stop extracting when extraction succeeds', async () => {
    extractPdfData.mockReturnValue(of({ firstName: 'Ada' }));
    const comp = createComponent('app-success');

    await comp.extractAiData();

    expect(toastServiceMock.showSuccessKey).toHaveBeenCalledExactlyOnceWith('entity.aiExtraction.aiExtractionSuccess');
    expect(comp.isExtractingAi()).toBe(false);
  });

  it('should show an error toast and stop extracting when extraction fails', async () => {
    extractPdfData.mockReturnValue(throwError(() => new Error('AI unreachable')));
    const comp = createComponent('app-error');

    await comp.extractAiData();

    expect(toastServiceMock.showErrorKey).toHaveBeenCalledExactlyOnceWith('entity.aiExtraction.aiExtractionFailed');
    expect(comp.isExtractingAi()).toBe(false);
  });
});
