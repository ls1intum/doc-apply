import { Injectable, inject, signal } from '@angular/core';
import { Observable, Subject, catchError, debounceTime, finalize, merge, of, shareReplay, switchMap } from 'rxjs';
import { GenderBiasAnalysisRequest } from 'app/generated/model/gender-bias-analysis-request';
import { GenderBiasAnalysisResourceApi } from 'app/generated/api/gender-bias-analysis-resource-api';
import { GenderBiasAnalysisResponse } from 'app/generated/model/gender-bias-analysis-response';

@Injectable({ providedIn: 'root' })
export class GenderBiasAnalysisService {
  private readonly analyzeSubjects = new Map<string, Subject<{ text: string; language: string }>>();
  private readonly immediateAnalyzeSubjects = new Map<string, Subject<{ text: string; language: string }>>();
  private readonly analyses = new Map<string, Observable<GenderBiasAnalysisResponse | undefined>>();
  private readonly lastLanguages = new Map<string, string>();
  private readonly firstLoads = new Set<string>();
  private readonly analyzingFields = signal<ReadonlySet<string>>(new Set());

  private readonly genderBiasApi = inject(GenderBiasAnalysisResourceApi);

  getAnalysisForField(fieldId: string): Observable<GenderBiasAnalysisResponse | undefined> {
    if (!this.analyses.has(fieldId)) {
      const analyzeSubject = new Subject<{ text: string; language: string }>();
      const immediateAnalyzeSubject = new Subject<{ text: string; language: string }>();

      this.analyzeSubjects.set(fieldId, analyzeSubject);
      this.immediateAnalyzeSubjects.set(fieldId, immediateAnalyzeSubject);

      const analysis$ = merge(analyzeSubject.pipe(debounceTime(400)), immediateAnalyzeSubject).pipe(
        switchMap(({ text, language }) => {
          if (!text || text.trim() === '') {
            return of(undefined);
          }
          this.setAnalyzing(fieldId, true);
          return this.analyzeHtmlContent({ text, language }).pipe(
            catchError(() => of(undefined)),
            finalize(() => this.setAnalyzing(fieldId, false)),
          );
        }),
        shareReplay(1),
      );

      this.analyses.set(fieldId, analysis$);
    }

    return this.analyses.get(fieldId) ?? of(undefined);
  }

  /**
   * Whether a gender-bias request for the given field is currently in flight.
   *
   * @param fieldId the analyzed form field
   */
  isAnalyzing(fieldId: string): boolean {
    return this.analyzingFields().has(fieldId);
  }

  analyzeHtmlContent(request: GenderBiasAnalysisRequest): Observable<GenderBiasAnalysisResponse> {
    return this.genderBiasApi.analyzeHtmlContent(request);
  }

  triggerAnalysis(fieldId: string, text: string, language: string): void {
    const lastLanguage = this.lastLanguages.get(fieldId);
    const isFirstLoad = !this.firstLoads.has(fieldId);

    const languageChanged = lastLanguage !== undefined && lastLanguage !== language;
    const shouldBeImmediate = languageChanged || isFirstLoad;

    const analyzeSubject = this.analyzeSubjects.get(fieldId);
    const immediateAnalyzeSubject = this.immediateAnalyzeSubjects.get(fieldId);

    if (!analyzeSubject || !immediateAnalyzeSubject) {
      this.getAnalysisForField(fieldId);
      this.triggerAnalysis(fieldId, text, language);
      return;
    }

    if (shouldBeImmediate) {
      immediateAnalyzeSubject.next({ text, language });
    } else {
      analyzeSubject.next({ text, language });
    }

    this.lastLanguages.set(fieldId, language);
    this.firstLoads.add(fieldId);
  }

  private setAnalyzing(fieldId: string, analyzing: boolean): void {
    this.analyzingFields.update(fields => {
      const next = new Set(fields);
      if (analyzing) {
        next.add(fieldId);
      } else {
        next.delete(fieldId);
      }
      return next;
    });
  }
}
