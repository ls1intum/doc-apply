import { hasText } from 'app/shared/util/text.util';
import { AbstractControl, FormControl, TouchedChangeEvent } from '@angular/forms';
import { Directive, Signal, computed, effect, inject, input, output, signal } from '@angular/core';
import { LangChangeEvent, TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';

let nextId = 0;

@Directive()
export abstract class BaseInputDirective<T> {
  model = input<T>();
  modelChange = output<T>();

  control = input<AbstractControl | undefined>(undefined);
  disabled = input<boolean>(false);
  icon = input<string | undefined>(undefined);
  label = input<string | undefined>(undefined);
  placeholder = input<string | undefined>(undefined);
  required = input<boolean>(false);
  width = input<string>('100%');
  id = input<string | undefined>(undefined);
  shouldTranslate = input<boolean>(true); // Whether to translate the label and placeholder
  tooltipText = input<string | undefined>(undefined);
  autofocus = input<boolean>(false);
  errorEnabled = input<boolean>(true);
  complianceError = input<string | undefined>(undefined);
  warningText = input<string | undefined>(undefined);
  helperTextLeft = input<string | undefined>(undefined);
  helperTextLeftParams = input<Record<string, unknown>>({});
  helperTextRight = input<string | undefined>(undefined);
  helperTextRightClick = output();

  readonly formValidityVersion = signal(0);
  isTouched = signal(false);
  isFocused = signal(false);

  formControl = computed(() => {
    const ctrl = this.control();
    return ctrl instanceof FormControl ? ctrl : new FormControl('');
  });

  inputId = computed(() => this.id() ?? `jhi-input-${nextId++}`);

  displayLabel = computed(() => this.maybeTranslate(this.label()));
  displayPlaceholder = computed(() => this.maybeTranslate(this.placeholder()));
  displayTooltipText = computed(() => this.maybeTranslate(this.tooltipText()));
  displayHelperTextLeft = computed(() => this.maybeTranslate(this.helperTextLeft(), this.helperTextLeftParams()));
  displayHelperTextRight = computed(() => this.maybeTranslate(this.helperTextRight()));
  displayWarningText = computed(() => this.maybeTranslate(this.warningText()));

  inputState = computed(() => {
    this.formValidityVersion();
    const compliance = this.complianceError();
    if (hasText(compliance)) return 'invalid';
    if (!this.isTouched()) return 'untouched';
    if (this.formControl().invalid) return 'invalid';
    return 'valid';
  });
  translate = inject(TranslateService);
  langChange: Signal<LangChangeEvent | undefined> = toSignal(this.translate.onLangChange, { initialValue: undefined });
  errorMessage = computed<string | null>(() => {
    this.formValidityVersion();
    this.langChange();

    // compliance error in job creation form title
    const compliance = this.complianceError();
    if (hasText(compliance)) return compliance;
    const ctrl = this.formControl();
    const errors = ctrl.errors;
    if (!errors) return null;
    const key = Object.keys(errors)[0];
    const val = errors[key];
    const defaults: Record<string, string> = {
      required: this.translate.instant('global.input.error.required'),
      minlength: this.translate.instant('global.input.error.minLength', { min: val?.requiredLength }),
      maxlength: this.translate.instant('global.input.error.maxLength', { max: val?.requiredLength }),
      pattern: this.translate.instant('global.input.error.pattern'),
      email: this.translate.instant('global.input.error.email'),
      invalidPostalCode: this.translate.instant('entity.applicationPage1.validation.postalCode'),
      min: this.translate.instant('global.input.error.min', { min: val?.min }),
      max: this.translate.instant('global.input.error.max', { max: val?.max }),
      invalidLimitType: this.translate.instant('global.input.error.invalidLimitType'),
      outOfRange: this.translate.instant('global.input.error.outOfRange'),
    };
    if (Object.prototype.hasOwnProperty.call(defaults, key)) {
      return defaults[key];
    }
    return `Invalid: ${key}`;
  });

  private controlSubscriptionsEffect = effect(onCleanup => {
    const ctrl = this.formControl();
    this.isTouched.set(this.isTouched() || ctrl.touched);
    const statusSub = ctrl.statusChanges.subscribe(() => {
      this.formValidityVersion.update(v => v + 1);
    });
    // Clear local touched flag when the bound control is reset to untouched (e.g. via form.reset / markAsUntouched).
    // Re-syncing on touched=true here would override the autofocus-pristine skip in onBlur, because Angular's
    // FormControlDirective auto-calls markAsTouched on every native blur.
    const eventsSub = ctrl.events.subscribe(event => {
      if (event instanceof TouchedChangeEvent && !event.touched) {
        this.isTouched.set(false);
      }
    });
    onCleanup(() => {
      statusSub.unsubscribe();
      eventsSub.unsubscribe();
    });
  });

  // Sync `disabled` input into the provided control (if there is one).
  private syncDisabledEffect = effect(() => {
    const ctrl = this.control();
    const disabled = this.disabled();
    if (ctrl) {
      try {
        if (disabled) {
          // avoid emitting events when toggling programmatically during setup
          ctrl.disable({ emitEvent: false });
        } else {
          ctrl.enable({ emitEvent: false });
        }
      } catch {}
    }
  });

  onBlur(): void {
    // When autofocus is enabled, skip marking as touched while the control is
    // still pristine. This prevents showing validation errors from the
    // focus→blur cycle triggered by dialog/modal animations before the user
    // has actually interacted with the field.
    if (!(this.autofocus() && this.formControl().pristine)) {
      this.isTouched.set(true);
    }
    this.isFocused.set(false);
  }

  onFocus(): void {
    this.isFocused.set(true);
  }

  protected maybeTranslate(value: string | undefined, params?: Record<string, unknown>): string {
    this.langChange();
    if (!hasText(value)) {
      return '';
    }
    return this.shouldTranslate() ? this.translate.instant(value, params) : value;
  }
}
