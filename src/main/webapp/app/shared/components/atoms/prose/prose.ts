import { Component, SecurityContext, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'jhi-prose',
  imports: [],
  templateUrl: './prose.html',
})
export class Prose {
  text = input<string | undefined>(undefined);

  safeHtml = computed<string>(() => {
    const raw = this.text();
    if (raw === undefined) {
      return '—';
    }
    return this.sanitizer.sanitize(SecurityContext.HTML, raw) ?? '—';
  });

  private sanitizer = inject(DomSanitizer);
}
