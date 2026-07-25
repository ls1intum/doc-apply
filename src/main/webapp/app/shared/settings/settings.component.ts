import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { AccountService } from 'app/core/auth/account.service';
import { ThemeOption, ThemeService } from 'app/service/theme.service';
import { Subscription } from 'rxjs';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { DividerModule } from 'primeng/divider';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';

import { SelectComponent, SelectOption } from '../components/atoms/select/select.component';
import TranslateDirective from '../language/translate.directive';
import { TabItem, TabPanelTemplateDirective, TabViewComponent } from '../components/molecules/tab-view/tab-view.component';

import { AiConsentSettingsComponent } from './ai-consent-settings/ai-consent-settings.component';
import { NotificationSettingsComponent } from './notifications/notification-settings.component';
import { ApplicationInformationSettingsComponent } from './application-information-settings';
import { ProfilePictureSettingsComponent } from './profile-picture-settings/profile-picture-settings.component';
import { SettingsQualificationsComponent } from './settings-qualifications/settings-qualifications.component';
import { PasskeySettingsComponent } from './passkey-settings/passkey-settings.component';

type SettingsTab = 'general' | 'notifications' | 'application-information' | 'qualifications';
@Component({
  selector: 'jhi-settings',
  imports: [
    TranslateDirective,
    AiConsentSettingsComponent,
    NotificationSettingsComponent,
    ApplicationInformationSettingsComponent,
    ProfilePictureSettingsComponent,
    PasskeySettingsComponent,
    SettingsQualificationsComponent,
    SelectComponent,
    TabViewComponent,
    TabPanelTemplateDirective,
    FontAwesomeModule,
    DividerModule,
  ],
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  readonly activeTab = signal<SettingsTab>('general');
  readonly role = signal<UserShortDTORolesEnum | undefined>(undefined);

  readonly tabs = computed<TabItem[]>(() => {
    const baseTabs: TabItem[] = [{ id: 'general', translationKey: 'settings.tabs.general' }];

    // Hide notifications tab for admins
    if (this.role() !== UserShortDTORolesEnum.Admin) {
      baseTabs.push({ id: 'notifications', translationKey: 'settings.tabs.notifications' });
    }

    // Add application information and qualifications tabs only for applicants
    if (this.role() === UserShortDTORolesEnum.Applicant) {
      baseTabs.push({ id: 'application-information', translationKey: 'settings.tabs.applicationInformation' });
      baseTabs.push({ id: 'qualifications', translationKey: 'settings.tabs.qualifications' });
    }

    return baseTabs;
  });

  themeOptions: SelectOption[] = [
    { name: 'settings.appearance.options.light', value: 'light' },
    { name: 'settings.appearance.options.dark', value: 'dark' },
    { name: 'settings.appearance.options.blossom', value: 'blossom' },
    { name: 'settings.appearance.options.aquabloom', value: 'aquabloom' },
    { name: 'settings.appearance.options.system', value: 'system' },
  ];

  selectedTheme = computed<SelectOption>(() => {
    const currentValue = this.themeService.syncWithSystem() ? 'system' : this.themeService.theme();
    return this.themeOptions.find(opt => opt.value === currentValue) ?? this.themeOptions[0];
  });

  exportCooldownRemaining = signal<number>(0); // seconds remaining for cooldown
  exportInProgress = signal<boolean>(false);
  exportButtonDisabled = computed(() => this.exportCooldownRemaining() > 0 || this.exportInProgress());

  protected readonly UserShortDTORolesEnum = UserShortDTORolesEnum;
  protected readonly themeService = inject(ThemeService);
  protected readonly accountService = inject(AccountService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly queryParamMap = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  // Internal subscription used for the cooldown interval
  private exportCooldownSub: Subscription | null = null;

  constructor() {
    const authorities = this.accountService.loadedUser()?.authorities;
    this.role.set(authorities?.map(authority => authority as UserShortDTORolesEnum)[0]);

    effect(() => {
      const requestedTab = this.queryParamMap().get('tab') ?? undefined;
      if (requestedTab !== undefined && this.tabs().some(tab => tab.id === requestedTab)) {
        this.activeTab.set(requestedTab as SettingsTab);
      }
    });

    this.destroyRef.onDestroy(() => {
      this.exportCooldownSub?.unsubscribe();
      this.exportCooldownSub = null;
    });
  }

  onThemeChange(option: SelectOption): void {
    const value = option.value;

    if (value === 'system') {
      this.themeService.setSyncWithSystem(true);
    } else {
      this.themeService.setSyncWithSystem(false);
      this.themeService.setTheme(value as ThemeOption);
    }
  }

  onTabChange(tabId: string): void {
    if (this.tabs().some(tab => tab.id === tabId)) {
      this.activeTab.set(tabId as SettingsTab);
    }
  }
}
