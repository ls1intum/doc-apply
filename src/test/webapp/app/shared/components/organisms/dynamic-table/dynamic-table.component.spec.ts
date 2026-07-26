import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DynamicTableComponent } from 'app/shared/components/organisms/dynamic-table/dynamic-table.component';
import { LocalStorageService } from 'app/service/localStorage.service';
import { provideTranslateMock } from 'src/test/webapp/util/translate.mock';
import { provideFontAwesomeTesting } from 'src/test/webapp/util/fontawesome.testing';

describe('DynamicTableComponent', () => {
  let fixture: ComponentFixture<DynamicTableComponent>;
  let component: DynamicTableComponent;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DynamicTableComponent],
      providers: [provideTranslateMock(), provideFontAwesomeTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(DynamicTableComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not emit rowsHydrated when no storageKey is set', () => {
    const spy = vi.fn();
    component.rowsHydrated.subscribe(spy);

    fixture.detectChanges();

    expect(spy).not.toHaveBeenCalled();
  });

  it('should hydrate rows from localStorage on init when storageKey is set', () => {
    fixture.componentRef.setInput('storageKey', 'jobsPerPage');
    localStorage.setItem('jobsPerPage', '20');
    const spy = vi.fn();
    component.rowsHydrated.subscribe(spy);

    fixture.detectChanges();

    expect(spy).toHaveBeenCalledExactlyOnceWith(20);
  });

  it('should not emit rowsHydrated when the stored value matches the current rows input', () => {
    fixture.componentRef.setInput('storageKey', 'jobsPerPage');
    fixture.componentRef.setInput('rows', 20);
    localStorage.setItem('jobsPerPage', '20');
    const spy = vi.fn();
    component.rowsHydrated.subscribe(spy);

    fixture.detectChanges();

    expect(spy).not.toHaveBeenCalled();
  });

  it('should ignore stored values outside the allowed options', () => {
    fixture.componentRef.setInput('storageKey', 'jobsPerPage');
    localStorage.setItem('jobsPerPage', '7');
    const spy = vi.fn();
    component.rowsHydrated.subscribe(spy);

    fixture.detectChanges();

    expect(spy).not.toHaveBeenCalled();
  });

  describe('mobile default', () => {
    const setViewport = (mobile: boolean): void => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn().mockImplementation((query: string) => ({ matches: mobile, media: query })),
      );
    };

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should start on a shorter page on a phone-sized viewport', () => {
      setViewport(true);
      fixture.componentRef.setInput('rows', 10);
      const spy = vi.fn();
      component.rowsHydrated.subscribe(spy);

      fixture.detectChanges();

      expect(spy).toHaveBeenCalledExactlyOnceWith(5);
    });

    it('should keep the size the view asked for on a larger viewport', () => {
      setViewport(false);
      fixture.componentRef.setInput('rows', 10);
      const spy = vi.fn();
      component.rowsHydrated.subscribe(spy);

      fixture.detectChanges();

      expect(spy).not.toHaveBeenCalled();
    });

    it('should let a stored preference win over the mobile default', () => {
      setViewport(true);
      fixture.componentRef.setInput('storageKey', 'jobsPerPage');
      fixture.componentRef.setInput('rows', 10);
      localStorage.setItem('jobsPerPage', '20');
      const spy = vi.fn();
      component.rowsHydrated.subscribe(spy);

      fixture.detectChanges();

      expect(spy).toHaveBeenCalledExactlyOnceWith(20);
    });

    it('should not force the mobile default on a table that does not offer it', () => {
      setViewport(true);
      fixture.componentRef.setInput('rows', 25);
      fixture.componentRef.setInput('rowsPerPageOptions', [25, 50, 100]);
      const spy = vi.fn();
      component.rowsHydrated.subscribe(spy);

      fixture.detectChanges();

      expect(spy).not.toHaveBeenCalled();
    });

    it('should keep the short page over a stored size when the view always uses it', () => {
      setViewport(true);
      fixture.componentRef.setInput('storageKey', 'jobsPerPage');
      fixture.componentRef.setInput('alwaysUseMobileRows', true);
      fixture.componentRef.setInput('rows', 10);
      localStorage.setItem('jobsPerPage', '20');
      const spy = vi.fn();
      component.rowsHydrated.subscribe(spy);

      fixture.detectChanges();

      expect(spy).toHaveBeenCalledExactlyOnceWith(5);
    });

    it('should still honour a stored size on a larger viewport when the view always uses the short page', () => {
      setViewport(false);
      fixture.componentRef.setInput('storageKey', 'jobsPerPage');
      fixture.componentRef.setInput('alwaysUseMobileRows', true);
      fixture.componentRef.setInput('rows', 10);
      localStorage.setItem('jobsPerPage', '20');
      const spy = vi.fn();
      component.rowsHydrated.subscribe(spy);

      fixture.detectChanges();

      expect(spy).toHaveBeenCalledExactlyOnceWith(20);
    });

    it('should fall back to the stored size when the view always uses a short page it does not offer', () => {
      setViewport(true);
      fixture.componentRef.setInput('storageKey', 'dependencies');
      fixture.componentRef.setInput('alwaysUseMobileRows', true);
      fixture.componentRef.setInput('rowsPerPageOptions', [25, 50, 100]);
      fixture.componentRef.setInput('rows', 25);
      localStorage.setItem('dependencies', '50');
      const spy = vi.fn();
      component.rowsHydrated.subscribe(spy);

      fixture.detectChanges();

      expect(spy).toHaveBeenCalledExactlyOnceWith(50);
    });

    it('should not emit when the view already asks for the mobile default', () => {
      setViewport(true);
      fixture.componentRef.setInput('rows', 5);
      const spy = vi.fn();
      component.rowsHydrated.subscribe(spy);

      fixture.detectChanges();

      expect(spy).not.toHaveBeenCalled();
    });
  });

  it('should persist a new rows value on lazy load when storageKey is set', () => {
    fixture.componentRef.setInput('storageKey', 'jobsPerPage');
    fixture.componentRef.setInput('rows', 10);
    fixture.detectChanges();
    const saveSpy = vi.spyOn(TestBed.inject(LocalStorageService), 'savePageSize');

    component.emitLazy({ first: 0, rows: 20 });

    expect(saveSpy).toHaveBeenCalledExactlyOnceWith('jobsPerPage', 20);
  });

  it('should not write to localStorage when lazy-load reports the same rows', () => {
    fixture.componentRef.setInput('storageKey', 'jobsPerPage');
    fixture.componentRef.setInput('rows', 10);
    fixture.detectChanges();
    const saveSpy = vi.spyOn(TestBed.inject(LocalStorageService), 'savePageSize');

    component.emitLazy({ first: 0, rows: 10 });

    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('should not write to localStorage when storageKey is not set', () => {
    fixture.componentRef.setInput('rows', 10);
    fixture.detectChanges();
    const saveSpy = vi.spyOn(TestBed.inject(LocalStorageService), 'savePageSize');

    component.emitLazy({ first: 0, rows: 20 });

    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('should forward lazyLoad events to consumers', () => {
    const spy = vi.fn();
    component.lazyLoad.subscribe(spy);

    component.emitLazy({ first: 20, rows: 10 });

    expect(spy).toHaveBeenCalledExactlyOnceWith({ first: 20, rows: 10 });
  });
});
