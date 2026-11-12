import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { AdminDependenciesComponent } from 'app/admin/dependencies/admin-dependencies.component';
import { AdminDependencyResourceApi } from 'app/generated/api/admin-dependency-resource-api';
import { DependenciesOverviewDTO } from 'app/generated/model/dependencies-overview-dto';
import { DependencyDTO } from 'app/generated/model/dependency-dto';
import { VulnerabilityDTO } from 'app/generated/model/vulnerability-dto';
import { createTranslateServiceMock, provideTranslateMock, TranslateServiceMock } from 'util/translate.mock';
import { provideToastServiceMock, createToastServiceMock, ToastServiceMock } from 'util/toast-service.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { FilterChange } from 'app/shared/components/atoms/filter-multiselect/filter-multiselect';

/** Helper to build a DependencyDTO with defaults. */
function dep(overrides: Partial<DependencyDTO> & Pick<DependencyDTO, 'name'>): DependencyDTO {
  return {
    name: overrides.name,
    group: overrides.group ?? '',
    version: overrides.version ?? '1.0.0',
    source: overrides.source ?? 'client',
    purl: overrides.purl ?? `pkg:npm/${overrides.name}@${overrides.version ?? '1.0.0'}`,
    vulnerabilities: overrides.vulnerabilities ?? [],
  };
}

/** Helper to build a VulnerabilityDTO. */
function vuln(id: string, severity: string, summary = ''): VulnerabilityDTO {
  return { id, severity, summary };
}

describe('AdminDependenciesComponent', () => {
  let component: AdminDependenciesComponent;
  let fixture: ComponentFixture<AdminDependenciesComponent>;
  let mockDependencyApi: {
    getOverview: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
  };
  let mockToastService: ToastServiceMock;
  let mockTranslateService: TranslateServiceMock;

  const vulnerableDep = dep({
    name: 'lodash',
    group: 'npm',
    version: '4.17.20',
    purl: 'pkg:npm/lodash@4.17.20',
    vulnerabilities: [vuln('GHSA-001', 'CRITICAL', 'Prototype pollution'), vuln('GHSA-002', 'HIGH', 'ReDoS')],
  });

  const secureDep = dep({ name: 'rxjs', group: 'npm', version: '7.8.1', purl: 'pkg:npm/rxjs@7.8.1' });

  const serverDep = dep({
    name: 'spring-boot-starter-web',
    group: 'org.springframework.boot',
    version: '3.2.0',
    source: 'server',
    purl: 'pkg:maven/org.springframework.boot/spring-boot-starter-web@3.2.0',
    vulnerabilities: [vuln('CVE-2024-001', 'CRITICAL', 'Remote code execution')],
  });

  const mediumVulnDep = dep({
    name: 'jackson-databind',
    group: 'com.fasterxml.jackson.core',
    version: '2.15.0',
    source: 'server',
    purl: 'pkg:maven/com.fasterxml.jackson.core/jackson-databind@2.15.0',
    vulnerabilities: [vuln('CVE-2024-002', 'MEDIUM', 'Deserialization flaw')],
  });

  const mockOverview: DependenciesOverviewDTO = {
    dependencies: [vulnerableDep, secureDep, serverDep, mediumVulnDep],
    serverCount: 2,
    clientCount: 2,
    totalVulnerabilities: 4,
    criticalCount: 2,
    highCount: 1,
    mediumCount: 1,
    lowCount: 0,
  };

  const emptyOverview: DependenciesOverviewDTO = {
    dependencies: [],
    serverCount: 0,
    clientCount: 0,
    totalVulnerabilities: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
  };

  beforeEach(async () => {
    mockDependencyApi = {
      getOverview: vi.fn(),
      refresh: vi.fn(),
    };

    mockToastService = createToastServiceMock();
    mockTranslateService = createTranslateServiceMock();

    mockDependencyApi.getOverview.mockReturnValue(of(mockOverview));

    await TestBed.configureTestingModule({
      imports: [AdminDependenciesComponent],
      providers: [
        { provide: AdminDependencyResourceApi, useValue: mockDependencyApi },
        provideTranslateMock(mockTranslateService),
        provideToastServiceMock(mockToastService),
        provideFontAwesomeTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDependenciesComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with correct default signal values', () => {
    expect(component.isLoading()).toBe(false);
    expect(component.isRefreshing()).toBe(false);
    expect(component.currentPage()).toBe(0);
    expect(component.pageSize()).toBe(25);
    expect(component.searchQuery()).toBe('');
    expect(component.sortField()).toBe('security');
    expect(component.sortDirection()).toBe('DESC');
    expect(component.selectedSecurityFilter()).toEqual([]);
    expect(component.selectedSourceFilter()).toEqual([]);
  });

  describe('Loading Dependencies', () => {
    it('should call getOverview on construction and populate the overview signal', async () => {
      await Promise.resolve();

      expect(mockDependencyApi.getOverview).toHaveBeenCalledOnce();
      expect(component.dependenciesOverview()).toEqual(mockOverview);
    });

    it('should show error toast when loading fails and reset isLoading', async () => {
      mockDependencyApi.getOverview.mockReturnValue(throwError(() => new Error('Network error')));

      await component.loadDependencies();

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('dependencies.toast.loadError');
      expect(component.isLoading()).toBe(false);
    });
  });

  describe('Refreshing Vulnerabilities', () => {
    it('should call refresh API and update the overview', async () => {
      const refreshedOverview: DependenciesOverviewDTO = Object.assign({}, mockOverview, { totalVulnerabilities: 5 });
      mockDependencyApi.refresh.mockReturnValue(of(refreshedOverview));

      await component.refreshVulnerabilities();

      expect(mockDependencyApi.refresh).toHaveBeenCalledOnce();
      expect(component.dependenciesOverview()).toEqual(refreshedOverview);
      expect(component.isRefreshing()).toBe(false);
    });

    it('should show success toast after successful refresh', async () => {
      mockDependencyApi.refresh.mockReturnValue(of(mockOverview));

      await component.refreshVulnerabilities();

      expect(mockToastService.showSuccessKey).toHaveBeenCalledWith('dependencies.toast.vulnerabilityRefreshSuccess');
    });

    it('should show error toast when refresh fails and reset isRefreshing', async () => {
      mockDependencyApi.refresh.mockReturnValue(throwError(() => new Error('API error')));

      await component.refreshVulnerabilities();

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('dependencies.toast.vulnerabilityLoadError');
      expect(component.isRefreshing()).toBe(false);
    });
  });

  describe('Search Handling', () => {
    it('should update search query and reset to first page', () => {
      component.currentPage.set(3);
      component.onSearchChange('lodash');

      expect(component.searchQuery()).toBe('lodash');
      expect(component.currentPage()).toBe(0);
    });

    it.each([
      { field: 'name', query: 'lodash', expectedName: 'lodash' },
      { field: 'group', query: 'springframework', expectedName: 'spring-boot-starter-web' },
      { field: 'version', query: '3.2.0', expectedName: 'spring-boot-starter-web' },
    ])('should filter dependencies by $field', async ({ query, expectedName }) => {
      await Promise.resolve();

      component.onSearchChange(query);
      const filtered = component.filteredDependencies();

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe(expectedName);
    });

    it('should perform case-insensitive search', async () => {
      await Promise.resolve();

      component.onSearchChange('LODASH');

      expect(component.filteredDependencies()).toHaveLength(1);
      expect(component.filteredDependencies()[0].name).toBe('lodash');
    });

    it('should return all dependencies when search query is empty', async () => {
      await Promise.resolve();

      component.onSearchChange('');

      expect(component.filteredDependencies()).toHaveLength(4);
    });
  });

  describe('Source Filter', () => {
    it.each([
      { label: 'server', filterValue: 'dependencies.sourceServer', expectedSource: 'server', expectedCount: 2 },
      { label: 'client', filterValue: 'dependencies.sourceClient', expectedSource: 'client', expectedCount: 2 },
    ])('should filter to show only $label dependencies', async ({ filterValue, expectedSource, expectedCount }) => {
      await Promise.resolve();

      component.onFilterChange({ filterId: 'source', selectedValues: [filterValue] });

      const filtered = component.filteredDependencies();
      expect(filtered).toHaveLength(expectedCount);
      expect(filtered.every(d => d.source === expectedSource)).toBe(true);
    });

    it('should show all dependencies when both server and client are selected', async () => {
      await Promise.resolve();

      component.onFilterChange({ filterId: 'source', selectedValues: ['dependencies.sourceServer', 'dependencies.sourceClient'] });

      expect(component.filteredDependencies()).toHaveLength(4);
    });

    it('should reset page to 0 when filter changes', () => {
      component.currentPage.set(5);
      component.onFilterChange({ filterId: 'source', selectedValues: ['dependencies.sourceServer'] });

      expect(component.currentPage()).toBe(0);
    });
  });

  describe('Security Filter', () => {
    it.each([
      { label: 'vulnerable', filterValue: 'dependencies.showVulnerableOnly', expectedCount: 3, hasVulns: true },
      { label: 'secure', filterValue: 'dependencies.secure', expectedCount: 1, hasVulns: false },
    ])('should filter to show only $label dependencies', async ({ filterValue, expectedCount, hasVulns }) => {
      await Promise.resolve();

      component.onFilterChange({ filterId: 'security', selectedValues: [filterValue] });

      const filtered = component.filteredDependencies();
      expect(filtered).toHaveLength(expectedCount);
      expect(filtered.every(d => (d.vulnerabilities?.length ?? 0) > 0 === hasVulns)).toBe(true);
    });

    it('should show all dependencies when both vulnerable and secure are selected', async () => {
      await Promise.resolve();

      component.onFilterChange({ filterId: 'security', selectedValues: ['dependencies.showVulnerableOnly', 'dependencies.secure'] });

      expect(component.filteredDependencies()).toHaveLength(4);
    });
  });

  describe('Sort Handling', () => {
    it('should update sort field and direction and reset page', () => {
      component.currentPage.set(3);
      component.onSortChange({ field: 'name', direction: 'ASC' });

      expect(component.sortField()).toBe('name');
      expect(component.sortDirection()).toBe('ASC');
      expect(component.currentPage()).toBe(0);
    });

    it('should sort dependencies by name ascending', async () => {
      await Promise.resolve();

      component.onSortChange({ field: 'name', direction: 'ASC' });
      const names = component.filteredDependencies().map(d => d.name);

      expect(names).toEqual(['jackson-databind', 'lodash', 'rxjs', 'spring-boot-starter-web']);
    });

    it('should sort dependencies by name descending', async () => {
      await Promise.resolve();

      component.onSortChange({ field: 'name', direction: 'DESC' });
      const names = component.filteredDependencies().map(d => d.name);

      expect(names).toEqual(['spring-boot-starter-web', 'rxjs', 'lodash', 'jackson-databind']);
    });

    it('should sort by security (vulnerability count) ascending', async () => {
      await Promise.resolve();

      component.onSortChange({ field: 'security', direction: 'ASC' });
      const counts = component.filteredDependencies().map(d => d.vulnerabilities?.length ?? 0);

      expect(counts).toEqual([0, 1, 1, 2]);
    });

    it('should sort by security descending by default', async () => {
      await Promise.resolve();

      const counts = component.filteredDependencies().map(d => d.vulnerabilities?.length ?? 0);

      expect(counts).toEqual([2, 1, 1, 0]);
    });
  });

  describe('Pagination', () => {
    it.each([
      { event: { first: 50, rows: 25 }, expectedPage: 2, expectedSize: 25 },
      { event: { first: 0, rows: 10 }, expectedPage: 0, expectedSize: 10 },
    ])('should compute page=$expectedPage, size=$expectedSize from event', ({ event, expectedPage, expectedSize }) => {
      component.onPageChange(event);

      expect(component.currentPage()).toBe(expectedPage);
      expect(component.pageSize()).toBe(expectedSize);
    });

    it('should paginate the filtered dependencies', async () => {
      await Promise.resolve();

      component.pageSize.set(2);
      component.currentPage.set(0);
      component.onSortChange({ field: 'name', direction: 'ASC' });

      const page = component.paginatedDependencies();
      expect(page).toHaveLength(2);
      expect(page[0].name).toBe('jackson-databind');
      expect(page[1].name).toBe('lodash');
    });

    it('should return correct filteredDependencyCount', async () => {
      await Promise.resolve();
      expect(component.filteredDependencyCount()).toBe(4);
    });
  });

  describe('Paginated Dependencies Enrichment', () => {
    it.each([
      { depName: 'lodash', expectedSeverity: 'CRITICAL', expectedColor: 'danger' },
      { depName: 'jackson-databind', expectedSeverity: 'MEDIUM', expectedColor: 'warn' },
      { depName: 'rxjs', expectedSeverity: 'LOW', expectedColor: 'secondary' },
    ])(
      'should enrich $depName with severity=$expectedSeverity, color=$expectedColor',
      async ({ depName, expectedSeverity, expectedColor }) => {
        await Promise.resolve();

        component.onSortChange({ field: 'name', direction: 'ASC' });
        const enriched = component.paginatedDependencies().find(d => d.name === depName);

        expect(enriched).toBeDefined();
        expect(enriched!.highestSeverity).toBe(expectedSeverity);
        expect(enriched!.severityTagColor).toBe(expectedColor);
      },
    );
  });

  describe('Vulnerability Expansion Toggle', () => {
    it('should expand and collapse vulnerability list on toggle', () => {
      component.toggleVulnerabilityExpansion(vulnerableDep);
      expect(component.isVulnerabilityExpanded(vulnerableDep)).toBe(true);

      component.toggleVulnerabilityExpansion(vulnerableDep);
      expect(component.isVulnerabilityExpanded(vulnerableDep)).toBe(false);
    });

    it('should track expansion by group:name key, not by object reference', () => {
      component.toggleVulnerabilityExpansion(vulnerableDep);

      const sameDep: DependencyDTO = Object.assign({}, vulnerableDep, { version: '4.17.21' });
      expect(component.isVulnerabilityExpanded(sameDep)).toBe(true);
      expect(component.isVulnerabilityExpanded(secureDep)).toBe(false);
    });
  });

  describe('Columns Configuration', () => {
    const expectedColumns = [
      { field: 'name', header: 'dependencies.column.name', width: '14rem' },
      { field: 'group', header: 'dependencies.column.group', width: '14rem' },
      { field: 'version', header: 'dependencies.column.version', width: '8rem' },
      { field: 'security', header: 'dependencies.column.security', width: '14rem' },
      { field: 'source', header: 'dependencies.column.source', width: '8rem' },
    ];

    it.each(expectedColumns)('should configure column $field correctly', ({ field, header, width }) => {
      fixture.detectChanges();
      const col = component.columns().find(c => c.field === field);

      expect(col).toBeDefined();
      expect(col!.header).toBe(header);
      expect(col!.width).toBe(width);
    });

    it('should define exactly 5 columns', () => {
      fixture.detectChanges();
      expect(component.columns()).toHaveLength(5);
    });
  });

  describe('Sortable Fields Configuration', () => {
    const expectedFields = [
      { fieldName: 'security', displayName: 'dependencies.column.security', type: 'NUMBER' },
      { fieldName: 'name', displayName: 'dependencies.column.name', type: 'TEXT' },
      { fieldName: 'group', displayName: 'dependencies.column.group', type: 'TEXT' },
      { fieldName: 'version', displayName: 'dependencies.column.version', type: 'TEXT' },
    ];

    it.each(expectedFields)('should configure sortable field $fieldName correctly', ({ fieldName, displayName, type }) => {
      const sortField = component.sortableFields.find(f => f.fieldName === fieldName);

      expect(sortField).toBeDefined();
      expect(sortField!.displayName).toBe(displayName);
      expect(sortField!.type).toBe(type);
    });
  });

  describe('Filters Configuration', () => {
    it('should include security filter when vulnerabilities exist', async () => {
      await Promise.resolve();

      const securityFilter = component.filters().find(f => f.filterId === 'security');

      expect(securityFilter).toBeDefined();
      expect(securityFilter!.filterOptions).toEqual(['dependencies.showVulnerableOnly', 'dependencies.secure']);
    });

    it('should not include security filter when no vulnerabilities exist', async () => {
      mockDependencyApi.getOverview.mockReturnValue(of(emptyOverview));
      await component.loadDependencies();

      expect(component.filters().find(f => f.filterId === 'security')).toBeUndefined();
    });

    it('should always include source filter', async () => {
      await Promise.resolve();

      const sourceFilter = component.filters().find(f => f.filterId === 'source');

      expect(sourceFilter).toBeDefined();
      expect(sourceFilter!.filterOptions).toEqual(['dependencies.sourceServer', 'dependencies.sourceClient']);
    });
  });

  describe('Download Dependencies', () => {
    it('should not throw when overview is undefined', () => {
      component.dependenciesOverview.set(undefined);
      expect(() => component.downloadDependencies()).not.toThrow();
    });

    it('should create a download anchor when overview is available', async () => {
      await Promise.resolve();

      const createElementSpy = vi.spyOn(document, 'createElement');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

      component.downloadDependencies();

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(revokeObjectURLSpy).toHaveBeenCalledOnce();

      createElementSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });
  });

  describe('Combined Filter and Search Interactions', () => {
    it.each([
      {
        label: 'source + search',
        filters: [{ filterId: 'source', selectedValues: ['dependencies.sourceServer'] }] as FilterChange[],
        search: 'jackson',
        expectedCount: 1,
        expectedName: 'jackson-databind',
      },
      {
        label: 'source + security',
        filters: [
          { filterId: 'source', selectedValues: ['dependencies.sourceClient'] },
          { filterId: 'security', selectedValues: ['dependencies.secure'] },
        ] as FilterChange[],
        search: '',
        expectedCount: 1,
        expectedName: 'rxjs',
      },
      {
        label: 'conflicting filters',
        filters: [
          { filterId: 'source', selectedValues: ['dependencies.sourceServer'] },
          { filterId: 'security', selectedValues: ['dependencies.secure'] },
        ] as FilterChange[],
        search: '',
        expectedCount: 0,
        expectedName: undefined,
      },
    ])('should correctly apply $label', async ({ filters, search, expectedCount, expectedName }) => {
      await Promise.resolve();

      for (const f of filters) {
        component.onFilterChange(f);
      }
      if (search) {
        component.onSearchChange(search);
      }

      const filtered = component.filteredDependencies();
      expect(filtered).toHaveLength(expectedCount);
      if (expectedName) {
        expect(filtered[0].name).toBe(expectedName);
      }
    });
  });
});
