import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { By } from '@angular/platform-browser';
import { SelectComponent, SelectOption } from 'app/shared/components/atoms/select/select.component';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { createTranslateServiceMock, provideTranslateMock } from 'util/translate.mock';

describe('SelectComponent', () => {
  const mockItems: SelectOption[] = [
    { name: 'Option 1', value: 'opt1', icon: 'circle' },
    { name: 'Option 2', value: 'opt2' },
  ];

  let translateMock: ReturnType<typeof createTranslateServiceMock>;

  function createFixture(): ComponentFixture<SelectComponent> {
    const fixture = TestBed.createComponent(SelectComponent);
    fixture.componentRef.setInput('items', mockItems);
    fixture.componentRef.setInput('selected', mockItems[0]);
    fixture.componentRef.setInput('label', 'Test Label');
    fixture.componentRef.setInput('required', true);
    fixture.componentRef.setInput('placeholder', 'Choose...');
    fixture.componentRef.setInput('width', '200px');
    fixture.detectChanges();
    return fixture;
  }

  async function settle(fixture: ComponentFixture<SelectComponent>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function trigger(fixture: ComponentFixture<SelectComponent>): HTMLButtonElement {
    const root: HTMLElement = fixture.nativeElement;
    const button = root.querySelector<HTMLButtonElement>('button[role="combobox"]');
    if (button === null) {
      throw new Error('select trigger not rendered');
    }
    return button;
  }

  async function openOptions(fixture: ComponentFixture<SelectComponent>): Promise<HTMLElement[]> {
    trigger(fixture).click();
    await settle(fixture);
    return Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
  }

  beforeEach(async () => {
    translateMock = createTranslateServiceMock();
    await TestBed.configureTestingModule({
      imports: [SelectComponent],
      providers: [provideFontAwesomeTesting(), provideTranslateMock(translateMock)],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render label, asterisk, and placeholder', async () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('selected', undefined);
    await settle(fixture);

    const label = fixture.debugElement.query(By.css('label')).nativeElement;
    expect(label.textContent).toContain('Test Label');
    expect(label.textContent).toContain('*');
    expect(trigger(fixture).textContent).toContain('Choose...');
  });

  it('should not show asterisk when required=false', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('required', false);
    fixture.detectChanges();

    const label = fixture.debugElement.query(By.css('label')).nativeElement;
    expect(label.textContent).not.toContain('*');
  });

  it('should show a selected option that is a copy of the matching item', async () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('selected', { name: 'Option 2', value: 'opt2' });
    await settle(fixture);

    expect(trigger(fixture).textContent).toContain('Option 2');
  });

  it('should emit the picked item when an option is clicked', async () => {
    const fixture = createFixture();
    await settle(fixture);
    const emitSpy = vi.spyOn(fixture.componentInstance.selectedChange, 'emit');

    const options = await openOptions(fixture);
    options[1].click();

    expect(emitSpy).toHaveBeenCalledOnce();
    expect(emitSpy).toHaveBeenCalledWith(mockItems[1]);
  });

  it('should translate option labels when translateItems is set', async () => {
    vi.mocked(translateMock.instant).mockImplementation((key: string | string[]) => `translated:${String(key)}`);
    const fixture = createFixture();
    fixture.componentRef.setInput('translateItems', true);
    await settle(fixture);

    const options = await openOptions(fixture);

    expect(options.map(option => option.textContent?.trim())).toEqual(['translated:Option 1', 'translated:Option 2']);
  });

  it('should emit undefined when the selection is cleared', async () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('showClear', true);
    await settle(fixture);
    const emitSpy = vi.spyOn(fixture.componentInstance.selectedChange, 'emit');

    const root: HTMLElement = fixture.nativeElement;
    root.querySelector<HTMLButtonElement>('button[aria-label]:not([role="combobox"])')?.click();

    expect(emitSpy).toHaveBeenCalledOnce();
    expect(emitSpy).toHaveBeenCalledWith(undefined);
  });
});
