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
