import { convertLikertToStandardRating } from 'app/shared/util/rating.util';
import { Component, computed, inject, input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateService } from '@ngx-translate/core';
import { ApplicationEvaluationDetailDTO } from 'app/generated/model/application-evaluation-detail-dto';
import { ApplicationDetailDTO } from 'app/generated/model/application-detail-dto';
import { TagComponent } from 'app/shared/components/atoms/tag/tag.component';
import { StarRatingComponent } from 'app/shared/components/atoms/star-rating/star-rating.component';
import { UserAvatarComponent } from 'app/shared/components/atoms/user-avatar/user-avatar.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { formatGradeWithTranslation } from 'app/core/util/grade-conversion';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'jhi-application-card',
  imports: [FontAwesomeModule, TagComponent, StarRatingComponent, UserAvatarComponent, TooltipModule],
  templateUrl: './application-card.component.html',
  host: {
    class: 'flex flex-col h-full',
  },
})
export class ApplicationCardComponent {
  disabled = input<boolean>(false);
  placeholder = input<boolean>(false);
  application = input<ApplicationEvaluationDetailDTO | undefined>(undefined);

  readonly applicationDetails = computed<ApplicationDetailDTO | undefined>(() => {
    const application = this.application();
    if (application) {
      return application.applicationDetailDTO;
    }
    return undefined;
  });

  readonly stateSeverityMap: Record<string, 'success' | 'warn' | 'danger' | 'info' | 'neutral'> = {
    SENT: 'info',
    ACCEPTED: 'success',
    REJECTED: 'danger',
    IN_REVIEW: 'warn',
    INTERVIEW: 'neutral',
  };

  readonly nameParts = computed<{ first: string; last: string }>(() => {
    const fullName = this.application()?.applicationDetailDTO.applicant?.user.name?.trim() ?? '';
    const parts = fullName.split(' ').filter(p => p.length > 0);

    if (parts.length <= 2) {
      return { first: fullName, last: '' };
    }

    const last = parts.pop() ?? '';
    const first = parts.join(' ');
    return { first, last };
  });

  /**
   * Converts the average rating from Likert scale (-2 to +2) to standard 1-5 scale
   */
  readonly displayRating = computed<number | undefined>(() => {
    const avgRating = this.application()?.averageRating;
    if (avgRating === undefined) {
      return undefined;
    }
    return convertLikertToStandardRating(avgRating);
  });

  /**
   * Number of ratings contributing to the average (professor ratings + interview rating).
   * Returns undefined when no rating exists so the count is hidden.
   */
  readonly ratingCount = computed<number | undefined>(() => {
    const count = this.application()?.ratingCount;
    return count !== undefined && count > 0 ? count : undefined;
  });

  /**
   * Dynamic font size for applicant name based on length
   */
  readonly nameFontSize = computed<string>(() => {
    const name = this.application()?.applicationDetailDTO.applicant?.user.name ?? '';
    if (name.length > 40) return 'text-sm';
    if (name.length > 30) return 'text-base';
    return 'text-lg';
  });

  /**
   * Dynamic font size for job title based on length
   */
  readonly jobFontSize = computed<string>(() => {
    const jobTitle = this.applicationDetails()?.jobTitle ?? '';
    if (jobTitle.length > 60) return 'text-xs';
    if (jobTitle.length > 40) return 'text-sm';
    return 'text-sm';
  });

  readonly statusBadgeText = computed(() => {
    const state = this.applicationDetails()?.applicationState ?? '';
    return state ? 'evaluation.statusBadge.' + state : '';
  });
  readonly masterDegreeLabel = computed(() => {
    this.currentLang();
    return this.translateService.instant('evaluation.masterDegree');
  });
  readonly gradeLabel = computed(() => {
    this.currentLang();
    return this.translateService.instant('evaluation.grade');
  });

  readonly masterSummary = computed(() => {
    const applicant = this.applicationDetails()?.applicant;
    this.currentLang();

    return {
      degree: applicant?.masterDegreeName,
      university: applicant?.masterUniversity,
      gradeInfo: formatGradeWithTranslation(
        applicant?.masterGrade,
        applicant?.masterGradeUpperLimit,
        applicant?.masterGradeLowerLimit,
        this.translateService,
      ),
    };
  });

  private readonly translateService = inject(TranslateService);
  private currentLang = toSignal(this.translateService.onLangChange);
}
