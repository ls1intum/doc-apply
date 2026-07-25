import { hasText } from 'app/shared/util/text.util';
import { CommonModule } from '@angular/common';
import { Component, Directive, TemplateRef, computed, contentChildren, inject, input, output } from '@angular/core';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

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

@Component({
  selector: 'jhi-tab-view',
  imports: [CommonModule, Tabs, TabList, Tab, TabPanels, TabPanel, TranslateDirective, FontAwesomeModule],
  templateUrl: './tab-view.component.html',
})
export class TabViewComponent {
  // Inputs
  tabs = input.required<TabItem[]>();
  activeTabId = input<string>();
  lazyLoad = input<boolean>(true);
  selectOnFocus = input<boolean>(true);
  tabsClass = input<string>('');
  tabListClass = input<string>('');
  tabPanelsClass = input<string>('');

  // Outputs
  tabChange = output<string>();

  readonly tabPanels = contentChildren(TabPanelTemplateDirective);

  // Computed current active tab id for PrimeNG binding
  readonly currentTabValue = computed(() => {
    const externalTab = this.activeTabId();
    if (hasText(externalTab)) {
      return externalTab;
    }

    // Default to first tab if available
    const tabs = this.tabs();
    return tabs.length > 0 ? tabs[0].id : undefined;
  });

  readonly resolvedTabsClass = computed(() => {
    const extraClasses = this.tabsClass().trim();
    return extraClasses === '' ? 'w-full' : `w-full ${extraClasses}`;
  });

  onTabChange(tabId: string | number | undefined): void {
    if (typeof tabId === 'string') {
      this.tabChange.emit(tabId);
    }
  }

  findTemplate(tabId: string): TemplateRef<unknown> | null {
    const panels = this.tabPanels();
    const match = panels.find(panel => panel.tabId() === tabId);
    return match ? match.template : null;
  }
}
