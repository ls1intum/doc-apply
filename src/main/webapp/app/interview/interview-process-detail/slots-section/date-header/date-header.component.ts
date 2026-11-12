import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { getLocale } from 'app/shared/util/date-time.util';

@Component({
  selector: 'jhi-date-header',
  standalone: true,
  imports: [],
  templateUrl: './date-header.component.html',
})
export class DateHeaderComponent {
  date = input.required<Date>();
  slotCount = input.required<number>();

  private readonly translateService = inject(TranslateService);

  private readonly currentLangEvent = toSignal(this.translateService.onLangChange);

  private locale = computed(() => {
    this.currentLangEvent();
    return getLocale(this.translateService);
  });

  weekday = (): string => {
    return this.date().toLocaleDateString(this.locale(), { weekday: 'short' }).toUpperCase();
  };

  day = (): string => {
    return this.date().toLocaleDateString(this.locale(), { day: '2-digit' });
  };

  /**
   * Returns properly pluralized slot count text
   */
  slotsText = (): string => {
    const count = this.slotCount();
    const key = count === 1 ? 'interview.slots.slotsCountSingular' : 'interview.slots.slotsCountPlural';
    return `${count} ${this.translateService.instant(key)}`;
  };
}
