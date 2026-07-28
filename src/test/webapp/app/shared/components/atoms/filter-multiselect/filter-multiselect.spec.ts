import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FilterMultiselect } from 'app/shared/components/atoms/filter-multiselect/filter-multiselect';
import { provideTranslateMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';

describe('FilterMultiselect', () => {
  const mockFilterOptions = ['Option A', 'Option B', 'Option C', 'Option D'];

  function createFilterMultiselectFixture(
    overrideInputs?: Partial<{
      filterId: string;
      filterLabel: string;
      filterSearchPlaceholder: string;
      filterOptions: string[];
      shouldTranslateOptions: boolean;
    }>,
  ) {
    const fixture = TestBed.createComponent(FilterMultiselect);

    fixture.componentRef.setInput('filterId', overrideInputs?.filterId ?? 'test-filter-id');
    fixture.componentRef.setInput('filterLabel', overrideInputs?.filterLabel ?? 'Test Filter');
    fixture.componentRef.setInput('filterSearchPlaceholder', overrideInputs?.filterSearchPlaceholder ?? 'Search...');
    fixture.componentRef.setInput('filterOptions', overrideInputs?.filterOptions ?? mockFilterOptions);
    fixture.componentRef.setInput('shouldTranslateOptions', overrideInputs?.shouldTranslateOptions ?? false);

    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    // jsdom does not implement scrollIntoView, which the highlight effect calls.
    Element.prototype.scrollIntoView = vi.fn();

    await TestBed.configureTestingModule({
      imports: [FilterMultiselect],
      providers: [provideFontAwesomeTesting(), provideTranslateMock()],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each<[string, string[]]>([
    ['', mockFilterOptions],
    ['Option A', ['Option A']],
    ['option b', ['Option B']],
  ])('should filter options for search term "%s"', (searchTerm, expected) => {
    const filterFixture = createFilterMultiselectFixture();
    filterFixture.componentInstance.searchTerm.set(searchTerm);

    expect(filterFixture.componentInstance.filteredOptions()).toEqual(expected);
  });

  it('should clear search term when opening the dropdown', () => {
    const fx = createFilterMultiselectFixture();
    fx.componentInstance.searchTerm.set('abc');
    fx.componentInstance.toggleDropdown();
    expect(fx.componentInstance.isOpen()).toBe(true);
    expect(fx.componentInstance.searchTerm()).toBe('');
  });

  it('should filter translated options when shouldTranslateOptions is true', () => {
    const filterFixture = createFilterMultiselectFixture({
      shouldTranslateOptions: true,
      filterOptions: ['key.option.a', 'key.option.b'],
    });
    filterFixture.componentInstance.searchTerm.set('key.option.a');

    expect(filterFixture.componentInstance.filteredOptions()).toEqual(['key.option.a']);
  });

  it('should derive selectedOptions and counts from selectedValues', () => {
    const fx = createFilterMultiselectFixture();
    const comp = fx.componentInstance;

    expect(comp.hasSelectedItems()).toBe(false);
    expect(comp.selectedCount()).toBe(0);
    expect(comp.totalCount()).toBe(4);

    comp.selectedValues.set(['Option A', 'Option C']);
    expect(comp.hasSelectedItems()).toBe(true);
    expect(comp.selectedOptions().map(o => o.value)).toEqual(['Option A', 'Option C']);
    expect(comp.selectedCount()).toBe(2);
  });

  it('should toggle and close dropdown state', () => {
    const filterFixture = createFilterMultiselectFixture();
    const comp = filterFixture.componentInstance;

    comp.toggleDropdown();
    expect(comp.isOpen()).toBe(true);

    comp.toggleDropdown();
    expect(comp.isOpen()).toBe(false);

    comp.isOpen.set(true);
    comp.closeDropdown();
    expect(comp.isOpen()).toBe(false);
  });

  it('should toggle option selection and emit change with filterId in correct order', () => {
    const filterFixture = createFilterMultiselectFixture({ filterId: 'custom-filter-id' });

    const filterChangeSpy = vi.spyOn(filterFixture.componentInstance.filterChange, 'emit');

    filterFixture.componentInstance.toggleOption('Option A');
    expect(filterFixture.componentInstance.selectedValues()).toEqual(['Option A']);
    expect(filterChangeSpy).toHaveBeenNthCalledWith(1, {
      filterId: 'custom-filter-id',
      selectedValues: ['Option A'],
    });

    filterFixture.componentInstance.toggleOption('Option B');
    expect(filterFixture.componentInstance.selectedValues()).toEqual(['Option A', 'Option B']);
    expect(filterChangeSpy).toHaveBeenNthCalledWith(2, {
      filterId: 'custom-filter-id',
      selectedValues: ['Option A', 'Option B'],
    });

    filterFixture.componentInstance.toggleOption('Option A');
    expect(filterFixture.componentInstance.selectedValues()).toEqual(['Option B']);
    expect(filterChangeSpy).toHaveBeenNthCalledWith(3, {
      filterId: 'custom-filter-id',
      selectedValues: ['Option B'],
    });

    expect(filterChangeSpy).toHaveBeenCalledTimes(3);
  });

  it('should handle search input change', () => {
    const filterFixture = createFilterMultiselectFixture();

    const mockInput = document.createElement('input');
    mockInput.value = 'new search term';

    const mockEvent: Partial<Event> = {
      target: mockInput,
    };

    filterFixture.componentInstance.onSearchChange(mockEvent as Event);

    expect(filterFixture.componentInstance.searchTerm()).toBe('new search term');
  });

  it('should close dropdown on outside click but keep open on inside click', () => {
    const fx = createFilterMultiselectFixture();
    fx.componentInstance.isOpen.set(true);

    const insideEl = fx.nativeElement.querySelector('.filter-multiselect') ?? fx.nativeElement;
    fx.componentInstance.onDocumentClick({ target: insideEl } as unknown as Event);
    expect(fx.componentInstance.isOpen()).toBe(true);

    fx.componentInstance.onDocumentClick({ target: document.createElement('div') } as unknown as Event);
    expect(fx.componentInstance.isOpen()).toBe(false);
  });

  it('should handle empty filter options', () => {
    const filterFixture = createFilterMultiselectFixture({
      filterOptions: [],
    });

    expect(filterFixture.componentInstance.filteredOptions()).toEqual([]);
    expect(filterFixture.componentInstance.totalCount()).toBe(0);
  });

  it('should move the highlight when arrow keys are pressed while the search field has focus', () => {
    const fx = createFilterMultiselectFixture();
    const comp = fx.componentInstance;
    comp.toggleDropdown();
    fx.detectChanges();

    const searchInput = fx.nativeElement.querySelector('input[type="text"]') as HTMLInputElement;
    expect(searchInput).toBeTruthy();
    searchInput.focus();

    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fx.detectChanges();
    expect(comp.focusedIndexOptionList()).toBe(0);

    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fx.detectChanges();
    expect(comp.focusedIndexOptionList()).toBe(1);
  });

  it('should select the highlighted option when Enter is pressed while the search field has focus', () => {
    const fx = createFilterMultiselectFixture();
    const comp = fx.componentInstance;
    comp.toggleDropdown();
    fx.detectChanges();

    const searchInput = fx.nativeElement.querySelector('input[type="text"]') as HTMLInputElement;
    searchInput.focus();

    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fx.detectChanges();

    expect(comp.selectedValues()).toEqual(['Option A']);
  });

  it('should point aria-activedescendant at the highlighted option so it is announced', () => {
    const fx = createFilterMultiselectFixture();
    const comp = fx.componentInstance;
    comp.toggleDropdown();
    fx.detectChanges();

    const searchInput = fx.nativeElement.querySelector('input[type="text"]') as HTMLInputElement;
    expect(searchInput.getAttribute('aria-activedescendant')).toBeNull();

    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fx.detectChanges();

    const activeId = searchInput.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    const highlighted = fx.nativeElement.querySelector(`#${activeId}`) as HTMLElement;
    expect(highlighted.textContent).toContain('Option A');
  });

  it('should toggle the visually highlighted option when Enter is pressed', () => {
    const fx = createFilterMultiselectFixture();
    const comp = fx.componentInstance;
    comp.toggleDropdown();
    fx.detectChanges();

    comp.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' })); // index 0 -> Option A
    comp.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' })); // index 1 -> Option B
    comp.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(comp.selectedValues()).toEqual(['Option B']);
  });

  it('should deselect an already-selected option when Enter is pressed on it', () => {
    const fx = createFilterMultiselectFixture();
    const comp = fx.componentInstance;
    comp.selectedValues.set(['Option A']);
    comp.toggleDropdown(); // snapshot now lists Option A first
    fx.detectChanges();

    comp.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' })); // index 0 -> Option A
    comp.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(comp.selectedValues()).toEqual([]);
  });

  it('should not reorder rendered options while the dropdown is open after a toggle', () => {
    const fx = createFilterMultiselectFixture();
    const comp = fx.componentInstance;
    comp.toggleDropdown();
    fx.detectChanges();

    const orderBefore = comp.visibleOptions().map(o => o.value);
    expect(orderBefore).toEqual(['Option A', 'Option B', 'Option C', 'Option D']);

    comp.toggleOption('Option C');
    fx.detectChanges();

    const orderAfter = comp.visibleOptions().map(o => o.value);
    expect(orderAfter).toEqual(orderBefore);
  });

  it('should re-snapshot the rendered order on the next open', () => {
    const fx = createFilterMultiselectFixture();
    const comp = fx.componentInstance;
    comp.selectedValues.set(['Option C']);
    comp.toggleDropdown();
    expect(comp.visibleOptions().map(o => o.value)).toEqual(['Option C', 'Option A', 'Option B', 'Option D']);
    comp.toggleDropdown();
    comp.toggleDropdown();
    expect(comp.visibleOptions().map(o => o.value)).toEqual(['Option C', 'Option A', 'Option B', 'Option D']);
  });

  it('should reset the focused option index when the search term changes', () => {
    const fx = createFilterMultiselectFixture();
    const comp = fx.componentInstance;
    comp.toggleDropdown();
    comp.focusedIndexOptionList.set(2);

    const inputEl = document.createElement('input');
    inputEl.value = 'opt';
    comp.onSearchChange({ target: inputEl } as unknown as Event);

    expect(comp.focusedIndexOptionList()).toBe(-1);
  });

  it('should close the dropdown when focus moves to an element outside the component', () => {
    const fx = createFilterMultiselectFixture();
    const comp = fx.componentInstance;
    comp.isOpen.set(true);

    const outside = document.createElement('button');
    comp.onFocusOut({ relatedTarget: outside } as unknown as FocusEvent);

    expect(comp.isOpen()).toBe(false);
  });

  it('should close the dropdown when focus moves to nothing', () => {
    const fx = createFilterMultiselectFixture();
    const comp = fx.componentInstance;
    comp.isOpen.set(true);

    comp.onFocusOut({ relatedTarget: null } as unknown as FocusEvent);

    expect(comp.isOpen()).toBe(false);
  });

  it('should keep the dropdown open when focus moves between elements inside the component', () => {
    const fx = createFilterMultiselectFixture();
    const comp = fx.componentInstance;
    comp.isOpen.set(true);

    const inside = fx.nativeElement.querySelector('.filter-multiselect') as HTMLElement;
    comp.onFocusOut({ relatedTarget: inside } as unknown as FocusEvent);

    expect(comp.isOpen()).toBe(true);
  });

  it('should scroll the focused option into view on arrow-key navigation', () => {
    const fx = createFilterMultiselectFixture();
    const comp = fx.componentInstance;
    comp.toggleDropdown();
    fx.detectChanges();

    const root = fx.nativeElement as HTMLElement;
    const optionEls = root.querySelectorAll<HTMLElement>('[data-testid="filter-option"]');
    expect(optionEls.length).toBeGreaterThan(1);
    Array.from(optionEls).forEach(el => {
      el.scrollIntoView = vi.fn();
    });
    const scrollSpies = Array.from(optionEls).map(el => vi.spyOn(el, 'scrollIntoView'));

    comp.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' })); // -> index 0
    fx.detectChanges();
    comp.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' })); // -> index 1
    fx.detectChanges();

    expect(scrollSpies[0]).toHaveBeenCalledExactlyOnceWith({ block: 'nearest', inline: 'nearest' });
    expect(scrollSpies[1]).toHaveBeenCalledExactlyOnceWith({ block: 'nearest', inline: 'nearest' });
  });
});
