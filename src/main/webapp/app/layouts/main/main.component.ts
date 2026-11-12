import { Component, ElementRef, Renderer2, RendererFactory2, afterNextRender, computed, inject, viewChild } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { LangChangeEvent, TranslateService } from '@ngx-translate/core';
import dayjs from 'dayjs/esm';
import { AccountService } from 'app/core/auth/account.service';
import { AppPageTitleStrategy } from 'app/app-page-title-strategy';
import { LocalStorageService } from 'app/service/localStorage.service';
import { MobileSidebarService } from 'app/service/mobile-sidebar.service';
import { DrawerComponent } from 'app/shared/components/molecules/drawer/drawer.component';
import { PasskeyRegistrationPromptComponent } from 'app/shared/components/molecules/passkey-registration-prompt/passkey-registration-prompt.component';
import { SidebarComponent } from 'app/shared/components/organisms/sidebar/sidebar.component';
import { HeaderComponent } from 'app/shared/components/organisms/header/header.component';
import { OnboardingOrchestratorService } from 'app/service/onboarding-orchestrator.service';
import { BREAKPOINT_QUERIES } from 'app/shared/constants/breakpoints';

import FooterComponent from '../footer/footer.component';
import PageRibbonComponent from '../profiles/page-ribbon.component';

@Component({
  selector: 'jhi-main',
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
  providers: [AppPageTitleStrategy],
  imports: [
    HeaderComponent,
    RouterOutlet,
    SidebarComponent,
    FooterComponent,
    PageRibbonComponent,
    PasskeyRegistrationPromptComponent,
    DrawerComponent,
  ],
})
export default class MainComponent {
  readonly accountService = inject(AccountService);
  loggedIn = computed(() => {
    return this.accountService.signedIn();
  });
  readonly localStorageService = inject(LocalStorageService);
  readonly isSidebarCollapsed = this.localStorageService.sidebarCollapsed;
  readonly mobileSidebarService = inject(MobileSidebarService);
  readonly mobileSidebarOpen = this.mobileSidebarService.open;
  private readonly router = inject(Router);
  private readonly renderer: Renderer2;
  private readonly appPageTitleStrategy = inject(AppPageTitleStrategy);
  private readonly translateService = inject(TranslateService);
  private readonly rootRenderer = inject(RendererFactory2);
  private readonly onboardingOrchestratorService = inject(OnboardingOrchestratorService);
  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');

  constructor() {
    this.renderer = this.rootRenderer.createRenderer(document.querySelector('html'), null);
    this.translateService.onLangChange.subscribe((langChangeEvent: LangChangeEvent) => {
      this.appPageTitleStrategy.updateTitle(this.router.routerState.snapshot);
      dayjs.locale(langChangeEvent.lang);
      this.renderer.setAttribute(document.querySelector('html'), 'lang', langChangeEvent.lang);
    });
    afterNextRender(() => {
      this.onboardingOrchestratorService.hookToAuth(this.loggedIn);
      // Collapse the sidebar by default on small viewports so it doesn't cover the page on phones
      if (
        typeof window !== 'undefined' &&
        window.matchMedia(BREAKPOINT_QUERIES.belowTailwindSm).matches &&
        !this.localStorageService.sidebarCollapsed()
      ) {
        this.localStorageService.sidebarCollapsed.set(true);
      }
    });
  }

  onActivate(): void {
    const container = this.scrollContainer();
    if (container) {
      container.nativeElement.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  toggleSidebar(): void {
    this.localStorageService.toggle();
  }

  closeMobileSidebar(): void {
    this.mobileSidebarService.close();
  }
}
