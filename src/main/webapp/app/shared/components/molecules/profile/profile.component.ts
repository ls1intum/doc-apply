import { Component, computed, inject, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { formSignal } from 'app/shared/util/form-signal.util';
import { describeMissingFields, findMissingFields } from 'app/shared/util/missing-fields.util';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

import { StringInputComponent } from '../../atoms/string-input/string-input.component';
import { ButtonComponent } from '../../atoms/button/button.component';
import { AuthOrchestratorService } from '../../../../core/auth/auth-orchestrator.service';

@Component({
  selector: 'jhi-profile',
  imports: [ButtonComponent, ReactiveFormsModule, StringInputComponent],
  templateUrl: './profile.component.html',
})
export class ProfileComponent {
  authOrchestrator = inject(AuthOrchestratorService);

  submitHandler = input<(firstName: string, lastName: string) => void>(() => {});

  loading = computed(() => this.authOrchestrator.isBusy());

  form = new FormGroup({
    firstName: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly formInvalid = formSignal(this.form, form => form.invalid);
  readonly submitDisabledReason = computed(() => describeMissingFields(this.missingFields(), this.translator));

  private readonly translator = injectTranslator();
  private readonly missingFields = formSignal(this.form, form =>
    findMissingFields(form, {
      firstName: 'auth.register.texts.profile.firstName.label',
      lastName: 'auth.register.texts.profile.lastName.label',
    }),
  );

  onSubmit(): void {
    if (this.form.valid && !this.loading()) {
      const { firstName, lastName } = this.form.getRawValue();
      this.submitHandler()(firstName, lastName);
    }
  }
}
