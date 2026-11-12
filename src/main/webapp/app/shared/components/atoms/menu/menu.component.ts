import { hasText } from 'app/shared/util/text.util';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  TemplateRef,
  ViewContainerRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  OverlayRef,
  STANDARD_DROPDOWN_BELOW_POSITIONS,
  createFlexibleConnectedPositionStrategy,
  createOverlayRef,
  createRepositionScrollStrategy,
} from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TumAetUiMenuComponent, TumAetUiMenuItemDirective } from '@tumaet/ui-angular';
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

interface MenuEntry {
  item: JhiMenuItem;
  itemClass: string;
  iconClass: string;
}

/** Hover tint of an entry and colour its icon takes on hover, per severity. */
const SEVERITY_CLASSES: Record<MenuItemSeverity, { item: string; icon: string }> = {
  primary: { item: 'hover:bg-primary-hover-outlined', icon: 'group-hover:text-primary-default' },
  secondary: { item: 'hover:bg-secondary-hover-outlined', icon: 'group-hover:text-secondary-default' },
  contrast: { item: 'hover:bg-accent-default/10', icon: 'group-hover:text-accent-default' },
  success: { item: 'hover:bg-positive-default/10', icon: 'group-hover:text-positive-default' },
  warn: { item: 'hover:bg-warning-default/10', icon: 'group-hover:text-warning-default' },
  danger: { item: 'hover:bg-negative-default/10', icon: 'group-hover:text-negative-default' },
  info: { item: 'hover:bg-border-hover', icon: 'group-hover:text-text-secondary' },
};

/** Elements a click on a trigger may land inside; the menu anchors to the nearest one. */
const TRIGGER_SELECTOR = 'button, a, [role="button"]';

/**
 * A popup menu of actions, opened from any trigger with toggle($event) or show($event).
 * The kit menu provides the roles, roving focus, arrow-key navigation and typeahead; this component anchors it to
 * the trigger in an overlay and closes it on a choice, Escape, Tab, an outside click or navigation.
 */
@Component({
  selector: 'jhi-menu',
  templateUrl: './menu.component.html',
  imports: [FontAwesomeModule, TranslateDirective, TumAetUiMenuComponent, TumAetUiMenuItemDirective],
})
export class MenuComponent {
  /**
   * The menu items to display.
   */
  items = input.required<JhiMenuItem[]>();

  /**
   * Whether to translate the menu item labels.
   */
  shouldTranslate = input<boolean>(false);

  /**
   * Emits whenever the popup visibility changes. true = opened, false = closed
   */
  visibleChange = output<boolean>();

  protected readonly entries = computed<MenuEntry[]>(() =>
    this.items().map(item => {
      const severity = item.severity === undefined ? undefined : SEVERITY_CLASSES[item.severity];
      const itemClasses = ['group', 'text-text-primary'];
      if (hasText(item.classStyling)) {
        itemClasses.push(item.classStyling);
      }
      if (severity !== undefined) {
        itemClasses.push(severity.item);
      }
      return { item, itemClass: itemClasses.join(' '), iconClass: severity?.icon ?? '' };
    }),
  );

  private readonly menuTemplate = viewChild.required<TemplateRef<unknown>>('menuTemplate');
  private readonly injector = inject(Injector);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly hostElement: HTMLElement = inject(ElementRef).nativeElement;
  private overlayRef?: OverlayRef;
  private trigger?: HTMLElement;

  constructor() {
    const destroyRef = inject(DestroyRef);
    inject(Router)
      .events.pipe(
        filter(event => event instanceof NavigationStart),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => {
        this.hide();
      });
    destroyRef.onDestroy(() => this.overlayRef?.dispose());
  }

  /**
   * Opens the menu below the trigger of the event, or closes it when it is open.
   *
   * @param event the click on the trigger
   */
  toggle(event: Event): void {
    if (this.overlayRef?.hasAttached() === true) {
      this.hide();
    } else {
      this.show(event);
    }
  }

  /**
   * Opens the menu below the trigger of the event and moves focus to its first entry.
   *
   * @param event the click on the trigger
   */
  show(event: Event): void {
    if (this.overlayRef?.hasAttached() === true) {
      return;
    }
    // 1) Anchor to the element the user clicked, which the event only exposes while it is dispatched
    const trigger = this.triggerOf(event);
    this.trigger = trigger;
    const positionStrategy = createFlexibleConnectedPositionStrategy(this.injector, trigger)
      .withFlexibleDimensions(false)
      .withPush(true)
      .withPositions(STANDARD_DROPDOWN_BELOW_POSITIONS);
    this.overlayRef?.dispose();
    const overlayRef = createOverlayRef(this.injector, { positionStrategy, scrollStrategy: createRepositionScrollStrategy(this.injector) });
    this.overlayRef = overlayRef;

    // 2) Close on a click outside the menu and its trigger, and on Escape or Tab
    overlayRef.outsidePointerEvents().subscribe(outsideEvent => {
      const target = outsideEvent.target;
      if (!(target instanceof Node) || !trigger.contains(target)) {
        this.hide();
      }
    });
    overlayRef.keydownEvents().subscribe(keyEvent => {
      if (keyEvent.key === 'Escape' || keyEvent.key === 'Tab') {
        this.hide();
        trigger.focus();
      }
    });

    // 3) Render the entries and focus the first one
    overlayRef.attach(new TemplatePortal(this.menuTemplate(), this.viewContainerRef));
    afterNextRender(() => overlayRef.overlayElement.querySelector<HTMLElement>('[tumAetUiMenuItem]')?.focus(), {
      injector: this.injector,
    });
    this.visibleChange.emit(true);
  }

  /**
   * Closes the menu if it is open.
   */
  hide(): void {
    if (this.overlayRef?.hasAttached() !== true) {
      return;
    }
    this.overlayRef.detach();
    this.visibleChange.emit(false);
  }

  /**
   * Closes the menu, returns focus to its trigger and runs the chosen item.
   *
   * @param item the chosen item
   */
  protected choose(item: JhiMenuItem): void {
    this.hide();
    this.trigger?.focus();
    item.command?.();
  }

  private triggerOf(event: Event): HTMLElement {
    const target = event.target;
    const clicked = target instanceof Element ? target.closest(TRIGGER_SELECTOR) : undefined;
    if (clicked instanceof HTMLElement) {
      return clicked;
    }
    const current = event.currentTarget;
    return current instanceof HTMLElement ? current : this.hostElement;
  }
}
