import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  TemplateRef,
  ViewContainerRef,
  computed,
  effect,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
  OverlayRef,
  createFlexibleConnectedPositionStrategy,
  createOverlayRef,
  createRepositionScrollStrategy,
} from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { TumAetUiInputDirective } from '@tumaet/ui-angular';
import { firstValueFrom } from 'rxjs';
import { AddressSuggestionResourceApi } from 'app/generated/api/address-suggestion-resource-api';
import { AddressSuggestionDTO } from 'app/generated/model/address-suggestion-dto';
import { DROPDOWN_POSITIONS } from 'app/shared/util/overlay-position.util';

import { BaseInputDirective } from '../base-input/base-input.component';

/** Shorter queries match too many places; the server ignores them as well. */
export const ADDRESS_QUERY_MIN_LENGTH = 3;

/** How long typing has to pause before suggestions are requested, so not every keystroke reaches the server. */
export const ADDRESS_QUERY_DEBOUNCE_MS = 300;

let nextListboxId = 0;

/**
 * Text field that suggests complete addresses from an address search while the user types. It stays an ordinary
 * free-text field: the suggestions are optional help, and picking one only emits it, so the surrounding form decides
 * which of its fields to fill. The list follows the combobox pattern: Arrow Up and Down move through it, Enter picks
 * the highlighted address, and Escape or leaving the field closes it.
 */
@Component({
  selector: 'jhi-address-autocomplete',
  templateUrl: './address-autocomplete.component.html',
  imports: [ReactiveFormsModule, TumAetUiInputDirective],
})
export class AddressAutocompleteComponent extends BaseInputDirective<string> {
  /** Emits the address the user picked from the suggestions. */
  addressSelected = output<AddressSuggestionDTO>();

  readonly suggestions = signal<AddressSuggestionDTO[]>([]);
  readonly activeIndex = signal(-1);
  readonly hasSearched = signal(false);
  readonly listboxId = `jhi-address-suggestions-${nextListboxId++}`;

  readonly panelVisible = computed(() => this.isFocused() && this.hasSearched());
  readonly activeOptionId = computed(() =>
    this.panelVisible() && this.activeIndex() >= 0 ? this.optionId(this.activeIndex()) : undefined,
  );
  readonly listboxLabel = computed(() => this.displayLabel() || this.translateKey('global.input.address.suggestions'));
  readonly noSuggestionsText = computed(() => this.translateKey('global.input.address.noSuggestions'));
  readonly optionIds = computed(() => this.suggestions().map((_, index) => this.optionId(index)));

  private readonly addressApi = inject(AddressSuggestionResourceApi);
  private readonly injector = inject(Injector);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly inputWrapper = viewChild.required<ElementRef<HTMLElement>>('inputWrapper');
  private readonly panel = viewChild.required<TemplateRef<unknown>>('panel');
  private overlayRef?: OverlayRef;
  private debounceTimer?: ReturnType<typeof setTimeout>;
  private latestRequest = 0;

  private readonly panelEffect = effect(() => {
    if (this.panelVisible()) {
      this.openPanel();
    } else {
      this.overlayRef?.detach();
    }
  });

  constructor() {
    super();
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.debounceTimer);
      this.overlayRef?.dispose();
    });
  }

  /**
   * Requests suggestions once the user pauses typing, and closes the list while the text is too short.
   *
   * @param value the current text of the field
   */
  onQueryInput(value: string): void {
    if (this.control() === undefined) {
      this.modelChange.emit(value);
    }
    clearTimeout(this.debounceTimer);
    const query = value.trim();
    if (query.length < ADDRESS_QUERY_MIN_LENGTH) {
      this.latestRequest++;
      this.hasSearched.set(false);
      this.suggestions.set([]);
      return;
    }
    this.debounceTimer = setTimeout(() => void this.loadSuggestions(query), ADDRESS_QUERY_DEBOUNCE_MS);
  }

  /**
   * Moves through the open list with the arrow keys, picks the highlighted address with Enter and closes the list
   * with Escape. Escape only stops propagating while the list is open, so it still closes a surrounding dialog.
   *
   * @param event the key press in the field
   */
  onKeydown(event: KeyboardEvent): void {
    const count = this.suggestions().length;
    if (!this.panelVisible()) {
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        if (count > 0) {
          event.preventDefault();
          this.activeIndex.set(Math.min(count - 1, this.activeIndex() + 1));
        }
        break;
      case 'ArrowUp':
        if (count > 0) {
          event.preventDefault();
          this.activeIndex.set(Math.max(0, this.activeIndex() - 1));
        }
        break;
      case 'Enter':
        if (this.activeIndex() >= 0 && this.activeIndex() < count) {
          event.preventDefault();
          this.select(this.suggestions()[this.activeIndex()]);
        }
        break;
      case 'Escape':
        event.stopPropagation();
        this.closePanel();
        break;
    }
  }

  /**
   * Emits the picked address and closes the list.
   *
   * @param suggestion the picked address
   */
  select(suggestion: AddressSuggestionDTO): void {
    this.closePanel();
    this.addressSelected.emit(suggestion);
  }

  /**
   * Fetches the suggestions for a query and shows them, ignoring answers to queries the user has typed past.
   * A failed request shows no suggestions, since the field works without them.
   *
   * @param query the trimmed text of the field
   */
  private async loadSuggestions(query: string): Promise<void> {
    const request = ++this.latestRequest;
    let suggestions: AddressSuggestionDTO[];
    try {
      suggestions = await firstValueFrom(this.addressApi.getAddressSuggestions(query, this.translate.getCurrentLang()));
    } catch {
      suggestions = [];
    }
    if (request !== this.latestRequest) {
      return;
    }
    this.suggestions.set(suggestions);
    this.activeIndex.set(-1);
    this.hasSearched.set(true);
  }

  /**
   * Translates one of this component's own texts, whether or not the label and placeholder are translated.
   *
   * @param key the translation key
   * @returns the text in the current language
   */
  private translateKey(key: string): string {
    this.langChange();
    return this.translate.instant(key);
  }

  /**
   * Builds the element id of an option, which the field references while the option is highlighted.
   *
   * @param index the position of the option in the list
   * @returns the element id
   */
  private optionId(index: number): string {
    return `${this.listboxId}-option-${index}`;
  }

  /** Closes the list until the user types again. */
  private closePanel(): void {
    this.latestRequest++;
    clearTimeout(this.debounceTimer);
    this.hasSearched.set(false);
    this.activeIndex.set(-1);
  }

  /** Shows the list below the field, as wide as the field. */
  private openPanel(): void {
    const origin = this.inputWrapper().nativeElement;
    if (this.overlayRef === undefined) {
      const positionStrategy = createFlexibleConnectedPositionStrategy(this.injector, origin)
        .withFlexibleDimensions(false)
        .withPush(false)
        .withPositions(DROPDOWN_POSITIONS);
      this.overlayRef = createOverlayRef(this.injector, {
        positionStrategy,
        scrollStrategy: createRepositionScrollStrategy(this.injector),
      });
    }
    if (!this.overlayRef.hasAttached()) {
      this.overlayRef.updateSize({ width: origin.getBoundingClientRect().width });
      this.overlayRef.attach(new TemplatePortal(this.panel(), this.viewContainerRef));
    }
  }
}
