import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router, NavigationStart, Event as RouterEvent } from '@angular/router';
import { Subject } from 'rxjs';

import { MenuComponent, JhiMenuItem } from 'app/shared/components/atoms/menu/menu.component';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';

describe('MenuComponent', () => {
  let routerEvents: Subject<RouterEvent>;
  let trigger: HTMLButtonElement;

  async function createMenu(items: JhiMenuItem[]): Promise<ComponentFixture<MenuComponent>> {
    const fixture = TestBed.createComponent(MenuComponent);
    fixture.componentRef.setInput('items', items);
    await fixture.whenStable();
    return fixture;
  }

  function clickEvent(): MouseEvent {
    const event = new MouseEvent('click', { bubbles: true });
    trigger.addEventListener('click', listenerEvent => listenerEvent.stopPropagation(), { once: true });
    trigger.dispatchEvent(event);
    return event;
  }

  function entries(): HTMLButtonElement[] {
    return Array.from(document.body.querySelectorAll<HTMLButtonElement>('.cdk-overlay-container [tumAetUiMenuItem]'));
  }

  async function open(fixture: ComponentFixture<MenuComponent>): Promise<void> {
    fixture.componentInstance.show(clickEvent());
    await fixture.whenStable();
  }

  beforeEach(async () => {
    routerEvents = new Subject();
    trigger = document.createElement('button');
    document.body.appendChild(trigger);

    await TestBed.configureTestingModule({
      imports: [MenuComponent],
      providers: [provideFontAwesomeTesting(), provideTranslateMock(), { provide: Router, useValue: { events: routerEvents } }],
    }).compileComponents();
  });

  it('should open with an entry per item and close again on a second toggle', async () => {
    const fixture = await createMenu([{ label: 'Edit' }, { label: 'Delete', severity: 'danger' }]);
    const visibility: boolean[] = [];
    fixture.componentInstance.visibleChange.subscribe(visible => visibility.push(visible));

    fixture.componentInstance.toggle(clickEvent());
    await fixture.whenStable();
    expect(entries().map(entry => entry.textContent?.trim())).toEqual(['Edit', 'Delete']);

    fixture.componentInstance.toggle(clickEvent());
    await fixture.whenStable();
    expect(entries()).toHaveLength(0);
    expect(visibility).toEqual([true, false]);
  });

  it('should run the command of the chosen item and close', async () => {
    const command = vi.fn();
    const fixture = await createMenu([{ label: 'Edit', command }]);
    await open(fixture);

    entries()[0].click();
    await fixture.whenStable();

    expect(command).toHaveBeenCalledOnce();
    expect(entries()).toHaveLength(0);
  });

  it('should not run the command of a disabled item', async () => {
    const command = vi.fn();
    const fixture = await createMenu([{ label: 'Edit', command, disabled: true }]);
    await open(fixture);

    entries()[0].click();

    expect(command).not.toHaveBeenCalled();
  });

  it('should close when a navigation starts', async () => {
    const fixture = await createMenu([{ label: 'Edit' }]);
    await open(fixture);

    routerEvents.next(new NavigationStart(1, '/test'));
    await fixture.whenStable();

    expect(entries()).toHaveLength(0);
  });

  it('should close on Escape and return focus to the trigger', async () => {
    const fixture = await createMenu([{ label: 'Edit' }]);
    await open(fixture);

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    expect(entries()).toHaveLength(0);
    expect(document.activeElement).toBe(trigger);
  });
});
