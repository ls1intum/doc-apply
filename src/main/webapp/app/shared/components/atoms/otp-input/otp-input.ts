import { Component, ElementRef, Signal, afterNextRender, computed, inject, input, signal, viewChildren } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TumAetUiInputDirective } from '@tumaet/ui-angular';
import { DIALOG_DATA } from 'app/shared/dialog/dialog.service';
import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { AuthOrchestratorService } from 'app/core/auth/auth-orchestrator.service';
import { AuthFacadeService } from 'app/core/auth/auth-facade.service';

import { BaseInputDirective } from '../base-input/base-input.component';
import { ButtonComponent } from '../button/button.component';
import TranslateDirective from '../../../language/translate.directive';

/** Change payload of the OTP field: the combined characters of all slots. */
export interface OtpChangeEvent {
  value: string | undefined;
}

interface OtpSlot {
  index: number;
  character: string;
  label: string;
}

type OtpSize = 'small' | 'large';

const OTP_SLOT_CLASSES: Record<OtpSize | 'normal', string> = {
  small: 'w-9 h-9 text-center',
  normal: 'w-10 h-10 text-center',
  large: 'w-12 h-12 text-center',
};

/**
 * Uppercases a value and removes everything except letters and digits.
 *
 * @param raw the typed or pasted text
 * @returns the normalised OTP characters
 */
function normalizeOtp(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

@Component({
  selector: 'jhi-otp-input',
  standalone: true,
  imports: [ButtonComponent, TranslateDirective, TumAetUiInputDirective],
  templateUrl: './otp-input.html',
})
export class OtpInput extends BaseInputDirective<string | undefined> {
  readonly config = inject(ApplicationConfigService);
  readonly authFacade = inject(AuthFacadeService);
  readonly authOrchestratorService = inject(AuthOrchestratorService);
  readonly breakpointObserver = inject(BreakpointObserver);

  // if the otp is for registration (true) or login (false)
  registration = input<boolean>(false);
  // Number of characters the OTP should have
  length = this.config.otp.length;
  ttlSeconds = this.config.otp.ttlSeconds;
  // Time-to-live for the OTP in minutes
  readonly ttlMinutes: number = Math.max(1, Math.ceil(this.ttlSeconds / 60));
  // Cooldown in seconds for the resend button
  cooldownSeconds = computed(() => this.authOrchestratorService.cooldownSeconds());
  onCooldown = computed(() => this.cooldownSeconds() > 0);
  isBusy: Signal<boolean> = computed(() => this.authOrchestratorService.isBusy());
  showError: Signal<boolean> = computed(() => this.authOrchestratorService.error() !== null);
  // local state of the current OTP value
  readonly otpValue = signal<string>('');
  // disable resend if busy or in cooldown
  readonly disableResend: Signal<boolean> = computed(() => this.isBusy() || this.onCooldown());
  // attempt cooldown after too many failed submissions
  readonly isAttemptCooldown = computed(() => this.authOrchestratorService.isOtpAttemptCooldown());
  readonly attemptCooldownSeconds = computed(() => this.authOrchestratorService.otpAttemptCooldownSeconds());
  // derived states
  readonly disabledSubmit = computed(
    () => this.isAttemptCooldown() || this.showError() || this.isBusy() || this.otpValue().length !== this.length,
  );
  // determine size of the OTP input based on screen size
  readonly otpSize = toSignal<OtpSize | undefined>(
    this.breakpointObserver
      .observe([Breakpoints.XSmall, Breakpoints.Small, Breakpoints.XLarge])
      .pipe(map(r => (r.breakpoints[Breakpoints.XLarge] ? 'large' : r.breakpoints[Breakpoints.XSmall] ? 'small' : undefined))),
    { initialValue: undefined },
  );
  readonly slotClass = computed(() => OTP_SLOT_CLASSES[this.otpSize() ?? 'normal']);
  readonly slots = computed<OtpSlot[]>(() => {
    this.langChange();
    const value = this.otpValue();
    return Array.from({ length: this.length }, (_, index) => ({
      index,
      character: value.charAt(index),
      label: this.translate.instant('auth.common.otp.character', { index: index + 1, total: this.length }),
    }));
  });

  readonly resendLabelKey = computed(() => (this.onCooldown() ? 'auth.common.otp.resendCooldown' : 'auth.common.otp.resend'));
  readonly resendLabelParams = computed<Record<string, unknown>>(() => (this.onCooldown() ? { seconds: this.cooldownSeconds() } : {}));

  private readonly dialogData = inject<{ registration?: boolean } | undefined>(DIALOG_DATA);
  private readonly registrationOverride = signal<boolean | undefined>(undefined);
  private readonly isRegistration = computed(() => {
    const registrationOverride = this.registrationOverride();
    return registrationOverride ?? this.registration();
  });

  private readonly slotInputs = viewChildren<ElementRef<HTMLInputElement>>('otpSlot');

  constructor() {
    super();
    const registration = this.dialogData?.registration;
    if (typeof registration === 'boolean') {
      this.registrationOverride.set(registration);
    }
    afterNextRender(() => this.focusSlot(0));
  }

  public getRegistrationFlag(): boolean {
    return this.isRegistration();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.onSubmit();
      return;
    }

    // Block any non-alphanumeric character keys (allows navigation keys, backspace, etc.)
    if (event.key.length === 1 && !/[a-zA-Z0-9]/.test(event.key)) {
      event.preventDefault();
    }
  }

  onChange(event: OtpChangeEvent): void {
    this.authOrchestratorService.clearError();
    const normalized = normalizeOtp(event.value ?? '').slice(0, this.length);
    this.setValue(normalized);
  }

  /**
   * Writes what was typed into a slot. A single character replaces the slot and moves on to the next one, an
   * emptied slot removes its character, and a longer text at once (browser autofill) fills from this slot on.
   * Typing into a filled slot leaves the old and the new character side by side, so the new one is kept.
   *
   * @param event the input event of the slot
   * @param index the position of the slot
   */
  onSlotInput(event: Event, index: number): void {
    const field = event.target;
    if (!(field instanceof HTMLInputElement)) {
      return;
    }
    const typed = normalizeOtp(field.value);
    const current = this.otpValue();
    const position = Math.min(index, current.length);
    if (typed === '') {
      this.applyValue(current.slice(0, position) + current.slice(position + 1), position);
      return;
    }
    if (typed.length > 2) {
      this.applyValue(current.slice(0, position) + typed, position + typed.length);
      return;
    }
    const previous = current.charAt(position);
    const character = typed.length === 2 && typed.charAt(1) === previous ? typed.charAt(0) : typed.charAt(typed.length - 1);
    this.applyValue(current.slice(0, position) + character + current.slice(position + 1), position + 1);
  }

  /**
   * Handles submit, character filtering and keyboard navigation between the slots. Backspace in an empty slot
   * deletes the character before it, like a single text field would.
   *
   * @param event the keydown event of the slot
   * @param index the position of the slot
   */
  onSlotKeyDown(event: KeyboardEvent, index: number): void {
    this.onKeyDown(event);
    if (event.defaultPrevented) {
      return;
    }
    const current = this.otpValue();
    switch (event.key) {
      case 'Backspace': {
        event.preventDefault();
        const target = index < current.length ? index : index - 1;
        if (target >= 0) {
          this.applyValue(current.slice(0, target) + current.slice(target + 1), target);
        }
        break;
      }
      case 'Delete':
        event.preventDefault();
        this.applyValue(current.slice(0, index) + current.slice(index + 1), index);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.focusSlot(index - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.focusSlot(Math.min(index + 1, current.length));
        break;
      case 'Home':
        event.preventDefault();
        this.focusSlot(0);
        break;
      case 'End':
        event.preventDefault();
        this.focusSlot(current.length);
        break;
    }
  }

  /**
   * Fills the slots from the pasted text, starting at the pasted slot.
   *
   * @param event the clipboard event of the slot
   * @param index the position of the slot
   */
  onSlotPaste(event: ClipboardEvent, index: number): void {
    event.preventDefault();
    const pasted = normalizeOtp(event.clipboardData?.getData('text') ?? '');
    if (pasted === '') {
      return;
    }
    const current = this.otpValue();
    const position = Math.min(index, current.length);
    this.applyValue(current.slice(0, position) + pasted, position + pasted.length);
  }

  /**
   * Selects the character in a focused slot so typing replaces it.
   *
   * @param index the position of the slot
   */
  selectSlot(index: number): void {
    this.slotInputs()[index]?.nativeElement.select();
  }

  onSubmit(): void {
    this.authOrchestratorService.clearError();
    if (!this.disabledSubmit()) {
      const otp = this.otpValue();
      void this.authFacade.verifyOtp(otp, this.isRegistration());
    }
  }

  onResend(): void {
    if (!this.disableResend()) {
      this.authOrchestratorService.clearError();
      this.setValue('');
      void this.authFacade.requestOtp(this.isRegistration(), true);
    }
  }

  /**
   * Stores a new OTP value, writes it back into every slot and moves focus.
   *
   * @param value the combined characters
   * @param focusIndex the slot to focus afterwards
   */
  private applyValue(value: string, focusIndex: number): void {
    this.onChange({ value });
    this.syncSlots();
    this.focusSlot(focusIndex);
  }

  /**
   * Writes the current characters into the slot elements. Needed because a slot can hold stale typed text whose
   * bound character did not change, for example when the same character is typed again.
   */
  private syncSlots(): void {
    const value = this.otpValue();
    this.slotInputs().forEach((slot, index) => {
      slot.nativeElement.value = value.charAt(index);
    });
  }

  /**
   * Focuses a slot, clamped to the existing slots.
   *
   * @param index the position of the slot
   */
  private focusSlot(index: number): void {
    const slots = this.slotInputs();
    const clamped = Math.max(0, Math.min(index, slots.length - 1));
    slots[clamped]?.nativeElement.focus();
  }

  private setValue(value: string): void {
    this.otpValue.set(value);
    this.modelChange.emit(value);
    const ctrl = this.formControl();
    ctrl.setValue(value);
    if (value === '') {
      ctrl.markAsPristine();
    } else {
      ctrl.markAsDirty();
    }
    ctrl.updateValueAndValidity();
  }
}
