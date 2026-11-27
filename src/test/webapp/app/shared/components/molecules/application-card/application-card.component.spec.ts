import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslateService } from '@ngx-translate/core';
import { ApplicationCardComponent } from 'app/shared/components/molecules/application-card/application-card.component';
import { ApplicationEvaluationDetailDTO } from 'app/generated/model/application-evaluation-detail-dto';
import { ApplicationDetailDTO } from 'app/generated/model/application-detail-dto';
import { RecommendationDecision } from 'app/generated/model/recommendation-decision';
import { provideTranslateMock } from '../../../../../util/translate.mock';
import { provideFontAwesomeTesting } from '../../../../../util/fontawesome.testing';
import { provideThemeServiceMock } from '../../../../../util/theme.service.mock';

describe('ApplicationCardComponent', () => {
  let fixture: ComponentFixture<ApplicationCardComponent>;
  let component: ApplicationCardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApplicationCardComponent],
      providers: [provideTranslateMock(), provideFontAwesomeTesting(), provideThemeServiceMock()],
    }).compileComponents();

    fixture = TestBed.createComponent(ApplicationCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should return applicationDetailDTO when application is provided', () => {
    const detail: ApplicationDetailDTO = { applicationId: '123' } as ApplicationDetailDTO;
    const app: ApplicationEvaluationDetailDTO = { applicationDetailDTO: detail } as ApplicationEvaluationDetailDTO;

    fixture.componentRef.setInput('application', app);
    fixture.detectChanges();

    expect(component.applicationDetails()).toBe(detail);
  });

  it('should map states to severities correctly', () => {
    expect(component.stateSeverityMap.SENT).toBe('info');
    expect(component.stateSeverityMap.ACCEPTED).toBe('success');
    expect(component.stateSeverityMap.REJECTED).toBe('danger');
    expect(component.stateSeverityMap.IN_REVIEW).toBe('warn');
  });

  it.each<[number | undefined, RecommendationDecision | undefined]>([
    [undefined, undefined],
    [-2, RecommendationDecision.StrongFail],
    [-1.5, RecommendationDecision.StrongFail],
    [-1.4, RecommendationDecision.SoftFail],
    [-0.5, RecommendationDecision.SoftFail],
    [-0.4, RecommendationDecision.Neutral],
    [0, RecommendationDecision.Neutral],
    [0.4, RecommendationDecision.Neutral],
    [0.5, RecommendationDecision.SoftPass],
    [1.4, RecommendationDecision.SoftPass],
    [1.5, RecommendationDecision.StrongPass],
  ])('should show the decision closest to the average %s', (averageRating, expected) => {
    const detail: ApplicationDetailDTO = { applicationId: '123' } as ApplicationDetailDTO;
    const app: ApplicationEvaluationDetailDTO = { applicationDetailDTO: detail, averageRating };

    fixture.componentRef.setInput('application', app);
    fixture.detectChanges();

    expect(component.averageDecision()).toBe(expected);
  });

  it('should hide the rating count when no ratings are present', () => {
    const detail: ApplicationDetailDTO = { applicationId: '123' } as ApplicationDetailDTO;
    const app = { applicationDetailDTO: detail, ratingCount: 0 } as ApplicationEvaluationDetailDTO;

    fixture.componentRef.setInput('application', app);
    fixture.detectChanges();

    expect(component.ratingCount()).toBeUndefined();
  });

  it('should expose the rating count when at least one rating exists', () => {
    const detail: ApplicationDetailDTO = { applicationId: '123' } as ApplicationDetailDTO;
    const app = { applicationDetailDTO: detail, ratingCount: 2 } as ApplicationEvaluationDetailDTO;

    fixture.componentRef.setInput('application', app);
    fixture.detectChanges();

    expect(component.ratingCount()).toBe(2);
  });
});
