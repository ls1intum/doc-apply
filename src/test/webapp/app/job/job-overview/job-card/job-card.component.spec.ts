import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobCardComponent } from 'app/job/job-overview/job-card/job-card.component';
import { UserAvatarComponent } from 'app/shared/components/atoms/user-avatar/user-avatar.component';
import { provideTranslateMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';

describe('JobCardComponent', () => {
  let fixture: ComponentFixture<JobCardComponent>;
  let component: JobCardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JobCardComponent],
      providers: [provideRouter([]), provideTranslateMock(), provideFontAwesomeTesting()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(JobCardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Navigation', () => {
    it('should point the card link to the job detail page', () => {
      fixture.componentRef.setInput('jobId', 'abc-123');
      fixture.detectChanges();

      const link = fixture.debugElement.query(By.directive(RouterLink));
      const routerLinkInstance = link.injector.get(RouterLink);

      expect(routerLinkInstance.href).toBe('/job/detail/abc-123');
    });
  });

  describe('Formatted Workload', () => {
    it('should format full-time workload (40 hours)', () => {
      fixture.componentRef.setInput('workload', 40);
      fixture.detectChanges();

      expect(component.formattedWorkload()).toBe('jobDetailPage.workload.fullTime');
    });

    it('should format part-time workload with percentage', () => {
      fixture.componentRef.setInput('workload', 20);
      fixture.detectChanges();

      expect(component.formattedWorkload()).toBe('jobDetailPage.workload.partTime');
    });

    it('should return undefined when workload is not set', () => {
      fixture.detectChanges();

      expect(component.formattedWorkload()).toBeUndefined();
    });
  });

  describe('Formatted Contract Duration', () => {
    it('should return the contract duration when set', () => {
      fixture.componentRef.setInput('contractDuration', 12);
      fixture.detectChanges();

      expect(component.formattedContractDuration()).toBe(12);
    });

    it('should return undefined when contract duration is not set', () => {
      fixture.detectChanges();

      expect(component.formattedContractDuration()).toBeUndefined();
    });
  });

  describe('Avatar Rendering', () => {
    it('should pass the professor avatar URL to the user avatar component', () => {
      fixture.componentRef.setInput('professor', 'Prof. Jane Doe');
      fixture.componentRef.setInput('avatarUrl', '/images/profiles/prof-jane.jpg');
      fixture.detectChanges();

      const avatarComponent = fixture.debugElement.query(By.directive(UserAvatarComponent)).componentInstance as UserAvatarComponent;

      expect(avatarComponent.fullName()).toBe('Prof. Jane Doe');
      expect(avatarComponent.avatarUrl()).toBe('/images/profiles/prof-jane.jpg');
    });
  });
});
