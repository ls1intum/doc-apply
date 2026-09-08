import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Router, provideRouter } from '@angular/router';
import { JobsPreviewSectionComponent } from 'app/shared/pages/landing-page/jobs-preview-section/jobs-preview-section.component';
import { JobCardComponent } from 'app/job/job-overview/job-card/job-card.component';
import { JobResourceApi } from 'app/generated/api/job-resource-api';
import { JobFormDTOSubjectAreaEnum } from 'app/generated/model/job-form-dto';
import { JobCardDTOLocationEnum } from 'app/generated/model/job-card-dto';
import { createToastServiceMock, provideToastServiceMock } from 'util/toast-service.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';

class JobResourceApiMock {
  getAvailableJobs = vi.fn();
}

describe('JobsPreviewSectionComponent', () => {
  let fixture: ComponentFixture<JobsPreviewSectionComponent>;
  let component: JobsPreviewSectionComponent;
  let api: JobResourceApiMock;
  let mockToast: ReturnType<typeof createToastServiceMock>;

  const mockJob = {
    jobId: 'job1',
    title: 'Job 1',
    subjectArea: JobFormDTOSubjectAreaEnum.ComputerScience,
    location: JobCardDTOLocationEnum.Garching,
    professorName: 'Prof. John',
    workload: 20,
    startDate: '2025-09-01',
    applicationId: undefined,
    contractDuration: 6,
    avatar: '/images/profiles/prof-john.jpg',
    imageUrl: undefined,
  };

  const mockResponse = { content: [mockJob, Object.assign({}, mockJob, { jobId: 'job2' })], totalElements: 2 };

  beforeEach(async () => {
    api = new JobResourceApiMock();
    api.getAvailableJobs.mockReturnValue(of(mockResponse));
    mockToast = createToastServiceMock();

    await TestBed.configureTestingModule({
      imports: [JobsPreviewSectionComponent],
      providers: [
        { provide: JobResourceApi, useValue: api },
        provideToastServiceMock(mockToast),
        provideTranslateMock(),
        provideRouter([]),
        provideFontAwesomeTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(JobsPreviewSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fixture?.destroy();
  });

  it('should load jobs on init', () => {
    expect(api.getAvailableJobs).toHaveBeenCalledWith(4, 0, undefined, undefined, undefined, 'startDate', 'DESC');
    expect(component.jobs().length).toBe(2);
  });

  it('should navigate to job overview on See more click', () => {
    const router = TestBed.inject(Router);
    const spy = vi.spyOn(router, 'navigate');
    component.goToJobOverview();
    expect(spy).toHaveBeenCalledWith(['/job-overview']);
  });

  it('should use the fallback header image when job.imageUrl is missing', () => {
    fixture.detectChanges();
    const jobCardDebugEl = fixture.debugElement.query(By.directive(JobCardComponent));
    expect(jobCardDebugEl).toBeTruthy();

    const jobCard = jobCardDebugEl.componentInstance as JobCardComponent;
    expect(jobCard.headerImageUrl()).toBe(component.getExampleImageUrl(0));
  });

  it('should pass the professor avatar to the job card', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.innerHTML).toContain('/images/profiles/prof-john.jpg');
  });

  it('should handle error on load and show toast', async () => {
    api.getAvailableJobs.mockReturnValueOnce(throwError(() => new Error('fail')));
    await component.loadJobs();
    expect(component.jobs()).toEqual([]);
    expect(mockToast.showErrorKey).toHaveBeenCalledWith('landingPage.jobsPreview.loadFailed');
  });

  it('should show no jobs message when API returns empty content', async () => {
    api.getAvailableJobs.mockReturnValueOnce(of({ content: [], totalElements: 0 }));
    await component.loadJobs();
    fixture.detectChanges();

    expect(component.jobs()).toEqual([]);
    const noJobsEl = fixture.nativeElement.querySelector('.text-center p');
    expect(noJobsEl).toBeTruthy();
    expect(noJobsEl.getAttribute('jhiTranslate')).toBe('landingPage.jobsPreview.noJobs');
  });

  it('should handle missing content and set empty jobs', async () => {
    api.getAvailableJobs.mockReturnValueOnce(of({ totalElements: 0 }));
    await component.loadJobs();
    expect(component.jobs()).toEqual([]);
  });
});
