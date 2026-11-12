import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { TranslateDirective } from 'app/shared/language';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { InfoBoxComponent } from 'app/shared/components/atoms/info-box/info-box.component';
import { TagComponent } from 'app/shared/components/atoms/tag/tag.component';
import { ToggleSwitchComponent } from 'app/shared/components/atoms/toggle-switch/toggle-switch.component';
import { ProgressSpinnerComponent } from 'app/shared/components/atoms/progress-spinner/progress-spinner.component';
import { StringInputComponent } from 'app/shared/components/atoms/string-input/string-input.component';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';
import { ToastService } from 'app/service/toast-service';
import { SiteConfigService } from 'app/core/config/site-config.service';
import { AiFeatureToggleResourceApi } from 'app/generated/api/ai-feature-toggle-resource-api';
import { SiteSettingResourceApi } from 'app/generated/api/site-setting-resource-api';
import { AiFeatureStatusDTO } from 'app/generated/model/ai-feature-status-dto';

/**
 * Admin page for system-wide settings.
 * Provides the configurable site name (shown wherever the platform refers to itself)
 * and controls for the AI feature kill switch (manual toggle and circuit breaker reset).
 */
@Component({
  selector: 'jhi-admin-system-settings',
  standalone: true,
  imports: [
    TranslateDirective,
    ButtonComponent,
    InfoBoxComponent,
    TagComponent,
    ToggleSwitchComponent,
    ProgressSpinnerComponent,
    StringInputComponent,
    ConfirmDialog,
    DatePipe,
  ],
  templateUrl: './admin-system-settings.component.html',
})
export class AdminSystemSettingsComponent {
  /** Whether the initial status is being loaded. */
  readonly isLoading = signal(false);

  /** Whether a toggle or reset action is in progress. */
  readonly isUpdating = signal(false);

  /** Current AI feature status from the server. */
  readonly aiStatus = signal<AiFeatureStatusDTO | undefined>(undefined);

  /** Whether the AI toggle is currently enabled (derived from status). */
  readonly aiEnabled = computed(() => this.aiStatus()?.aiEnabled ?? true);

  /** Whether the circuit breaker is currently open (derived from status). */
  readonly circuitBreakerOpen = computed(() => this.aiStatus()?.circuitBreakerOpen ?? false);

  /** Whether AI was manually disabled by an admin (derived from status). */
  readonly manuallyDisabled = computed(() => this.aiStatus()?.manuallyDisabled ?? false);

  /** Cooldown duration in minutes (derived from status). */
  readonly cooldownMinutes = computed(() => (this.aiStatus()?.coolDownSeconds ?? 0) / 60);

  /** Epoch millis when the circuit breaker opened (derived from status). */
  readonly openedAt = computed(() => this.aiStatus()?.openedAt ?? 0);

  /** The site name currently entered in the input field. */
  readonly siteNameInput = signal<string>('');

  /** Whether the site name update request is in progress. */
  readonly isSavingSiteName = signal(false);

  /** The entered site name without surrounding whitespace. */
  readonly trimmedSiteName = computed(() => this.siteNameInput().trim());

  /** Whether the entered site name is valid and differs from the active one. */
  readonly canSaveSiteName = computed(
    () => this.trimmedSiteName() !== '' && this.trimmedSiteName() !== this.siteConfigService.siteName() && !this.isSavingSiteName(),
  );

  /** Confirmation dialog warning that the name changes across the whole page. */
  readonly siteNameDialog = viewChild.required<ConfirmDialog>('siteNameDialog');

  private readonly siteConfigService = inject(SiteConfigService);
  private readonly aiFeatureToggleApi = inject(AiFeatureToggleResourceApi);
  private readonly siteSettingApi = inject(SiteSettingResourceApi);
  private readonly toastService = inject(ToastService);

  constructor() {
    this.siteNameInput.set(this.siteConfigService.siteName());
    void this.loadStatus();
  }

  /** Fetches the current AI feature status from the server. */
  async loadStatus(): Promise<void> {
    this.isLoading.set(true);
    try {
      const status = await firstValueFrom(this.aiFeatureToggleApi.getAiStatus());
      this.aiStatus.set(status);
    } catch {
      this.toastService.showErrorKey('systemSettings.ai.toast.loadError');
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Opens the confirmation dialog before applying the new site name. */
  onSaveSiteNameClick(): void {
    this.siteNameDialog().confirm();
  }

  /**
   * Persists the new site name after confirmation. The change applies live
   * across the app — the header, page titles, and translated texts all react to
   * the updated site-name signal, so no page reload is needed.
   */
  async onSiteNameConfirmed(): Promise<void> {
    this.isSavingSiteName.set(true);
    try {
      const result = await firstValueFrom(this.siteSettingApi.updateSiteName({ siteName: this.trimmedSiteName() }));
      this.siteConfigService.siteName.set(result.siteName);
      this.toastService.showSuccessKey('systemSettings.general.siteName.toast.success', { newName: result.siteName });
    } catch {
      this.toastService.showErrorKey('systemSettings.general.siteName.toast.error');
    } finally {
      this.isSavingSiteName.set(false);
    }
  }

  /**
   * Toggles the AI feature on or off.
   *
   * @param enabled whether AI features should be enabled
   */
  async onAiToggleChanged(enabled: boolean): Promise<void> {
    this.isUpdating.set(true);
    try {
      const status = await firstValueFrom(this.aiFeatureToggleApi.toggleAi(enabled));
      this.aiStatus.set(status);
      if (enabled) {
        this.toastService.showSuccessKey('systemSettings.ai.toast.enabled');
      } else {
        this.toastService.showSuccessKey('systemSettings.ai.toast.disabled');
      }
    } catch {
      this.toastService.showErrorKey('systemSettings.ai.toast.toggleError');
    } finally {
      this.isUpdating.set(false);
    }
  }

  /** Resets the circuit breaker so AI requests are allowed again. */
  async resetCircuitBreaker(): Promise<void> {
    this.isUpdating.set(true);
    try {
      const status = await firstValueFrom(this.aiFeatureToggleApi.resetCircuitBreaker());
      this.aiStatus.set(status);
      this.toastService.showSuccessKey('systemSettings.ai.toast.circuitBreakerReset');
    } catch {
      this.toastService.showErrorKey('systemSettings.ai.toast.resetError');
    } finally {
      this.isUpdating.set(false);
    }
  }
}
