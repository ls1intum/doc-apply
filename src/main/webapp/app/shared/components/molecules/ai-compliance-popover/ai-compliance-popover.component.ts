import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { ComplianceIssueDTO as ComplianceIssue } from 'app/generated/model/compliance-issue-dto';

@Component({
  selector: 'jhi-compliance-popover',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-compliance-popover.component.html',
})
export class CompliancePopoverComponent {
  issue = input<ComplianceIssue | undefined>(undefined);

  /** Viewport X coordinate. Positions the popover horizontally near the hovered word. */
  x = input<number>(0);

  /** Viewport Y coordinate. Positions the popover just below the highlighted span. */
  y = input<number>(0);
}
