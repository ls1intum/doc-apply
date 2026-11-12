import { Component, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UserResourceApi } from 'app/generated/api/user-resource-api';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';
import { ToastService } from 'app/service/toast-service';

import { ButtonComponent } from '../../components/atoms/button/button.component';
import { ToggleSwitchComponent } from '../../components/atoms/toggle-switch/toggle-switch.component';
import TranslateDirective from '../../language/translate.directive';

import { AiConsentModalComponent } from './ai-consent-modal/ai-consent-modal.component';

@Component({
  selector: 'jhi-ai-consent-settings',
  standalone: true,
  imports: [ToggleSwitchComponent, ButtonComponent, AiConsentModalComponent, TranslateDirective],
  templateUrl: './ai-consent-settings.component.html',
})
export class AiConsentSettingsComponent {
  currentRole = input<UserShortDTORolesEnum>();

  aiFeaturesEnabled = signal<boolean>(false);
  modalVisible = signal<boolean>(false);
  loaded = signal<boolean>(false);

  private readonly userApi = inject(UserResourceApi);
  private readonly toastService = inject(ToastService);

  constructor() {
    void this.loadAiConsent();
  }

  async loadAiConsent(): Promise<void> {
    try {
      const isEnabled = await firstValueFrom(this.userApi.getAiConsent());
      this.aiFeaturesEnabled.set(isEnabled);
      this.loaded.set(true);
    } catch {
      this.toastService.showErrorKey('settings.aiFeatures.loadFailed');
    }
  }

  async onToggleChanged(value: boolean): Promise<void> {
    try {
      await firstValueFrom(this.userApi.updateAiConsent(value));
      this.aiFeaturesEnabled.set(value);
    } catch {
      this.aiFeaturesEnabled.set(!value);
      this.toastService.showErrorKey('settings.aiFeatures.saveFailed');
    }
  }

  openModal(): void {
    this.modalVisible.set(true);
  }

  closeModal(): void {
    this.modalVisible.set(false);
  }
}
