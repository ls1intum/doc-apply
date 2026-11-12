import { Injectable, signal } from '@angular/core';

/**
 * Holds the open/closed state of the mobile sidebar drawer so the header burger and the
 * main layout can drive a single drawer instance from two unrelated component trees.
 */
@Injectable({ providedIn: 'root' })
export class MobileSidebarService {
  readonly open = signal(false);

  toggle(): void {
    this.open.update(value => !value);
  }

  close(): void {
    if (this.open()) {
      this.open.set(false);
    }
  }
}
