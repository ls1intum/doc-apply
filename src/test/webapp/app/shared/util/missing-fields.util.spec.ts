import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { beforeEach, describe, expect, it } from 'vitest';

import { describeMissingFields, findMissingFields } from 'app/shared/util/missing-fields.util';
import { ReactiveTranslator, injectTranslator } from 'app/shared/util/translate-signal.util';
import { provideTranslateMock } from 'util/translate.mock';

describe('missing-fields.util', () => {
  let translator: ReactiveTranslator;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTranslateMock()] });
    translator = TestBed.runInInjectionContext(() => injectTranslator());
  });

  it('should list the labels of invalid controls in the order of the label map and skip valid and disabled ones', () => {
    const form = new FormGroup({
      name: new FormControl('', Validators.required),
      email: new FormControl('not-an-email', Validators.email),
      city: new FormControl('Munich', Validators.required),
      title: new FormControl({ value: '', disabled: true }, Validators.required),
    });

    const missing = findMissingFields(form, {
      email: 'form.email',
      title: 'form.title',
      city: 'form.city',
      name: 'form.name',
    });

    expect(missing).toEqual(['form.email', 'form.name']);
  });

  it.each([
    {
      labels: ['form.name'],
      expected: { key: 'global.input.missingFields', params: { fields: 'form.name', count: 1 } },
    },
    {
      labels: ['form.a', 'form.b', 'form.c'],
      expected: { key: 'global.input.missingFields', params: { fields: 'form.a, form.b, form.c', count: 3 } },
    },
    {
      labels: ['form.a', 'form.b', 'form.c', 'form.d', 'form.e'],
      expected: { key: 'global.input.missingFieldsAndMore', params: { fields: 'form.a, form.b, form.c', count: 2 } },
    },
    {
      labels: [],
      expected: { key: 'global.input.completeRequiredFields', params: {} },
    },
  ])('should describe $labels.length missing fields with $expected.key', ({ labels, expected }) => {
    expect(describeMissingFields(labels, translator)).toEqual(expected);
  });
});
