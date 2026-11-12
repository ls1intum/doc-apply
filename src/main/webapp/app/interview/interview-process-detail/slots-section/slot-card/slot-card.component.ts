import { hasText } from 'app/shared/util/text.util';
import { Component, computed, input, output, signal } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { InterviewSlotDTO } from 'app/generated/model/interview-slot-dto';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';
import { JhiMenuItem, MenuComponent } from 'app/shared/components/atoms/menu/menu.component';
import TranslateDirective from 'app/shared/language/translate.directive';
import { formatTimeRange } from 'app/shared/util/date-time.util';
import { formatFullName } from 'app/shared/util/name.util';
import { isVirtualLocation } from 'app/shared/util/location.util';

@Component({
  selector: 'jhi-slot-card',
  standalone: true,
  imports: [TranslateModule, TranslateDirective, ButtonComponent, FontAwesomeModule, ConfirmDialog, MenuComponent],
  templateUrl: './slot-card.component.html',
})
export class SlotCardComponent {
  slot = input.required<InterviewSlotDTO>();
  isClosed = input<boolean>(false);

  editSlot = output<InterviewSlotDTO>();
  deleteSlot = output<InterviewSlotDTO>();
  assignApplicant = output<InterviewSlotDTO>();

  showDeleteDialog = signal(false);

  // Computed values
  timeRange = computed(() => formatTimeRange(this.slot().startDateTime, this.slot().endDateTime));
  isVirtual = computed(() => isVirtualLocation(this.slot().location));
  isBooked = computed(() => this.slot().isBooked ?? false);
  isPast = computed(() => {
    const start = this.slot().startDateTime;
    return hasText(start) && new Date(start).getTime() < Date.now();
  });
  applicantName = computed(() => {
    const interviewee = this.slot().interviewee;
    if (!interviewee) return '';
    return formatFullName(interviewee.firstName, interviewee.lastName);
  });

  cancelInterview = output<InterviewSlotDTO>();

  // Menu items for kebab menu
  readonly menuItems = computed<JhiMenuItem[]>(() => {
    const items: JhiMenuItem[] = [
      {
        label: 'button.edit',
        icon: 'pencil',
        command: () => this.onEdit(),
        severity: 'primary',
      },
    ];

    if (this.isBooked()) {
      items.push({
        label: 'interview.slots.cancelInterview.triggerButton',
        icon: 'xmark',
        command: () => this.onCancelInterview(),
        severity: 'danger',
      });
    } else {
      items.push({
        label: 'button.delete',
        icon: 'trash',
        command: () => {
          this.showDeleteDialog.set(true);
        },
        severity: 'danger',
      });
    }

    return items;
  });

  onCancelInterview(): void {
    this.cancelInterview.emit(this.slot());
  }

  onEdit(): void {
    this.editSlot.emit(this.slot());
  }

  onDelete(): void {
    this.deleteSlot.emit(this.slot());
  }

  onAssign(): void {
    this.assignApplicant.emit(this.slot());
  }
}
