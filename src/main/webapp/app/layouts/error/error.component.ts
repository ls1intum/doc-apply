import { hasText } from 'app/shared/util/text.util';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslateDirective } from 'app/shared/language';

@Component({
  selector: 'jhi-error',
  templateUrl: './error.component.html',
  imports: [TranslateDirective],
})
export default class ErrorComponent implements OnInit, OnDestroy {
  errorMessage = signal<string | undefined>(undefined);
  errorKey?: string;
  langChangeSubscription?: Subscription;

  private readonly translateService = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    this.route.data.subscribe(routeData => {
      const errorMessageData = routeData['errorMessage'] as unknown;
      if (typeof errorMessageData === 'string' && errorMessageData !== '') {
        this.errorKey = errorMessageData;
        this.getErrorMessageTranslation();
        this.langChangeSubscription = this.translateService.onLangChange.subscribe(() => this.getErrorMessageTranslation());
      }
    });
  }

  ngOnDestroy(): void {
    if (this.langChangeSubscription) {
      this.langChangeSubscription.unsubscribe();
    }
  }

  private getErrorMessageTranslation(): void {
    this.errorMessage.set('');
    if (hasText(this.errorKey)) {
      this.translateService.get(this.errorKey).subscribe((translatedErrorMessage: unknown) => {
        if (typeof translatedErrorMessage === 'string') {
          this.errorMessage.set(translatedErrorMessage);
        }
      });
    }
  }
}
