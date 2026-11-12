import { Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { map } from 'rxjs';

/**
 * Reads a piece of form state as a signal that updates whenever the control or one of its children changes value,
 * validity, touched or pristine state. Templates of OnPush components read this signal instead of the control, so they
 * also refresh when code changes the form, for example after loading data.
 *
 * Must be called in an Angular injection context (e.g. a class field).
 *
 * @param control the form control, group or array to watch
 * @param read reads the state from the control
 * @returns a signal holding the latest value of `read`
 */
export function formSignal<C extends AbstractControl, T>(control: C, read: (control: C) => T): Signal<T> {
  return toSignal(control.events.pipe(map(() => read(control))), { initialValue: read(control) });
}
