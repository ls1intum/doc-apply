import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  standalone: true,
  selector: 'jhi-sidebar-button',
  imports: [FontAwesomeModule, TooltipModule],
  templateUrl: './sidebar-button.component.html',
})
export class SidebarButtonComponent {
  icon = input<string | undefined>(undefined);
  label = input<string>('');
  isActive = input<boolean>(false);
  isCollapsed = input<boolean>(false);
  link = input<string>('/');
  shouldTranslate = input<boolean>(true);

  /** True when the sidebar is collapsed to a square, icon-only button. */
  readonly isIconOnly = computed(() => this.icon() !== undefined && this.isCollapsed());

  displayLabel = computed(() => {
    this.langChange();
    const value = this.label();
    if (value === '') {
      return '';
    }
    return this.shouldTranslate() ? this.translateService.instant(value) : value;
  });

  private router = inject(Router);
  private translateService = inject(TranslateService);
  private langChange = toSignal(this.translateService.onLangChange, { initialValue: undefined });

  navigate(): void {
    this.router.navigate([this.link()]).catch((err: unknown) => {
      console.error('Navigation error:', err);
    });
  }
}
