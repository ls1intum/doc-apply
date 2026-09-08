import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { UpcomingInterviewDTO } from 'app/generated/model/upcoming-interview-dto';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { UserAvatarComponent } from 'app/shared/components/atoms/user-avatar/user-avatar.component';
import { ClickableDirective } from 'app/shared/directives/clickable.directive';
import dayjs from 'dayjs/esm';

@Component({
  selector: 'jhi-upcoming-interview-card',
  imports: [FontAwesomeModule, UserAvatarComponent, ClickableDirective],
  templateUrl: './upcoming-interview-card.component.html',
})
export class UpcomingInterviewCardComponent {
  // Inputs
  interview = input.required<UpcomingInterviewDTO>();

  // Computed
  intervieweeName = computed(() => this.interview().intervieweeName ?? '');
  avatarUrl = computed(() => this.interview().avatar);

  formattedTimeRange = computed(() => {
    const i = this.interview();
    return `${dayjs(i.startDateTime).format('HH:mm')} - ${dayjs(i.endDateTime).format('HH:mm')}`;
  });

  location = computed(() => this.interview().location ?? '');

  meetingUrl = computed(() => {
    const loc = this.location().trim();
    return loc.startsWith('http') ? loc : null;
  });

  isVirtual = computed(
    () =>
      this.meetingUrl() !== null ||
      this.location().toLowerCase().includes('virtual') ||
      this.location().toLowerCase().includes('zoom') ||
      this.location().toLowerCase().includes('teams'),
  );

  // Services
  private readonly router = inject(Router);

  // Public Methods
  navigateToAssessment(event: Event): void {
    // Only navigate if the click was not on a link or other interactive element
    if ((event.target as HTMLElement).closest('a')) {
      return;
    }

    const i = this.interview();
    void this.router.navigate(['/interviews', 'process', i.processId, 'interviewee', i.intervieweeId, 'assessment'], {
      queryParams: { from: 'overview' },
    });
  }
}
