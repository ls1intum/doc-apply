import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Pipe({ name: 'timeAgo', standalone: true, pure: false })
export class TimeAgoPipe implements PipeTransform {
  private translate = inject(TranslateService);

  transform(value: string | Date | undefined): string {
    if (value === '' || value === undefined) return '';
    const date = new Date(value);
    const seconds = Math.floor((+new Date() - +date) / 1000);

    if (seconds < 60) {
      return this.translate.instant('time.justNow');
    }

    const intervals: Record<string, number> = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
      second: 1,
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const counter = Math.floor(seconds / secondsInUnit);
      if (counter > 0) {
        return this.translate.instant('time.ago', {
          count: counter,
          unit: this.translate.instant(`time.units.${unit}${counter > 1 ? 'Plural' : ''}`),
        });
      }
    }

    return value.toString();
  }
}
