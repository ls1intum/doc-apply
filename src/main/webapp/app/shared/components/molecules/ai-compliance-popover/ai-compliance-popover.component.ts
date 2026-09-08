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
/**
 * Floating popover for a single compliance issue.
 *
 * Shows the issue's article, explanation and AI suggestion, and lets the user either
 * apply the suggestion or dismiss the issue. The parent owns the issue list and the
 * popover position; this component only reports what the user chose.
 */
export class CompliancePopoverComponent {
  /** Issue to display. While undefined the popover stays hidden. */
  issue = input<ComplianceIssue | undefined>(undefined);

  /** Viewport X coordinate. Positions the popover horizontally near the hovered word. */
  x = input<number>(0);

  /** Viewport Y coordinate. Positions the popover just below the highlighted span. */
  y = input<number>(0);

  /** Emits the displayed issue when the user applies its suggestion. */
  readonly accept = output<ComplianceIssue>();

  /** Emits the displayed issue when the user dismisses it without applying the suggestion. */
  readonly dismiss = output<ComplianceIssue>();

  /** Emits when the pointer leaves the popover, so the parent can hide it. */
  readonly closed = output();

  /** Translation key for the action button, chosen from the issue's action so the label matches what applying it does. */
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

  /**
   * Forwards the accept action for the currently displayed issue.
   */
  onAccept(): void {
    const issue = this.issue();
    if (issue) this.accept.emit(issue);
  }

  /**
   * Forwards the dismiss action for the currently displayed issue.
   */
  onDismiss(): void {
    const issue = this.issue();
    if (issue) this.dismiss.emit(issue);
  }
}
