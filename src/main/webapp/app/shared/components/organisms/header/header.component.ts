import {
  Component,
  DestroyRef,
  ViewEncapsulation,
  WritableSignal,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { LANGUAGES } from 'app/config/language.constants';
import { TranslateService } from '@ngx-translate/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { AccountService, User } from 'app/core/auth/account.service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { filter, map } from 'rxjs';
import { DynamicDialogModule } from 'primeng/dynamicdialog';
import { AuthFacadeService } from 'app/core/auth/auth-facade.service';
import { AuthDialogService } from 'app/core/auth/auth-dialog.service';
import { IdpProvider } from 'app/core/auth/keycloak-authentication.service';
import { ThemeService } from 'app/service/theme.service';
import { MobileSidebarService } from 'app/service/mobile-sidebar.service';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';

import { ButtonComponent } from '../../atoms/button/button.component';
import { SelectOption } from '../../atoms/select/select.component';
import TranslateDirective from '../../../language/translate.directive';
import { JhiMenuItem, MenuComponent } from '../../atoms/menu/menu.component';
import { UserAvatarComponent } from '../../atoms/user-avatar/user-avatar.component';
import { DrawerComponent } from '../../molecules/drawer/drawer.component';

@Component({
  selector: 'jhi-header',
  standalone: true,
  imports: [
    CommonModule,
    ButtonComponent,
    FontAwesomeModule,
    DynamicDialogModule,
    DrawerComponent,
    TranslateDirective,
    MenuComponent,
    UserAvatarComponent,
  ],
  templateUrl: './header.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class HeaderComponent {
  translateService = inject(TranslateService);
  langChange = toSignal(this.translateService.onLangChange, { initialValue: undefined });
  currentLanguage = toSignal(this.translateService.onLangChange.pipe(map(event => event.lang.toUpperCase())), {
    initialValue: this.translateService.getCurrentLang() ? this.translateService.getCurrentLang().toUpperCase() : 'EN',
  });
  languages = LANGUAGES.map(lang => lang.toUpperCase());
  accountService = inject(AccountService);
  user: WritableSignal<User | undefined> = this.accountService.user;
  router = inject(Router);
  themeService = inject(ThemeService);
  theme = this.themeService.theme;
  syncWithSystem = this.themeService.syncWithSystem;
  isDarkMode = computed(() => this.theme() === 'dark');
  showBorder = signal(false);
  themeIcon = computed(() => {
    if (this.syncWithSystem()) {
      return 'custom-sun-moon';
    }
    return this.isDarkMode() ? 'moon' : 'custom-sun';
  });
  themeTooltip = computed(() => {
    if (this.syncWithSystem()) {
      return 'header.systemMode';
    }
    return this.isDarkMode() ? 'header.darkMode' : 'header.lightMode';
  });
  profileMenuAriaLabel = computed(() => {
    this.langChange();
    return this.translateService.instant('header.profileMenu');
  });
  mobileMenuLabel = computed(() => {
    this.langChange();
    return this.translateService.instant('header.menuToggle');
  });
  sidebarToggleLabel = computed(() => {
    this.langChange();
    return this.translateService.instant('header.sidebarToggle');
  });
  themeOptions: SelectOption[] = [
    { name: 'Light', value: 'light' },
    { name: 'Dark', value: 'dark' },
    { name: 'Blossom', value: 'blossom' },
    { name: 'AquaBloom', value: 'aquabloom' },
  ];
  selectedTheme = computed(() => this.themeOptions.find(opt => opt.value === this.theme()));
  routeAuthorities = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => {
        let route = this.router.routerState.snapshot.root;
        while (route.firstChild) route = route.firstChild;
        const data = route.data as any;
        return data?.['authorities'] ?? [];
      }),
    ),
    {
      initialValue: (() => {
        let route = this.router.routerState.snapshot.root;
        while (route.firstChild) route = route.firstChild;
        const data = route.data as any;
        return data?.['authorities'] ?? [];
      })(),
    },
  );
  isProfessorPage = computed(() => {
    const auths = this.routeAuthorities();
    const isPublicProfessorLandingPage = this.router.url === '/professor' && !this.accountService.signedIn();
    const isProfessorOnlyRoute =
      Array.isArray(auths) &&
      auths.length > 0 &&
      auths.every(auth => this.professorPortalAuthorities.includes(auth as UserShortDTORolesEnum));

    return isPublicProfessorLandingPage || this.accountService.hasAnyAuthority(this.professorPortalAuthorities) || isProfessorOnlyRoute;
  });

  readonly headerButtonClass =
    'inline-flex [&_.p-button]:h-8 [&_.p-button]:justify-center [&_.p-button]:px-0 sm:[&_.p-button]:px-3 [&_.p-button]:py-[0.4rem] [&_.p-button]:text-[0.9rem] [&_.p-button]:rounded-md';

  profileMenu = viewChild<MenuComponent>('profileMenu');
  isProfileMenuOpen = signal(false);
  mobileMenuOpen = signal(false);

  readonly mobileSidebarService = inject(MobileSidebarService);
  readonly mobileSidebarOpen = this.mobileSidebarService.open;

  groupSwitcherMenu = viewChild<MenuComponent>('groupSwitcherMenu');
  isGroupSwitcherOpen = signal(false);
  hasMultipleMemberships = this.accountService.hasMultipleMemberships;
  activeResearchGroup = this.accountService.activeResearchGroup;
  activeResearchGroupLabel = computed(() => {
    this.langChange();
    return this.activeResearchGroup()?.name ?? this.translateService.instant('header.activeResearchGroup');
  });
  activeResearchGroupAriaLabel = computed(() => {
    this.langChange();
    return this.translateService.instant('header.activeResearchGroup');
  });

  groupSwitcherItems = computed<JhiMenuItem[]>(() => {
    const memberships = this.accountService.memberships();
    if (memberships.length < 2) {
      return [];
    }
    const activeId = this.accountService.activeResearchGroupId();
    return memberships.map(m => ({
      label: m.name ?? '',
      icon: activeId === m.researchGroupId ? 'check' : 'circle',
      severity: 'primary',
      command: () => {
        if (m.researchGroupId !== undefined && m.researchGroupId !== activeId) {
          this.accountService.setActiveResearchGroup(m.researchGroupId);
          void this.router.navigateByUrl(this.router.url, { onSameUrlNavigation: 'reload', skipLocationChange: false });
        }
      },
    }));
  });

  profileMenuItems = computed<JhiMenuItem[]>(() => {
    this.currentLanguage();
    if (!this.user()) {
      return [];
    }

    return [
      {
        label: 'header.settings',
        icon: 'gear',
        severity: 'primary',
        command: () => {
          this.navigateToSettings();
        },
      },
      {
        label: 'header.logout',
        icon: 'right-from-bracket',
        severity: 'danger',
        command: () => {
          this.logout();
        },
      },
    ];
  });

  private destroyRef = inject(DestroyRef);
  private observer?: IntersectionObserver;
  private authFacadeService = inject(AuthFacadeService);
  private authDialogService = inject(AuthDialogService);
  private readonly professorPortalAuthorities: UserShortDTORolesEnum[] = [UserShortDTORolesEnum.Professor, UserShortDTORolesEnum.Employee];

  constructor() {
    afterNextRender(() => {
      this.setupBannerObserver();
    });

    // Close the mobile drawers the moment navigation starts so the modal mask animates away
    // in parallel with the new route loading instead of waiting for it to finish.
    this.router.events
      .pipe(
        filter(e => e instanceof NavigationStart),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.mobileMenuOpen.set(false);
        this.mobileSidebarService.close();
      });

    // Re-setup the banner observer once the destination page has actually rendered.
    this.router.events
      .pipe(
        filter(e => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.observer?.disconnect();
        // Give the banner component time to render
        setTimeout(() => {
          this.setupBannerObserver();
        }, 0);
      });

    this.destroyRef.onDestroy(() => this.observer?.disconnect());
  }

  navigateToHome(): void {
    if (this.isProfessorPage()) {
      this.redirectToProfessorLandingPage();
    } else {
      this.redirectToApplicantLandingPage();
    }
  }

  login(): void {
    this.closeMobileMenu();
    if (this.isProfessorPage()) {
      void this.onTUMSSOLogin();
    } else {
      this.openLoginDialog();
    }
  }

  openLoginDialog(): void {
    this.authDialogService.open({
      mode: 'login',
    });
  }

  redirectToProfessorLandingPage(): void {
    this.closeMobileMenu();
    void this.router.navigate(['/professor']);
  }

  redirectToApplicantLandingPage(): void {
    this.closeMobileMenu();
    void this.router.navigate(['/']);
  }

  async onTUMSSOLogin(): Promise<void> {
    await this.authFacadeService.loginWithProvider(IdpProvider.TUM, this.router.url);
  }

  async onProfessorPasskeyLogin(): Promise<void> {
    this.closeMobileMenu();
    await this.authFacadeService.loginWithPasskey(this.router.url);
  }

  async onApplicantPasskeyLogin(): Promise<void> {
    this.closeMobileMenu();
    await this.authFacadeService.loginWithInAppPasskey(this.router.url);
  }

  logout(): void {
    this.closeMobileMenu();
    void this.authFacadeService.logout();
  }

  onThemeChange(option: SelectOption): void {
    this.themeService.setTheme(option.value as 'light' | 'dark' | 'blossom' | 'aquabloom');
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleLanguage(language: string): void {
    if (this.languages.includes(language)) {
      this.translateService.use(language.toLowerCase());
    } else {
      console.warn(`Unsupported language: ${language}`);
    }
  }

  navigateToSettings(): void {
    this.closeMobileMenu();
    void this.router.navigate(['/settings']);
  }

  onLogoClick(event: MouseEvent): void {
    // Only intercept plain left-clicks without modifier keys
    const isLeftClick = event.button === 0;
    const hasModifier = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

    if (isLeftClick && !hasModifier) {
      event.preventDefault();
      this.navigateToHome();
    }
  }

  toggleProfileMenu(event: Event): void {
    this.profileMenu()?.toggle(event);
  }

  toggleGroupSwitcher(event: Event): void {
    this.groupSwitcherMenu()?.toggle(event);
  }

  openMobileSidebar(): void {
    this.mobileSidebarService.open.set(true);
  }

  /**
   * Eagerly closes the mobile drawer so its modal scroll lock (overflow: hidden on body)
   * is released before navigation starts; otherwise the new page renders behind the drawer's
   * exit animation and the user can't scroll for the duration of that animation.
   */
  private closeMobileMenu(): void {
    if (this.mobileMenuOpen()) {
      this.mobileMenuOpen.set(false);
    }
  }

  private setupBannerObserver(): void {
    const banner = document.querySelector('jhi-banner-section');
    const isLandingPage = this.router.url === '/' || this.router.url === '/professor';

    if (!isLandingPage) {
      // Other pages: always show border
      this.showBorder.set(true);
      return;
    }

    // Landing pages with banner: show border only when scrolled past banner
    if (!banner) {
      // No banner on landing page: show border
      this.showBorder.set(true);
      return;
    }

    // Start with border hidden (banner is visible at top)
    this.showBorder.set(false);

    // Show border when banner scrolls out of view
    this.observer = new IntersectionObserver(([entry]) => {
      this.showBorder.set(!entry.isIntersecting);
    });
    this.observer.observe(banner);
  }
}
