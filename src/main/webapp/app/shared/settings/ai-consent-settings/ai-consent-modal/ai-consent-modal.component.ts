import { Component, computed, input, output } from '@angular/core';
import { faBriefcase, faMicrochip, faRobot, faToggleOn, faUserGraduate, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';
import { DialogComponent } from 'app/shared/components/atoms/dialog/dialog.component';
import { DialogIconHeaderComponent } from 'app/shared/components/molecules/dialog-icon-header/dialog-icon-header.component';
import { IconFeatureItem, IconFeatureListComponent } from 'app/shared/components/molecules/icon-feature-list/icon-feature-list.component';
import { IconIntroComponent } from 'app/shared/components/molecules/icon-intro/icon-intro.component';
import { TranslateDirective } from 'app/shared/language';

/** Explains how the AI features process data, what they do for the user's role and how to switch them off. */
@Component({
  selector: 'jhi-ai-consent-modal',
  standalone: true,
  imports: [DialogComponent, TranslateDirective, DialogIconHeaderComponent, IconIntroComponent, IconFeatureListComponent],
  templateUrl: './ai-consent-modal.component.html',
})
export class AiConsentModalComponent {
  visible = input.required<boolean>();
  currentRole = input<UserShortDTORolesEnum | undefined>(undefined);
  settings = input<boolean>(true);
  visibleChange = output<boolean>();

  readonly faRobot = faRobot;
  readonly faWandMagicSparkles = faWandMagicSparkles;

  readonly points = computed<IconFeatureItem[]>(() => {
    const isApplicant = this.currentRole() === UserShortDTORolesEnum.Applicant;
    return [
      {
        icon: faMicrochip,
        labelKey: 'settings.aiFeatures.modal.processing.header',
        descriptionKey: 'settings.aiFeatures.modal.processing.description',
      },
      {
        icon: isApplicant ? faUserGraduate : faBriefcase,
        labelKey: 'settings.aiFeatures.modal.scope.header',
        descriptionKey: isApplicant ? 'settings.aiFeatures.modal.scope.applicant' : 'settings.aiFeatures.modal.scope.professorOrEmployee',
      },
      {
        icon: faToggleOn,
        labelKey: 'settings.aiFeatures.modal.consent.header',
        descriptionKey: this.settings()
          ? 'settings.aiFeatures.modal.consent.descriptionSettings'
          : 'settings.aiFeatures.modal.consent.description',
      },
    ];
  });

  /** Asks the parent to hide the dialog. */
  close(): void {
    this.visibleChange.emit(false);
  }
}
