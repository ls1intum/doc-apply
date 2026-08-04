import { Component, computed, inject, input, output } from '@angular/core';
import { AccountService } from 'app/core/auth/account.service';
import { PanelModule } from 'primeng/panel';
import { Router } from '@angular/router';
import { DividerModule } from 'primeng/divider';
import { ButtonModule } from 'primeng/button';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';

import { SidebarButtonComponent } from '../../atoms/sidebar-button/sidebar-button.component';
import TranslateDirective from '../../../language/translate.directive';

type SidebarButton = { icon: string; text: string; link: string };
type SidebarCategory = { title: string; buttons: SidebarButton[] };

@Component({
  selector: 'jhi-sidebar',
  imports: [ButtonModule, DividerModule, PanelModule, SidebarButtonComponent, TranslateDirective],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  isSidebarCollapsed = input.required<boolean>();
  /** When rendered inside the mobile drawer we drop the desktop chrome (right border, fixed width, collapse toggle). */
  isInDrawer = input<boolean>(false);
  sidebarCollapsedChange = output<boolean>();

  readonly wrapperClass = computed(() =>
    this.isInDrawer()
      ? 'flex flex-col h-full top-0 sticky flex-1 w-full'
      : 'flex flex-col h-full top-0 sticky flex-1 py-4 px-4 w-[var(--sidebar-width)] border-r border-divider-default',
  );

  /**
   * Custom groups for sidebar links that have multiple paths.
   * This allows for more flexible matching of active links.
   */
  private readonly customGroups: Partial<Record<string, string[]>> = {
    '/application/overview': ['/application/detail', '/application/form'],
    '/job-overview': ['/job/detail'],
    '/my-positions': ['/job/detail', '/job/edit'],
  };
  private accountService = inject(AccountService);
  private router = inject(Router);

  /**
   * Returns the categories for the sidebar based on the user's roles.
   * The categories are defined in the getCategoryConfig method.
   */
  get categories(): SidebarCategory[] | undefined {
    const categoryConfig = this.getCategoryConfig();
    const authorities = this.accountService.user()?.authorities;
    return authorities
      ?.map((authority: string) =>
        authority === UserShortDTORolesEnum.Professor || authority === UserShortDTORolesEnum.Employee
          ? categoryConfig.PROFESSOR_EMPLOYEE
          : categoryConfig[authority as UserShortDTORolesEnum],
      )
      .flat();
  }

  /**
   * Checks if the given link is active based on the current router URL.
   * It also checks against custom groups for more complex matching.
   * @param link The link to check for activity.
   * @returns True if the link is active, false otherwise.
   */
  isActive(link: string): boolean {
    const currentPath = this.router.url.split('?')[0].split(';')[0];

    // If the link is the root path, check if the current path is also the root
    if (link === '/') {
      return currentPath === '/';
    }

    // Check if the link is in the custom groups
    const subPaths = this.customGroups[link];
    if (subPaths) {
      if (currentPath === link || currentPath.startsWith(link + '/')) {
        return true;
      }
      return subPaths.some(subPath => currentPath === subPath || currentPath.startsWith(subPath + '/'));
    }

    return currentPath === link || currentPath.startsWith(link + '/');
  }

  toggleSidebar(): void {
    this.sidebarCollapsedChange.emit(!this.isSidebarCollapsed());
  }

  private getCategoryConfig(): Record<string, SidebarCategory[]> {
    return {
      APPLICANT: [
        {
          title: 'sidebar.dashboard.dashboard',
          buttons: [
            { icon: 'home', text: 'sidebar.home', link: '/' },
            { icon: 'find-positions', text: 'sidebar.dashboard.findpositions', link: '/job-overview' },
          ],
        },
        {
          title: 'sidebar.applications.title',
          buttons: [
            {
              icon: 'application-overview',
              text: 'sidebar.applications.myapplications',
              link: '/application/overview',
            },
          ],
        },
      ],
      PROFESSOR_EMPLOYEE: [
        {
          title: '',
          buttons: [{ icon: 'home', text: 'sidebar.home', link: '/professor' }],
        },
        {
          title: 'sidebar.recruitment.title',
          buttons: [
            { icon: 'jobs', text: 'sidebar.recruitment.positions', link: '/my-positions' },
            {
              icon: 'application-overview',
              text: 'sidebar.recruitment.applicationoverview',
              link: '/evaluation/overview',
            },
            {
              icon: 'review-applications',
              text: 'sidebar.recruitment.reviewapplications',
              link: '/evaluation/application',
            },
            { icon: 'calendar', text: 'sidebar.recruitment.interviews', link: '/interviews/overview' },
          ],
        },
        {
          title: 'sidebar.researchgroup.title',
          buttons: [
            { icon: 'envelope-open-text', text: 'sidebar.researchgroup.emailtemplates', link: '/research-group/templates' },
            { icon: 'users', text: 'sidebar.researchgroup.yourmembers', link: '/research-group/members' },
            { icon: 'research-group', text: 'sidebar.researchgroup.yourgroup', link: '/research-group/info' },
            { icon: 'image', text: 'sidebar.researchgroup.imagelibrary', link: '/research-group/images' },
          ],
        },
      ],
      ADMIN: [
        {
          title: '',
          buttons: [{ icon: 'home', text: 'sidebar.home', link: '/' }],
        },
        {
          title: 'sidebar.content.content',
          buttons: [
            { icon: 'folder', text: 'sidebar.content.allpositions', link: '/all-positions' },
            { icon: 'building', text: 'sidebar.content.schools', link: '/research-group/schools' },
            { icon: 'building-user', text: 'sidebar.content.departments', link: '/research-group/departments' },
            { icon: 'research-group', text: 'sidebar.content.researchgroups', link: '/research-group/admin-view' },
          ],
        },
        {
          title: 'sidebar.users.users',
          buttons: [
            { icon: 'users', text: 'sidebar.users.manageusers', link: '/manage-users' },
            { icon: 'file', text: 'sidebar.users.applications', link: '/applications' },
          ],
        },
        {
          title: 'sidebar.system.system',
          buttons: [
            { icon: 'chart-line', text: 'sidebar.system.analytics', link: '/analytics' },
            { icon: 'cubes', text: 'sidebar.system.dependencies', link: '/dependencies' },
            { icon: 'download', text: 'sidebar.system.exports', link: '/admin-exports' },
            { icon: 'wrench', text: 'sidebar.system.systemsettings', link: '/system-settings' },
          ],
        },
      ],
    };
  }
}
