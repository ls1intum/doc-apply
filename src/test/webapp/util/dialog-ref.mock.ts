import { ComponentRef, EnvironmentInjector, Injector, Provider, Type, createComponent } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ReplaySubject, Subject } from 'rxjs';
import { vi } from 'vitest';
import { DIALOG_DATA, DialogRef } from 'app/shared/dialog/dialog.service';

export type DialogRefMock = {
  close: ReturnType<typeof vi.fn>;
  closed: Subject<unknown>;
};

export type DialogRefMockOptions = {
  closedWith?: unknown;
};

/**
 * Creates a dialog reference whose `closed` stream tests drive with `closed.next(result)`.
 *
 * @param options `closedWith` makes the dialog report that it closed with this result as soon as it is subscribed to
 * @returns the dialog reference mock
 */
export function createDialogRefMock(options: DialogRefMockOptions = {}): DialogRefMock {
  const closed = new ReplaySubject<unknown>(1);
  if ('closedWith' in options) {
    closed.next(options.closedWith);
  }
  return { close: vi.fn(), closed };
}

export function provideDialogRefMock(mock: DialogRefMock = createDialogRefMock()): Provider {
  return { provide: DialogRef, useValue: mock };
}

/** Holds the data a mocked dialog was opened with; tests may replace `data` before the first component is created. */
export type DialogDataMock = {
  data?: unknown;
};

export function createDialogDataMock(data: unknown = {}): DialogDataMock {
  return { data };
}

export function provideDialogDataMock(mock: DialogDataMock = createDialogDataMock()): Provider {
  return { provide: DIALOG_DATA, useFactory: () => mock.data };
}

/**
 * Creates a component as if it were opened in a dialog with the given data, for tests that need different data than
 * the component the test bed already created.
 *
 * @param component the dialog content component
 * @param data the data the dialog is opened with
 * @returns the created component
 */
export function createComponentWithDialogData<C>(component: Type<C>, data: unknown): ComponentRef<C> {
  return createComponent(component, {
    environmentInjector: TestBed.inject(EnvironmentInjector),
    elementInjector: Injector.create({ providers: [{ provide: DIALOG_DATA, useValue: data }] }),
  });
}
