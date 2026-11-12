import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import { formSignal } from 'app/shared/util/form-signal.util';

describe('formSignal', () => {
  function createForm(): FormGroup<{ name: FormControl<string> }> {
    return new FormGroup({ name: new FormControl('', { nonNullable: true, validators: [Validators.required] }) });
  }

  function watch<T>(form: FormGroup<{ name: FormControl<string> }>, read: (form: FormGroup<{ name: FormControl<string> }>) => T) {
    return runInInjectionContext(TestBed.inject(Injector), () => formSignal(form, read));
  }

  it('should follow validity when code patches the form', () => {
    const form = createForm();
    const invalid = watch(form, value => value.invalid);

    form.patchValue({ name: 'Ada' });

    expect(invalid()).toBe(false);
  });

  it('should follow the touched state of a child control', () => {
    const form = createForm();
    const nameTouched = watch(form, value => value.controls.name.touched);

    form.controls.name.markAsTouched();

    expect(nameTouched()).toBe(true);
  });

  it('should become pristine again when the form is reset', () => {
    const form = createForm();
    const pristine = watch(form, value => value.pristine);
    form.markAsDirty();

    form.reset();

    expect(pristine()).toBe(true);
  });
});
