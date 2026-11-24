import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { PrivacyPageComponent } from 'app/shared/pages/privacy-page/privacy-page.component';
import { UserDataExportResourceApi } from 'app/generated/api/user-data-export-resource-api';
import { DataExportStatusDTO, DataExportStatusDTOStatusEnum } from 'app/generated/model/data-export-status-dto';

import { createToastServiceMock, provideToastServiceMock } from 'util/toast-service.mock';
import { provideTranslateMock } from 'util/translate.mock';
import { WritableSignal } from '@angular/core';
import { createAccountServiceMock, provideAccountServiceMock } from 'util/account.service.mock';

type ExportStatus = DataExportStatusDTOStatusEnum | undefined;

type TestComponentAccess = {
  currentExportStatus: WritableSignal<ExportStatus>;
  exportButtonDisabled: () => boolean;
  tooltip: () => string | undefined;
  tooltipParams: () => Record<string, unknown>;
  cooldownSeconds: WritableSignal<number>;
  currentLang: WritableSignal<string>;
};

describe('PrivacyPageComponent', () => {
  let fixture: ComponentFixture<PrivacyPageComponent>;
  let component: PrivacyPageComponent;
  let mockTranslate: TranslateService;
  let componentAccess: TestComponentAccess;
  let accountServiceMock: ReturnType<typeof createAccountServiceMock>;

  const mockToast = createToastServiceMock();
  const serviceMocks = {
    getDataExportStatus: vi.fn(),
    requestDataExport: vi.fn(),
  };

  beforeEach(async () => {
    mockToast.showErrorKey = vi.fn();
    mockToast.showInfoKey = vi.fn();
    serviceMocks.getDataExportStatus.mockReturnValue(of({ status: undefined, cooldownSeconds: 0 }));
    serviceMocks.requestDataExport.mockReturnValue(of({}));
    accountServiceMock = createAccountServiceMock();

    await TestBed.configureTestingModule({
      imports: [PrivacyPageComponent],
      providers: [
        { provide: UserDataExportResourceApi, useValue: serviceMocks },
        provideAccountServiceMock(accountServiceMock),
        provideToastServiceMock(mockToast),
        provideTranslateMock(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PrivacyPageComponent);
    component = fixture.componentInstance;
    mockTranslate = TestBed.inject(TranslateService);
    componentAccess = {
      currentExportStatus: component.currentExportStatus,
      exportButtonDisabled: component.exportButtonDisabled,
      tooltip: component.tooltip,
      tooltipParams: component.tooltipParams,
      cooldownSeconds: component.cooldownSeconds,
      currentLang: component.currentLang,
    };
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Export Functionality', () => {
    it('should request data export, set status, and show info toast', async () => {
      serviceMocks.getDataExportStatus.mockReturnValue(of({ status: DataExportStatusDTOStatusEnum.InCreation, cooldownSeconds: 0 }));

      await component.exportUserData();

      expect(serviceMocks.requestDataExport).toHaveBeenCalledOnce();
      expect(componentAccess.currentExportStatus()).toBe(DataExportStatusDTOStatusEnum.InCreation);
      expect(componentAccess.exportButtonDisabled()).toBe(true);
      expect(componentAccess.tooltip()).toBe('privacy.export.tooltip.inCreation');
      expect(mockToast.showInfoKey).toHaveBeenCalledWith('privacy.export.requested');
    });

    it('should no-op refreshStatus when not signed in', async () => {
      const prevCalls = serviceMocks.getDataExportStatus.mock.calls.length;
      vi.spyOn(accountServiceMock, 'signedIn').mockReturnValue(false);

      await component['refreshStatus']();

      expect(serviceMocks.getDataExportStatus).toHaveBeenCalledTimes(prevCalls);
    });

    it.each([
      [409, 'privacy.export.requestFailed409'],
      [429, 'privacy.export.requestFailed429'],
      [500, 'privacy.export.requestFailed'],
    ])('should show toast for HTTP %i error', async (status, key) => {
      serviceMocks.requestDataExport.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));

      await component.exportUserData();

      expect(mockToast.showErrorKey).toHaveBeenCalledWith(key);
      expect(componentAccess.currentExportStatus()).toBeUndefined();
    });

    it('should show generic toast on non-Http error', async () => {
      serviceMocks.requestDataExport.mockReturnValue(throwError(() => new Error('boom')));

      await component.exportUserData();

      expect(mockToast.showErrorKey).toHaveBeenCalledWith('privacy.export.requestFailed');
      expect(componentAccess.currentExportStatus()).toBeUndefined();
    });
  });

  describe('Tooltip Behavior', () => {
    it('should disable button and show notLoggedIn tooltip when user not signed in', () => {
      (accountServiceMock.signedIn as WritableSignal<boolean>).set(false);

      expect(componentAccess.exportButtonDisabled()).toBe(true);
      expect(componentAccess.tooltip()).toBe('privacy.export.tooltip.notLoggedIn');
    });

    it('should show cooldown tooltip with days param and disable button', () => {
      component.cooldownSeconds.set(90000);
      expect(componentAccess.exportButtonDisabled()).toBe(true);
      expect(componentAccess.tooltip()).toBe('privacy.export.tooltip.cooldown');
      expect(componentAccess.tooltipParams()).toEqual({ days: '2' });
    });

    it('should return undefined tooltip when button is enabled', () => {
      componentAccess.currentExportStatus.set(undefined);
      componentAccess.cooldownSeconds.set(0);
      expect(componentAccess.exportButtonDisabled()).toBe(false);
      expect(componentAccess.tooltip()).toBeUndefined();
    });

    it('should return inCreation tooltip when an export is in creation', () => {
      componentAccess.currentExportStatus.set(DataExportStatusDTOStatusEnum.InCreation);
      expect(componentAccess.tooltip()).toBe('privacy.export.tooltip.inCreation');
    });

    it('should update currentLang when TranslateService emits onLangChange', () => {
      mockTranslate.use('de');
      expect(componentAccess.currentLang()).toBe('de');
    });

    it('should set cooldownSeconds to 0 when API returns explicit undefined cooldownSeconds', async () => {
      serviceMocks.getDataExportStatus.mockReturnValue(
        of({ status: DataExportStatusDTOStatusEnum.EmailSent, cooldownSeconds: undefined } as unknown as DataExportStatusDTO),
      );
      (accountServiceMock.signedIn as WritableSignal<boolean>).set(true);

      await component['refreshStatus']();

      expect(componentAccess.currentExportStatus()).toBe(DataExportStatusDTOStatusEnum.EmailSent);
      expect(componentAccess.cooldownSeconds()).toBe(0);
    });
  });
});
