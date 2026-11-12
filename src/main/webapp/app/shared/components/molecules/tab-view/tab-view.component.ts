import { hasText } from 'app/shared/util/text.util';
import { NgTemplateOutlet } from '@angular/common';
import { Component, Directive, TemplateRef, computed, contentChildren, inject, input, output } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  TumAetUiTabComponent,
  TumAetUiTabListComponent,
  TumAetUiTabPanelComponent,
  TumAetUiTabPanelsComponent,
  TumAetUiTabsComponent,
} from '@tumaet/ui-angular';

import TranslateDirective from '../../../language/translate.directive';

@Directive({
  selector: 'ng-template[jhiTabPanel]',
  standalone: true,
})
export class TabPanelTemplateDirective {
  tabId = input.required<string>({ alias: 'jhiTabPanel' });
  readonly template = inject(TemplateRef<unknown>);
}

export interface TabItem {
  id: string;
  translationKey: string;
  icon?: [string, string]; // FontAwesome icon tuple [prefix, iconName]
}

/**
 * Tabs with one projected `ng-template[jhiTabPanel]` per tab. Only the selected panel is rendered; switching tabs
 * destroys the content of the panel left behind.
 */
@Component({
  selector: 'jhi-tab-view',
  imports: [
    NgTemplateOutlet,
    TumAetUiTabsComponent,
    TumAetUiTabListComponent,
    TumAetUiTabComponent,
    TumAetUiTabPanelsComponent,
    TumAetUiTabPanelComponent,
    TranslateDirective,
    FontAwesomeModule,
  ],
  templateUrl: './tab-view.component.html',
})
export class TabViewComponent {
  tabs = input.required<TabItem[]>();
  activeTabId = input<string>();
  tabsClass = input<string>('');
  tabListClass = input<string>('');
  tabPanelsClass = input<string>('');
  tabClass = input<string>('');
  tabPanelClass = input<string>('');

  tabChange = output<string>();

  readonly tabPanels = contentChildren(TabPanelTemplateDirective);

  /** The tab to show: the one the view asks for, otherwise the first. */
  readonly currentTabValue = computed(() => {
    const externalTab = this.activeTabId();
    if (hasText(externalTab)) {
      return externalTab;
    }

    const tabs = this.tabs();
    return tabs.length > 0 ? tabs[0].id : undefined;
  });

  readonly resolvedTabsClass = computed(() => {
    const extraClasses = this.tabsClass().trim();
    return extraClasses === '' ? 'w-full' : `w-full ${extraClasses}`;
  });

  /** Every tab paired with the projected template that renders its panel. */
  protected readonly panels = computed(() => this.tabs().map(tab => ({ id: tab.id, template: this.findTemplate(tab.id) })));

  /**
   * Reports a tab the reader selected.
   *
   * @param tabId the value of the selected tab; only string ids belong to this view
   */
  onTabChange(tabId: string | number | undefined): void {
    if (typeof tabId === 'string') {
      this.tabChange.emit(tabId);
    }
  }

  /**
   * @param tabId the id of a tab
   * @returns the projected template for the tab, or undefined when the view projects none
   */
  findTemplate(tabId: string): TemplateRef<unknown> | undefined {
    return this.tabPanels().find(panel => panel.tabId() === tabId)?.template;
  }
}
