import { Component, computed, inject, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

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

  onSubmit(): void {
    if (this.form.valid && !this.loading()) {
      const { firstName, lastName } = this.form.getRawValue();
      this.submitHandler()(firstName, lastName);
    }
  }
}
