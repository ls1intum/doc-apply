import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TabItem, TabPanelTemplateDirective, TabViewComponent } from 'app/shared/components/molecules/tab-view/tab-view.component';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';

const DEFAULT_TABS: TabItem[] = [
  { id: 'general', translationKey: 'settings.tabs.general' },
  { id: 'qualifications', translationKey: 'settings.tabs.qualifications', icon: ['fas', 'file'] },
];

@Component({
  standalone: true,
  imports: [TabViewComponent, TabPanelTemplateDirective],
  template: `
    <jhi-tab-view [tabs]="tabs">
      <ng-template jhiTabPanel="general">General Content</ng-template>
      <ng-template jhiTabPanel="qualifications">Qualifications Content</ng-template>
    </jhi-tab-view>
  `,
})
class TabViewHostComponent {
  tabs = DEFAULT_TABS;
}

describe('TabViewComponent', () => {
  let fixture: ComponentFixture<TabViewComponent>;
  let component: TabViewComponent;

  const createComponent = (tabs: TabItem[], activeTabId?: string, tabsClass = ''): void => {
    fixture = TestBed.createComponent(TabViewComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('tabs', tabs);
    fixture.componentRef.setInput('tabsClass', tabsClass);

    if (activeTabId !== undefined) {
      fixture.componentRef.setInput('activeTabId', activeTabId);
    }

    fixture.detectChanges();
  };

  const createHostComponent = (): ComponentFixture<TabViewHostComponent> => {
    const hostFixture = TestBed.createComponent(TabViewHostComponent);
    hostFixture.detectChanges();
    return hostFixture;
  };

  const getHostTabViewComponent = (hostFixture: ComponentFixture<TabViewHostComponent>): TabViewComponent => {
    return hostFixture.debugElement.query(By.directive(TabViewComponent)).componentInstance;
  };

  beforeEach(async () => {
    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }

    global.ResizeObserver = ResizeObserverMock;

    await TestBed.configureTestingModule({
      imports: [TabViewComponent, TabViewHostComponent],
      providers: [provideTranslateMock(), provideFontAwesomeTesting()],
    }).compileComponents();
  });

  it.each<[TabItem[], string | undefined, string | undefined]>([
    [DEFAULT_TABS, 'qualifications', 'qualifications'],
    [DEFAULT_TABS, undefined, 'general'],
    [[], '', undefined],
  ])('should resolve currentTabValue for tabs=%o activeTabId=%s', (tabs, activeTabId, expected) => {
    createComponent(tabs, activeTabId);

    expect(component.currentTabValue()).toBe(expected);
  });

  it('should emit tabChange for string ids and ignore non-string values', () => {
    createComponent(DEFAULT_TABS);

    const emitSpy = vi.spyOn(component.tabChange, 'emit');
    component.onTabChange('qualifications');
    component.onTabChange(1);
    component.onTabChange(undefined);

    expect(emitSpy).toHaveBeenCalledOnce();
    expect(emitSpy).toHaveBeenCalledWith('qualifications');
  });

  it('should return matching projected template or undefined for unknown tab id', () => {
    createComponent(DEFAULT_TABS);
    expect(component.findTemplate('nonexistent')).toBeUndefined();

    const hostFixture = createHostComponent();
    const tabViewComponent = getHostTabViewComponent(hostFixture);
    expect(tabViewComponent.findTemplate('general')).toBe(tabViewComponent.tabPanels()[0]?.template);
    expect(tabViewComponent.findTemplate('notifications')).toBeUndefined();
  });

  it('should show only the selected panel and switch panels when another tab is clicked', async () => {
    const hostFixture = createHostComponent();
    await hostFixture.whenStable();
    const element: HTMLElement = hostFixture.nativeElement;
    const emitSpy = vi.spyOn(getHostTabViewComponent(hostFixture).tabChange, 'emit');

    expect(element.textContent).toContain('General Content');
    expect(element.textContent).not.toContain('Qualifications Content');

    const tabs = Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]'));
    tabs[1].click();
    hostFixture.detectChanges();
    await hostFixture.whenStable();

    expect(emitSpy).toHaveBeenCalledExactlyOnceWith('qualifications');
    expect(element.textContent).toContain('Qualifications Content');
    expect(element.textContent).not.toContain('General Content');
  });
});
