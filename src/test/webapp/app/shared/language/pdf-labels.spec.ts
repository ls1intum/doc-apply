import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { provideTranslateMock } from '../../../util/translate.mock';
import { formatGradeDisplay, getApplicationPDFLabels, getJobPDFLabels } from 'app/shared/language/pdf-labels';

describe('PDF Labels', () => {
  let translate: TranslateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideTranslateMock()],
    });
    translate = TestBed.inject(TranslateService);
  });

  describe('getApplicationPDFLabels', () => {
    it('should return correct translation keys', () => {
      const labels = getApplicationPDFLabels(translate);

      expect(labels).toMatchObject({
        applicationBy: 'pdf.headerItems.applicationBy',
        headline: 'entity.application_detail.headline',
        overview: 'entity.application_detail.position_overview',
        supervisor: 'jobDetailPage.header.supervisor',
        location: 'jobDetailPage.header.location',
        subjectArea: 'jobDetailPage.labels.subjectArea:',
        researchArea: 'jobDetailPage.labels.researchArea:',
        workload: 'jobDetailPage.labels.workload:',
        duration: 'jobDetailPage.labels.contractDuration:',
        fundingType: 'jobDetailPage.labels.fundingType:',
        startDate: 'jobDetailPage.labels.startDate:',
        endDate: 'jobDetailPage.labels.applicationEndDate:',
        personalStatements: 'entity.application_detail.personal_statements',
        bachelorInfo: 'entity.detail_card.bachelor_info',
        masterInfo: 'entity.detail_card.master_info',
        jobDetails: 'pdf.sections.jobDetails',
      });
    });
  });

  describe('getJobPDFLabels', () => {
    it('should return correct translation keys', () => {
      const labels = getJobPDFLabels(translate);

      expect(labels).toMatchObject({
        jobBy: 'pdf.headerItems.jobBy',
        forJob: 'pdf.headerItems.forJob',
        status: 'pdf.headerItems.status',
        supervisor: 'jobDetailPage.header.supervisor',
        subjectArea: 'jobDetailPage.labels.subjectArea:',
        contactDetails: 'pdf.sections.contactDetails',
        address: 'researchGroup.groupInfo.fields.section3',
        jobPdfEnding: 'pdf.jobPdfEnding',
        overview: 'jobDetailPage.cards.positionOverview',
      });
    });
  });

  describe('Shared labels', () => {
    it('should share overview and footer labels', () => {
      const appLabels = getApplicationPDFLabels(translate);
      const jobLabels = getJobPDFLabels(translate);

      ['supervisor', 'location', 'subjectArea', 'workload', 'startDate', 'jobDetails', 'page', 'of', 'lang'].forEach(key => {
        expect(appLabels[key]).toBe(jobLabels[key]);
      });
      expect(appLabels['jobGenderSuffix']).toBe('jobGenderSuffix');
      expect(jobLabels['jobGenderSuffix']).toBe('jobGenderSuffix');
    });
  });

  describe('formatGradeDisplay', () => {
    const grade = '1.5';
    const upperLimit = '1.0';
    const lowerLimit = '4.0';

    afterEach(() => {
      vi.resetAllMocks();
    });

    it.each([
      [undefined, undefined, undefined, '-'],
      ['', undefined, undefined, '-'],
      [grade, undefined, lowerLimit, grade],
      [grade, upperLimit, undefined, grade],
      [grade, undefined, undefined, grade],
    ])('should return %s for grade=%s upper=%s lower=%s', (g, u, l, expected) => {
      expect(formatGradeDisplay(translate, g, u, l)).toBe(expected);
    });

    it('should return formatted grade with translated scale and call translate.instant once', () => {
      const instantSpy = vi.spyOn(translate, 'instant');

      const result = formatGradeDisplay(translate, grade, upperLimit, lowerLimit);

      const expectedScale = translate.instant('entity.applicationPage2.helperText.gradingScale', {
        upperLimit,
        lowerLimit,
      });
      expect(result).toBe(`${grade} (${expectedScale})`);
      expect(instantSpy).toHaveBeenCalledWith('entity.applicationPage2.helperText.gradingScale', { upperLimit, lowerLimit });
    });

    it('should not call translate.instant when grade or limits are absent', () => {
      const instantSpy = vi.spyOn(translate, 'instant');

      formatGradeDisplay(translate, undefined, upperLimit, lowerLimit);
      formatGradeDisplay(translate, grade);

      expect(instantSpy).not.toHaveBeenCalled();
    });
  });
});
