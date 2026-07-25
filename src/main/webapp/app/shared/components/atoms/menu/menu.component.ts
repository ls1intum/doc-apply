import { hasText } from 'app/shared/util/text.util';
import { Component, DestroyRef, computed, inject, input, output, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { MenuModule } from 'primeng/menu';
import { Menu } from 'primeng/menu';
import { TranslateDirective } from 'app/shared/language';

import { ButtonColor } from '../button/button.component';

export type MenuItemSeverity = ButtonColor;

export interface JhiMenuItem {
  label: string;
  icon?: string;
  command?: () => void;
  severity?: MenuItemSeverity;
  disabled?: boolean;
  classStyling?: string;
}

@Component({
  selector: 'jhi-menu',
  templateUrl: './menu.component.html',
  imports: [CommonModule, MenuModule, FontAwesomeModule, TranslateDirective],
})
export class MenuComponent {
  /**
   * The menu items to display.
   */
  items = input.required<JhiMenuItem[]>();

  /**
   * Whether the menu is displayed as a popup overlay.
   */
  popup = input<boolean>(true);

  /**
   * Element or selector where the menu overlay should be appended.
   */
  appendTo = input<HTMLElement | string>('body');

  /**
   * Whether to translate the menu item labels.
   */
  shouldTranslate = input<boolean>(false);

  /**
   * Emits whenever the popup visibility changes. true = opened, false = closed
   */
  visibleChange = output<boolean>();

  menu = viewChild.required<Menu>('menu');

  // Computed property to convert JhiMenuItem to PrimeNG MenuItem format
  menuModel = computed(() => {
    return this.items().map(item => ({
      label: item.label,
      icon: item.icon,
      disabled: item.disabled,
      styleClass: this.buildStyleClass(item),
      command: () => {
        this.handleCommand(item);
      },
    }));
  });

  // Map severity to CSS class
  private readonly severityClassMap: Record<MenuItemSeverity, string> = {
    primary: 'menu-primary',
    secondary: 'menu-secondary',
    contrast: 'menu-contrast',
    success: 'menu-success',
    warn: 'menu-warn',
    danger: 'menu-danger',
    info: 'menu-info',
  };

  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  // Clean up menu overlays on navigation start.
  // Workaround for PrimeNG 21 popup-on-navigation behavior; remove once upstream is fixed.
  // Subscribe (rather than toSignal+effect) so cleanup runs synchronously inside the
  // navigation event tick — required for tests that assert DOM state immediately after.
  private readonly clearOnNavigationSub = this.router.events
    .pipe(
      filter(event => event instanceof NavigationStart),
      takeUntilDestroyed(this.destroyRef),
    )
    .subscribe(() => {
      this.clearMenuPopups();
      this.visibleChange.emit(false);
    });

  toggle(event: Event): void {
    this.menu().toggle(event);
  }

  show(event: Event): void {
    this.menu().show(event);
  }

  hide(): void {
    this.menu().hide();
  }
  onShow(): void {
    this.visibleChange.emit(true);
  }

  onHide(): void {
    this.visibleChange.emit(false);
  }

  private handleCommand(item: JhiMenuItem): void {
    item.command?.();
    this.visibleChange.emit(false);

    // Clean up immediately in case navigation occurs
    this.clearMenuPopups();
  }

  /**
   * Manually removes menu overlay elements from the DOM.
   * This is a workaround for PrimeNG 21 where popup menus with appendTo="body"
   * don't automatically close when navigation occurs. (view github issue linked in PR for further details)
   * remove once fixed
   */
  private clearMenuPopups(): void {
    const menuElements = document.querySelectorAll('body > [name="p-anchored-overlay"]');
    menuElements.forEach(node => {
      node.remove();
    });
  }

  // Build style class string for item
  private buildStyleClass(item: JhiMenuItem): string {
    const parts: string[] = [];

    if (hasText(item.classStyling)) {
      parts.push(item.classStyling);
    }

    if (item.severity !== undefined) {
      parts.push(this.severityClassMap[item.severity]);
    }

    if (item.disabled === true) {
      parts.push('pointer-events-none text-text-disabled cursor-not-allowed');
    }

    return parts.length > 0 ? parts.join(' ') : '';
  }
}
