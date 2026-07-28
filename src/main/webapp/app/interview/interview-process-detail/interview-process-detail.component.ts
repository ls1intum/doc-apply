import { hasText } from 'app/shared/util/text.util';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Title } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { InterviewResourceApi } from 'app/generated/api/interview-resource-api';
import { ToastService } from 'app/service/toast-service';
import { JobDetailDTOStateEnum } from 'app/generated/model/job-detail-dto';
import { BackButtonComponent } from 'app/shared/components/atoms/back-button/back-button.component';
import { TagComponent } from 'app/shared/components/atoms/tag/tag.component';
import { IntervieweeSectionComponent } from 'app/interview/interview-process-detail/interviewee-section/interviewee-section.component';

import { SlotsSectionComponent } from './slots-section/slots-section.component';

@Component({
  selector: 'jhi-interview-process-detail',
  standalone: true,
  imports: [TranslateModule, BackButtonComponent, TagComponent, SlotsSectionComponent, IntervieweeSectionComponent],
  templateUrl: './interview-process-detail.component.html',
})
export class InterviewProcessDetailComponent {
  processId = signal<string | undefined>(undefined);
  readonly safeProcessId = computed(() => this.processId() ?? '');
  jobId = signal<string | undefined>(undefined);
  jobTitle = signal<string | undefined>(undefined);
  jobState = signal<string | undefined>(undefined);
  readonly safeJobTitle = computed(() => this.jobTitle() ?? '');
  readonly isJobClosed = computed(
    () => this.jobState() === JobDetailDTOStateEnum.Closed || this.jobState() === JobDetailDTOStateEnum.ApplicantFound,
  );

  // Signal to trigger interviewee section reload
  intervieweeRefreshKey = signal(0);
  // Signal to trigger slots section reload
  slotsRefreshKey = signal(0);
  invitedCount = signal(0);
  hasSlots = signal(false);

  private readonly route = inject(ActivatedRoute);
  private readonly interviewApi = inject(InterviewResourceApi);
  private readonly titleService = inject(Title);
  private readonly toastService = inject(ToastService);

  private readonly updateTitleEffect = effect(() => {
    const title = this.jobTitle();
    if (hasText(title)) {
      this.updateTabTitle(title);
    }
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('processId') ?? undefined;
    if (hasText(id)) {
      this.processId.set(id);
      void this.loadProcessDetails(id);
    }
  }

  onSlotAssigned(): void {
    this.intervieweeRefreshKey.update(currentKey => currentKey + 1);
  }

  onSlotCancelled(): void {
    this.slotsRefreshKey.update(k => k + 1);
  }

  private updateTabTitle(jobTitle: string): void {
    this.titleService.setTitle(`Interview – ${jobTitle}`);
  }

  private async loadProcessDetails(processId: string): Promise<void> {
    try {
      const process = await firstValueFrom(this.interviewApi.getInterviewProcessDetails(processId));

      if (process.jobTitle) {
        this.jobTitle.set(process.jobTitle);
      }
      if (process.jobId) {
        this.jobId.set(process.jobId);
      }
      if (process.jobState) {
        this.jobState.set(process.jobState);
      }
      this.invitedCount.set(process.invitedCount);
    } catch {
      this.toastService.showErrorKey('interview.detail.error.loadFailed');
    }
  }
}
