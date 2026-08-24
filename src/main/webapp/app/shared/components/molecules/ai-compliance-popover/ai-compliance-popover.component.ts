import { CommonModule } from '@angular/common';
import { ComplianceIssueDTO as ComplianceIssue } from 'app/generated/model/compliance-issue-dto';
import { Component, computed, input, output } from '@angular/core';
import { ComplianceIssueActionEnum } from 'app/generated/model/compliance-issue';
import { SuggestionSystemComponent } from 'app/shared/components/molecules/suggestion-system/suggestion-system.component';

@Component({
  selector: 'jhi-compliance-popover',
  standalone: true,
  imports: [CommonModule, SuggestionSystemComponent],
  templateUrl: './ai-compliance-popover.component.html',
})
export class CompliancePopoverComponent {
  issue = input<ComplianceIssue | undefined>(undefined);

  /** Viewport X coordinate. Positions the popover horizontally near the hovered word. */
  x = input<number>(0);

  /** Viewport Y coordinate. Positions the popover just below the highlighted span. */
  y = input<number>(0);

  readonly accept = output<ComplianceIssue>();
  readonly dismiss = output<ComplianceIssue>();
  readonly closed = output();

  readonly actionButtonLabel = computed(() => {
    switch (this.issue()?.action) {
      case ComplianceIssueActionEnum.Replace:
        return 'jobCreationForm.positionDetailsSection.jobDescription.popover.replaceButton';
      case ComplianceIssueActionEnum.Add:
        return 'jobCreationForm.positionDetailsSection.jobDescription.popover.addButton';
      case ComplianceIssueActionEnum.Remove:
        return 'jobCreationForm.positionDetailsSection.jobDescription.popover.removeButton';
      default:
        return 'jobCreationForm.positionDetailsSection.jobDescription.popover.applyButton';
    }
  });

  onAccept(): void {
    const issue = this.issue();
    if (issue) this.accept.emit(issue);
  }

  onDismiss(): void {
    const issue = this.issue();
    if (issue) this.dismiss.emit(issue);
  }
}
