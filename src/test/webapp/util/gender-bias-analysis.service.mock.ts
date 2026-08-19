import { Provider } from '@angular/core';
import { vi } from 'vitest';
import { BehaviorSubject, of } from 'rxjs';
import { GenderBiasAnalysisResponse } from 'app/generated/model/gender-bias-analysis-response';
import { GenderBiasAnalysisService } from 'app/shared/gender-bias-analysis/gender-bias-analysis';

export type GenderBiasAnalysisServiceMock = Pick<GenderBiasAnalysisService, 'triggerAnalysis' | 'getAnalysisForField' | 'isAnalyzing'>;
export function createGenderBiasAnalysisServiceMock(): GenderBiasAnalysisServiceMock {
  const analysisSubject = new BehaviorSubject<GenderBiasAnalysisResponse | undefined>(undefined);

  return {
    triggerAnalysis: vi.fn(),
    getAnalysisForField: vi.fn().mockReturnValue(analysisSubject.asObservable()),
    isAnalyzing: vi.fn().mockReturnValue(false),
  };
}

export function provideGenderBiasAnalysisServiceMock(
  mock: GenderBiasAnalysisServiceMock = createGenderBiasAnalysisServiceMock(),
): Provider {
  return { provide: GenderBiasAnalysisService, useValue: mock };
}
