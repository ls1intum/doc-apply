import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ResearchGroupInfoComponent } from 'app/usermanagement/research-group/research-group-info/research-group-info.component';
import { User } from 'app/core/auth/account.service';
import { ResearchGroupDTO } from 'app/generated/model/research-group-dto';
import { SavingStates } from 'app/shared/constants/saving-states';
import { provideTranslateMock } from 'util/translate.mock';
import { provideToastServiceMock, createToastServiceMock } from 'util/toast-service.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideAccountServiceMock, createAccountServiceMock, AccountServiceMock } from 'util/account.service.mock';
import {
  provideResearchGroupResourceApiMock,
  createResearchGroupResourceApiMock,
  ResearchGroupResourceApiMock,
} from 'util/research-group-resource-api.service.mock';
import { provideHttpClientMock } from 'util/http-client.mock';

describe('ResearchGroupInfoComponent', () => {
  let component: ResearchGroupInfoComponent;
  let fixture: ComponentFixture<ResearchGroupInfoComponent>;
  let mockResearchGroupApi: ResearchGroupResourceApiMock;
  let mockToastService: ReturnType<typeof createToastServiceMock>;
  let mockAccountService: AccountServiceMock;

  const mockResearchGroupData: ResearchGroupDTO = {
    name: 'Test Research Group',
    abbreviation: 'TRG',
    head: 'Dr. John Doe',
    website: 'https://test.com',
    email: 'test@example.com',
    city: 'Munich',
    postalCode: '80333',
    street: 'Test Street 123',
    description: 'Test description',
  };

  const mockUser: User = {
    id: 'user-1',
    email: 'john.doe@example.com',
    name: 'John Doe',
    memberships: [
      {
        researchGroupId: 'rg-1',
        name: 'Test Research Group',
      },
    ],
  };

  const setActiveUser = (activeResearchGroupId: string | undefined) => {
    mockAccountService.user.set(mockUser);
    mockAccountService.activeResearchGroupId.set(activeResearchGroupId);
  };

  beforeEach(async () => {
    vi.useFakeTimers();

    mockResearchGroupApi = createResearchGroupResourceApiMock();
    mockToastService = createToastServiceMock();
    mockAccountService = createAccountServiceMock();
    mockAccountService.user.set(undefined);

    await TestBed.configureTestingModule({
      imports: [ResearchGroupInfoComponent],
      providers: [
        provideResearchGroupResourceApiMock(mockResearchGroupApi),
        provideAccountServiceMock(mockAccountService),
        provideToastServiceMock(mockToastService),
        provideTranslateMock(),
        provideFontAwesomeTesting(),
        provideHttpClientMock(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResearchGroupInfoComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Form Validation', () => {
    it('should require name and head fields', () => {
      const nameControl = component.form.controls.name;
      const headControl = component.form.controls.head;

      nameControl.setValue('');
      headControl.setValue('');
      expect(nameControl.hasError('required')).toBe(true);
      expect(headControl.hasError('required')).toBe(true);

      nameControl.setValue('Test Name');
      headControl.setValue('Test Head');
      expect(nameControl.hasError('required')).toBe(false);
      expect(headControl.hasError('required')).toBe(false);
    });

    it('should validate email format', () => {
      const emailControl = component.form.controls.email;

      emailControl.setValue('invalid-email');
      expect(emailControl.valid).toBe(false);

      emailControl.setValue('valid@example.com');
      expect(emailControl.valid).toBe(true);
    });
  });

  describe('User and Research Group ID', () => {
    it('should compute researchGroupId from active research group', () => {
      setActiveUser('rg-1');
      fixture.detectChanges();

      expect(component.researchGroupId()).toBe('rg-1');
    });

    it('should return undefined researchGroupId when no active research group', () => {
      setActiveUser(undefined);
      fixture.detectChanges();

      expect(component.researchGroupId()).toBeUndefined();
    });
  });

  describe('Data Loading', () => {
    it('should load research group data and populate form when user is available', async () => {
      mockResearchGroupApi.getResearchGroup.mockReturnValue(of(mockResearchGroupData));
      setActiveUser('rg-1');

      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockResearchGroupApi.getResearchGroup).toHaveBeenCalledWith('rg-1');
      expect(component.form.value).toEqual({
        name: mockResearchGroupData.name,
        abbreviation: mockResearchGroupData.abbreviation,
        head: mockResearchGroupData.head,
        website: mockResearchGroupData.website,
        email: mockResearchGroupData.email,
        city: mockResearchGroupData.city,
        postalCode: mockResearchGroupData.postalCode,
        address: mockResearchGroupData.street,
        description: mockResearchGroupData.description,
      });
    });

    it.each([
      { description: 'no active research group id', active: undefined },
      { description: 'an empty active research group id', active: '' },
    ])('should not initialize when user has $description', async ({ active }) => {
      setActiveUser(active);

      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockResearchGroupApi.getResearchGroup).not.toHaveBeenCalled();
    });

    it('should show error toast when loading fails', async () => {
      mockResearchGroupApi.getResearchGroup.mockReturnValue(throwError(() => new Error('API Error')));
      setActiveUser('rg-1');

      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockToastService.showError).toHaveBeenCalledWith({
        summary: 'researchGroup.groupInfo.toasts.loadFailed',
        detail: 'researchGroup.groupInfo.toasts.loadFailed',
      });
    });

    it('should only initialize once even if effect runs multiple times', async () => {
      mockResearchGroupApi.getResearchGroup.mockReturnValue(of(mockResearchGroupData));

      setActiveUser('rg-1');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockResearchGroupApi.getResearchGroup).toHaveBeenCalledOnce();

      mockAccountService.user.set(Object.assign({}, mockUser));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockResearchGroupApi.getResearchGroup).toHaveBeenCalledOnce();
    });

    it('should not trigger an auto-save while the form is being populated from the API', async () => {
      mockResearchGroupApi.getResearchGroup.mockReturnValue(of(mockResearchGroupData));
      mockAccountService.user.set(mockUser);

      fixture.detectChanges();
      await fixture.whenStable();

      // Run any pending debounce timer; nothing should be scheduled.
      await vi.runAllTimersAsync();

      expect(mockResearchGroupApi.updateResearchGroup).not.toHaveBeenCalled();
      expect(component.savingState()).toBe(SavingStates.SAVED);
    });
  });

  describe('Auto-save', () => {
    it('should auto-save after a debounced user edit and settle the badge on SAVED', async () => {
      mockResearchGroupApi.getResearchGroup.mockReturnValue(of(mockResearchGroupData));
      mockResearchGroupApi.updateResearchGroup.mockReturnValue(of(mockResearchGroupData));
      setActiveUser('rg-1');

      fixture.detectChanges();
      await fixture.whenStable();

      component.form.patchValue({ name: 'Updated Name', head: 'Updated Head' });
      expect(component.savingState()).toBe(SavingStates.SAVING);

      await vi.runAllTimersAsync();
      await component.autoSave.flush();

      expect(mockResearchGroupApi.updateResearchGroup).toHaveBeenCalledWith(
        'rg-1',
        expect.objectContaining({
          name: 'Updated Name',
          head: 'Updated Head',
          abbreviation: mockResearchGroupData.abbreviation,
        }),
      );
      expect(component.savingState()).toBe(SavingStates.SAVED);
    });

    it('should leave the badge on SAVING while the form is invalid', async () => {
      mockResearchGroupApi.getResearchGroup.mockReturnValue(of(mockResearchGroupData));
      setActiveUser('rg-1');

      fixture.detectChanges();
      await fixture.whenStable();

      component.form.patchValue({ name: '', head: '' });
      await vi.runAllTimersAsync();

      expect(mockResearchGroupApi.updateResearchGroup).not.toHaveBeenCalled();
    });

    it('should settle the badge on FAILED and toast when the save request errors', async () => {
      mockResearchGroupApi.getResearchGroup.mockReturnValue(of(mockResearchGroupData));
      mockResearchGroupApi.updateResearchGroup.mockReturnValue(throwError(() => new Error('API Error')));
      setActiveUser('rg-1');

      fixture.detectChanges();
      await fixture.whenStable();

      component.form.patchValue({ name: 'Updated Name', head: 'Updated Head' });
      await component.autoSave.flush();

      expect(component.savingState()).toBe(SavingStates.FAILED);
      expect(mockToastService.showError).toHaveBeenCalledWith({ detail: 'researchGroup.groupInfo.toasts.saveFailed' });
    });

    it('should not call the API when there is no research group id', async () => {
      mockAccountService.user.set(Object.assign({}, mockUser, { researchGroup: undefined }));

      fixture.detectChanges();
      await fixture.whenStable();

      component.form.patchValue({ name: 'Test Name', head: 'Test Head' });
      await component.autoSave.flush();

      expect(mockResearchGroupApi.updateResearchGroup).not.toHaveBeenCalled();
    });
  });

  describe('Data Mapping', () => {
    it('should map street field between form address and DTO street', async () => {
      mockResearchGroupApi.getResearchGroup.mockReturnValue(of(Object.assign({}, mockResearchGroupData, { street: 'Test Street' })));
      mockResearchGroupApi.updateResearchGroup.mockReturnValue(of(mockResearchGroupData));
      setActiveUser('rg-1');

      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.form.value.address).toBe('Test Street');

      component.form.patchValue({ address: 'New Street' });
      await component.autoSave.flush();

      expect(mockResearchGroupApi.updateResearchGroup).toHaveBeenCalledWith('rg-1', expect.objectContaining({ street: 'New Street' }));
    });

    it('should default null name and head to empty strings on save', async () => {
      mockResearchGroupApi.getResearchGroup.mockReturnValue(of(mockResearchGroupData));
      mockResearchGroupApi.updateResearchGroup.mockReturnValue(of(mockResearchGroupData));
      setActiveUser('rg-1');

      fixture.detectChanges();
      await fixture.whenStable();

      component.form.controls.name.clearValidators();
      component.form.controls.head.clearValidators();
      component.form.controls.name.updateValueAndValidity();
      component.form.controls.head.updateValueAndValidity();
      component.form.patchValue({ name: null, head: null });

      await component.autoSave.flush();

      expect(mockResearchGroupApi.updateResearchGroup).toHaveBeenCalledWith('rg-1', expect.objectContaining({ name: '', head: '' }));
    });
  });
});
