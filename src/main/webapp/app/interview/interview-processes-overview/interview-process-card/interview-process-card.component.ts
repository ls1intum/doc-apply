import { Component, computed, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { InterviewOverviewDTO } from 'app/generated/model/interview-overview-dto';
import { TranslateDirective } from 'app/shared/language';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { MessageComponent } from 'app/shared/components/atoms/message/message.component';
import { TagComponent } from 'app/shared/components/atoms/tag/tag.component';

type ProcessStatus = 'ACTIVE' | 'CLOSED' | 'NEW';

@Component({
  standalone: true,
  selector: 'jhi-interview-process-card',
  imports: [TranslateModule, TranslateDirective, FontAwesomeModule, MessageComponent, TagComponent],
  templateUrl: './interview-process-card.component.html',
})
export class InterviewProcessCardComponent {
  process = input.required<InterviewOverviewDTO>();
  cardClick = output<string>();

  /**
   * Computed status based on the job's state
   */
  processStatus = computed<ProcessStatus>(() => {
    return this.process().isClosed === true ? 'CLOSED' : 'ACTIVE';
  });

  isClosed = computed(() => this.processStatus() === 'CLOSED');

  totalSlots = computed<number>(() => {
    return this.process().totalSlots;
  });

  /**
   * Computed message key for the "not enough slots" warning
   */
  warningMessage = computed<string | undefined>(() => {
    if (this.isClosed() || this.process().invitedCount <= this.totalSlots()) {
      return undefined;
    }

    if (this.totalSlots() === 0) {
      return this.process().invitedCount === 1 ? 'interview.warning.zeroSlotsSingular' : 'interview.warning.zeroSlots';
    } else {
      return this.process().invitedCount === 1 ? 'interview.warning.notEnoughSlotsSingular' : 'interview.warning.notEnoughSlots';
    }
  });

  onCardClick(): void {
    this.cardClick.emit(this.process().jobId);
  }
}
