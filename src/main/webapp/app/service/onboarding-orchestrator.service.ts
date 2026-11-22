import { Injectable, Injector, Signal, computed, effect, inject, signal } from '@angular/core';
import { DialogService } from 'app/shared/dialog/dialog.service';
import { TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { filter, map, startWith, switchMap, take } from 'rxjs/operators';
import { NavigationEnd, Router } from '@angular/router';
import { onboardingDialogOptions } from 'app/shared/constants/onboarding-dialog.constants';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';

import { OnboardingDialog } from '../shared/components/molecules/onboarding-dialog/onboarding-dialog';
import { AccountService } from '../core/auth/account.service';
import { ProfOnboardingResourceApi } from '../generated/api/prof-onboarding-resource-api';
import { ProfOnboardingDTO } from '../generated/model/prof-onboarding-dto';

/**
 * Orchestrates the professor onboarding dialog on the client.
 *
 * Usage: call `hookToAuth(accountService.user)` once from MainComponent after bootstrap.
 * When the user transitions to an authenticated state, this service will
 * check with the server and open the onboarding dialog if necessary.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingOrchestratorService {
  /**
   * True while the onboarding flow may take precedence over other post-login prompts: from the moment the
   * triggering conditions match (logged-in applicant on a professor page) until the server check resolves
   * negatively. Stays true if the dialog actually opens.
   */
  readonly suppressesFollowupPrompts: Signal<boolean> = computed(() => this.suppressesFollowupPromptsState());

  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(DialogService);
  private readonly profOnboardingApi = inject(ProfOnboardingResourceApi);

  // Prevents opening multiple dialogs concurrently.
  private opened = false;

  private readonly suppressesFollowupPromptsState = signal(true);

  private readonly checkTrigger$ = new Subject<void>();
  private readonly checkResult = toSignal<ProfOnboardingDTO | undefined>(
    this.checkTrigger$.pipe(switchMap(() => this.profOnboardingApi.check().pipe(take(1)))),
    { initialValue: undefined },
  );

  private readonly currentUrl = toSignal<string | undefined>(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { injector: this.injector, initialValue: undefined },
  );

  hookToAuth(loggedIn: Signal<boolean>): void {
    effect(
      () => {
        const isLoggedIn = loggedIn();
        const url = this.currentUrl();
        const onProfessorPage = typeof url === 'string' && url.startsWith('/professor');
        const isApplicant = this.accountService.hasAnyAuthority([UserShortDTORolesEnum.Applicant]);

        if (!isLoggedIn || this.opened || !isApplicant || !onProfessorPage) {
          return;
        }
        this.suppressesFollowupPromptsState.set(true);
        this.checkTrigger$.next();
      },
      { injector: this.injector },
    );

    effect(
      () => {
        const dto = this.checkResult();
        if (dto === undefined) {
          return;
        }
        if (dto.show !== true) {
          this.suppressesFollowupPromptsState.set(false);
          return;
        }
        if (this.opened) {
          return;
        }
        this.opened = true;

        this.dialog.open(OnboardingDialog, onboardingDialogOptions(this.translate.instant('onboarding.title')));
      },
      { injector: this.injector },
    );
  }
}
