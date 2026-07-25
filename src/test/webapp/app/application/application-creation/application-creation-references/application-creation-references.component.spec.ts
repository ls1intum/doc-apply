import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideTranslateMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { createToastServiceMock, provideToastServiceMock, ToastServiceMock } from 'util/toast-service.mock';
import {
  createMockReferenceRequestDTO,
  createReferenceRequestResourceApiMock,
  provideReferenceRequestResourceApiMock,
  ReferenceRequestResourceApiMock,
} from 'util/reference-request-resource-api.service.mock';
import ApplicationCreationReferencesComponent from 'app/application/application-creation/application-creation-references/application-creation-references.component';
import { ReferenceRequestDTO } from 'app/generated/model/reference-request-dto';
import { SelectOption } from 'app/shared/components/atoms/select/select.component';
import { throwError } from 'rxjs';

describe('ApplicationCreationReferencesComponent', () => {
  const APPLICATION_ID = '11111111-0000-0000-0000-000000000001';

  let fixture: ComponentFixture<ApplicationCreationReferencesComponent>;
  let component: ApplicationCreationReferencesComponent;
  let referenceApi: ReferenceRequestResourceApiMock;
  let toast: ToastServiceMock;

  const setupFixture = async (initial: ReferenceRequestDTO[] = [], requiredCount = 2, referenceLettersConfidential = true) => {
    referenceApi = createReferenceRequestResourceApiMock(initial);
    toast = createToastServiceMock();

    await TestBed.configureTestingModule({
      imports: [ApplicationCreationReferencesComponent],
      providers: [
        provideReferenceRequestResourceApiMock(referenceApi),
        provideToastServiceMock(toast),
        provideTranslateMock(),
        provideFontAwesomeTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApplicationCreationReferencesComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('applicationId', APPLICATION_ID);
    fixture.componentRef.setInput('requiredCount', requiredCount);
    fixture.componentRef.setInput('referenceLettersConfidential', referenceLettersConfidential);
    fixture.detectChanges();
    await fixture.whenStable();
  };

  const fillForm = (overrides: Partial<{ title: string; firstName: string; lastName: string; email: string }> = {}) => {
    const values = Object.assign({ title: 'Prof. Dr.', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' }, overrides);
    component.addForm.controls.title.setValue(values.title);
    component.addForm.controls.firstName.setValue(values.firstName);
    component.addForm.controls.lastName.setValue(values.lastName);
    component.addForm.controls.email.setValue(values.email);
    component.addForm.updateValueAndValidity();
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial load', () => {
    beforeEach(async () => {
      await setupFixture([
        createMockReferenceRequestDTO({ referenceRequestId: 'a', email: 'first@example.com' }),
        createMockReferenceRequestDTO({ referenceRequestId: 'b', email: 'second@example.com' }),
      ]);
    });

    it('should fetch existing references for the active application on init', () => {
      expect(referenceApi.getReferences).toHaveBeenCalledOnce();
      expect(referenceApi.getReferences).toHaveBeenCalledWith(APPLICATION_ID);
      expect(component.references()).toHaveLength(2);
    });

    it('should populate the visible list with the rows returned by the API', () => {
      expect(component.references()).toEqual([
        expect.objectContaining({ referenceRequestId: 'a', email: 'first@example.com' }),
        expect.objectContaining({ referenceRequestId: 'b', email: 'second@example.com' }),
      ]);
    });

    it('should toast an error when the initial load fails', async () => {
      referenceApi = createReferenceRequestResourceApiMock();
      referenceApi.getReferences.mockReturnValueOnce(throwError(() => new Error('boom')));
      toast = createToastServiceMock();

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [ApplicationCreationReferencesComponent],
        providers: [
          provideReferenceRequestResourceApiMock(referenceApi),
          provideToastServiceMock(toast),
          provideTranslateMock(),
          provideFontAwesomeTesting(),
        ],
      }).compileComponents();

      const erroringFixture = TestBed.createComponent(ApplicationCreationReferencesComponent);
      erroringFixture.componentRef.setInput('applicationId', APPLICATION_ID);
      erroringFixture.componentRef.setInput('requiredCount', 1);
      erroringFixture.detectChanges();
      await erroringFixture.whenStable();

      expect(toast.showErrorKey).toHaveBeenCalledOnce();
      expect(toast.showErrorKey).toHaveBeenCalledWith('entity.applicationReferences.toast.loadFailed');
    });
  });

  describe('email validation', () => {
    beforeEach(async () => {
      await setupFixture();
    });

    it.each([
      { input: 'plainaddress', expectedValid: false },
      { input: 'missing@dot', expectedValid: false },
      { input: 'missingtld@dot.', expectedValid: false },
      { input: 'valid@example.com', expectedValid: true },
      { input: 'valid+alias@sub.example.org', expectedValid: true },
    ])('should treat "$input" as valid=$expectedValid', ({ input, expectedValid }) => {
      component.addForm.controls.email.setValue(input);
      component.addForm.controls.email.updateValueAndValidity();

      expect(component.addForm.controls.email.valid).toBe(expectedValid);
    });
  });

  describe('title selector', () => {
    beforeEach(async () => {
      await setupFixture();
    });

    it('should write the selected option value into the title form control', () => {
      const option: SelectOption = { name: 'Prof. Dr.', value: 'Prof. Dr.' };

      component.onTitleSelected(option);

      expect(component.addForm.controls.title.value).toBe('Prof. Dr.');
      expect(component.selectedTitleOption()).toBe(option);
    });

    it('should clear the title control when selection is cleared', () => {
      component.onTitleSelected({ name: 'Dr.', value: 'Dr.' });

      component.onTitleSelected(undefined);

      expect(component.addForm.controls.title.value).toBe('');
      expect(component.selectedTitleOption()).toBeUndefined();
    });
  });

  describe('add referee', () => {
    beforeEach(async () => {
      await setupFixture();
    });

    it('should not call the API when the form is invalid', async () => {
      // form starts empty: required fields invalid
      await component.onAdd();

      expect(referenceApi.add).not.toHaveBeenCalled();
      expect(component.addForm.touched).toBe(true);
    });

    it('should POST trimmed name values and append the new entry to the list', async () => {
      fillForm({ firstName: '  Alan ', lastName: '  Turing ', email: 'alan@example.com' });

      await component.onAdd();

      expect(referenceApi.add).toHaveBeenCalledOnce();
      expect(referenceApi.add).toHaveBeenCalledWith(APPLICATION_ID, {
        title: 'Prof. Dr.',
        firstName: 'Alan',
        lastName: 'Turing',
        email: 'alan@example.com',
      });
      expect(component.references()).toHaveLength(1);
    });

    it('should reset the form and clear touched state after a successful add', async () => {
      fillForm();
      // simulate the user blurring all fields before pressing Add
      component.addForm.markAllAsTouched();
      component.addForm.markAsDirty();

      await component.onAdd();

      expect(component.addForm.controls.firstName.value).toBe('');
      expect(component.addForm.controls.email.value).toBe('');
      expect(component.addForm.touched).toBe(false);
      expect(component.addForm.dirty).toBe(false);
      expect(component.selectedTitleOption()).toBeUndefined();
    });

    it('should emit referencesChanged with the updated list after add', async () => {
      const emitSpy = vi.spyOn(component.referencesChanged, 'emit');
      fillForm();

      await component.onAdd();

      expect(emitSpy).toHaveBeenCalledOnce();
      expect(emitSpy).toHaveBeenCalledWith(component.references());
    });

    it('should surface a toast and keep the form values when the API errors', async () => {
      referenceApi.add.mockReturnValueOnce(throwError(() => new Error('boom')));
      fillForm({ email: 'will-fail@example.com' });

      await component.onAdd();

      expect(toast.showErrorKey).toHaveBeenCalledOnce();
      expect(toast.showErrorKey).toHaveBeenCalledWith('entity.applicationReferences.toast.addFailed');
      expect(component.references()).toHaveLength(0);
      expect(component.addForm.controls.email.value).toBe('will-fail@example.com');
    });
  });

  describe('remove referee', () => {
    const existing = createMockReferenceRequestDTO({ referenceRequestId: 'to-remove', email: 'remove@example.com' });

    beforeEach(async () => {
      await setupFixture([existing]);
    });

    it('should DELETE and drop the entry from the local list', async () => {
      await component.onRemove(existing);

      expect(referenceApi.remove).toHaveBeenCalledOnce();
      expect(referenceApi.remove).toHaveBeenCalledWith(APPLICATION_ID, existing.referenceRequestId);
      expect(component.references()).toHaveLength(0);
    });

    it('should emit referencesChanged with the new list after remove', async () => {
      const emitSpy = vi.spyOn(component.referencesChanged, 'emit');

      await component.onRemove(existing);

      expect(emitSpy).toHaveBeenCalledOnce();
      expect(emitSpy).toHaveBeenCalledWith([]);
    });

    it('should be a no-op for an entry without an id', async () => {
      await component.onRemove(Object.assign({}, existing, { referenceRequestId: undefined }));

      expect(referenceApi.remove).not.toHaveBeenCalled();
      expect(component.references()).toHaveLength(1);
    });

    it('should surface a toast and keep the entry on API failure', async () => {
      referenceApi.remove.mockReturnValueOnce(throwError(() => new Error('boom')));

      await component.onRemove(existing);

      expect(toast.showErrorKey).toHaveBeenCalledOnce();
      expect(toast.showErrorKey).toHaveBeenCalledWith('entity.applicationReferences.toast.removeFailed');
      expect(component.references()).toHaveLength(1);
    });
  });

  describe('edit referee', () => {
    const existing = createMockReferenceRequestDTO({
      referenceRequestId: 'to-edit',
      title: 'Prof. Dr.',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    });

    beforeEach(async () => {
      await setupFixture([existing]);
    });

    it('should load the selected referee into the form for editing', () => {
      component.onEdit(existing);

      expect(component.editingId()).toBe('to-edit');
      expect(component.addForm.controls.firstName.value).toBe('Ada');
      expect(component.addForm.controls.email.value).toBe('ada@example.com');
      expect(component.selectedTitleOption()).toEqual({ name: 'Prof. Dr.', value: 'Prof. Dr.' });
    });

    it('should PUT and replace the edited entry on submit', async () => {
      component.onEdit(existing);
      fillForm({ firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com' });

      await component.onSubmit();

      expect(referenceApi.update).toHaveBeenCalledOnce();
      expect(referenceApi.update).toHaveBeenCalledWith(APPLICATION_ID, 'to-edit', {
        title: 'Prof. Dr.',
        firstName: 'Grace',
        lastName: 'Hopper',
        email: 'grace@example.com',
      });
      expect(referenceApi.add).not.toHaveBeenCalled();
      expect(component.references()).toEqual([expect.objectContaining({ referenceRequestId: 'to-edit', email: 'grace@example.com' })]);
      expect(component.editingId()).toBeUndefined();
    });

    it('should emit referencesChanged after a successful edit', async () => {
      const emitSpy = vi.spyOn(component.referencesChanged, 'emit');
      component.onEdit(existing);
      fillForm({ email: 'grace@example.com' });

      await component.onUpdate();

      expect(emitSpy).toHaveBeenCalledOnce();
      expect(emitSpy).toHaveBeenCalledWith(component.references());
    });

    it('should surface a toast and keep editing state when the update fails', async () => {
      referenceApi.update.mockReturnValueOnce(throwError(() => new Error('boom')));
      component.onEdit(existing);
      fillForm({ email: 'grace@example.com' });

      await component.onUpdate();

      expect(toast.showErrorKey).toHaveBeenCalledOnce();
      expect(toast.showErrorKey).toHaveBeenCalledWith('entity.applicationReferences.toast.updateFailed');
      expect(component.references()).toEqual([expect.objectContaining({ referenceRequestId: 'to-edit', email: 'ada@example.com' })]);
      expect(component.editingId()).toBe('to-edit');
    });

    it('should reset the form to add mode on cancel', () => {
      component.onEdit(existing);

      component.onCancelEdit();

      expect(component.editingId()).toBeUndefined();
      expect(component.addForm.controls.firstName.value).toBe('');
    });

    it('should add rather than update when not editing', async () => {
      fillForm({ email: 'new@example.com' });

      await component.onSubmit();

      expect(referenceApi.add).toHaveBeenCalledOnce();
      expect(referenceApi.update).not.toHaveBeenCalled();
    });
  });

  describe('confidentiality waiver', () => {
    it('should mirror the loaded waiver value onto the checkbox control', async () => {
      await setupFixture([createMockReferenceRequestDTO({ referenceRequestId: 'a' })], 2, false);

      expect(component.confidentialControl.value).toBe(false);
    });

    it('should emit the waiver when toggled', async () => {
      await setupFixture([createMockReferenceRequestDTO({ referenceRequestId: 'a' })]);
      const emitSpy = vi.spyOn(component.referenceLettersConfidentialChanged, 'emit');
      const changedSpy = vi.spyOn(component.changed, 'emit');

      component.onConfidentialChange(false);

      expect(emitSpy).toHaveBeenCalledWith(false);
      expect(changedSpy).toHaveBeenCalledWith(true);
    });
  });
});
