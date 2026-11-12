import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { JobCardComponent } from 'app/job/job-overview/job-card/job-card.component';
import { JobResourceApi } from 'app/generated/api/job-resource-api';
import { JobCardDTO } from 'app/generated/model/job-card-dto';
import { ToastService } from 'app/service/toast-service';
import { Router } from '@angular/router';
import { TranslateDirective } from 'app/shared/language';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';

@Component({
  selector: 'jhi-jobs-preview-section',
  standalone: true,
  imports: [ButtonComponent, JobCardComponent, TranslateDirective],
  templateUrl: './jobs-preview-section.component.html',
})
export class JobsPreviewSectionComponent {
  readonly jobApi = inject(JobResourceApi);
  readonly toastService = inject(ToastService);
  readonly router = inject(Router);

  readonly jobs = signal<JobCardDTO[]>([]);
  readonly pageSize = signal<number>(4);

  readonly hasJobs = computed(() => this.jobs().length > 0);

  constructor() {
    void this.loadJobs();
  }

  async loadJobs(): Promise<void> {
    try {
      const jobs = await firstValueFrom(
        this.jobApi.getAvailableJobs(this.pageSize(), 0, undefined, undefined, undefined, 'startDate', 'DESC'),
      );
      this.jobs.set(jobs.content ?? []);
    } catch {
      this.jobs.set([]);
      this.toastService.showErrorKey('landingPage.jobsPreview.loadFailed');
    }
  }

  // Rotate through bundled banner images when a job has no dedicated header image.

  goToJobOverview(): void {
    void this.router.navigate(['/job-overview']);
  }

  getExampleImageUrl(index: number): string {
    const headerImages = [
      '/content/images/job-banner/job-banner1.jpg',
      '/content/images/job-banner/job-banner2.jpg',
      '/content/images/job-banner/job-banner3.jpg',
      '/content/images/job-banner/job-banner4.jpg',
      '/content/images/job-banner/job-banner5.jpg',
      '/content/images/job-banner/job-banner6.jpg',
    ];

    return headerImages[index % headerImages.length];
  }
}
