import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslateService } from '@ngx-translate/core';
import { ApplicationCardComponent } from 'app/shared/components/molecules/application-card/application-card.component';
import { ApplicationEvaluationDetailDTO } from 'app/generated/model/application-evaluation-detail-dto';
import { ApplicationDetailDTO } from 'app/generated/model/application-detail-dto';
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

  it('should return undefined displayRating when no averageRating is set', () => {
    const detail: ApplicationDetailDTO = { applicationId: '123' } as ApplicationDetailDTO;
    const app = { applicationDetailDTO: detail } as ApplicationEvaluationDetailDTO;

    fixture.componentRef.setInput('application', app);
    fixture.detectChanges();

    expect(component.displayRating()).toBeUndefined();
  });

  it('should convert Likert averageRating to the 1-5 displayRating scale', () => {
    const detail: ApplicationDetailDTO = { applicationId: '123' } as ApplicationDetailDTO;
    const app = { applicationDetailDTO: detail, averageRating: 0 } as ApplicationEvaluationDetailDTO;

    fixture.componentRef.setInput('application', app);
    fixture.detectChanges();

    expect(component.displayRating()).toBe(3);
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

  it('should open the grade conversion hint with its working link', async () => {
    const translateService = TestBed.inject(TranslateService);
    vi.mocked(translateService.instant).mockReturnValue(
      'Original Grade: 1.3<br>Using <a href="https://example.org/kmk">KMK resolution</a>',
    );
    const detail: ApplicationDetailDTO = {
      applicationId: '123',
      applicant: { masterDegreeName: 'M.Sc. Informatics', masterGrade: '1.3', user: { name: 'Ada Lovelace' } },
    } as ApplicationDetailDTO;
    const app = { applicationDetailDTO: detail } as ApplicationEvaluationDetailDTO;
    fixture.componentRef.setInput('application', app);
    fixture.detectChanges();

    const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-haspopup]');
    trigger?.click();
    await fixture.whenStable();

    const link = document.body.querySelector<HTMLAnchorElement>('a[href="https://example.org/kmk"]');
    expect(trigger).not.toBeNull();
    expect(link?.textContent).toBe('KMK resolution');
  });
});
