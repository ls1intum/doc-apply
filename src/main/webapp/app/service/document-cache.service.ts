import { Injectable, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export interface CachedDoc {
  safeUrl: SafeResourceUrl;
  rawUrl: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentCacheService {
  private cache = new Map<string, CachedDoc>();
  private maxSize = 20;

  private readonly sanitizer = inject(DomSanitizer);

  get(documentId: string): SafeResourceUrl | undefined {
    const entry = this.cache.get(documentId);
    if (entry) {
      // refresh LRU order
      this.cache.delete(documentId);
      this.cache.set(documentId, entry);
      return entry.safeUrl;
    }
    return undefined;
  }

  set(documentId: string, blob: Blob): SafeResourceUrl {
    const rawUrl = URL.createObjectURL(blob);
    const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(rawUrl + '#toolbar=0&navpanes=0');

    const existing = this.cache.get(documentId);
    if (existing !== undefined) {
      this.revoke(existing);
      this.cache.delete(documentId);
    }

    this.cache.set(documentId, { safeUrl, rawUrl });

    // enforce size limit
    if (this.cache.size > this.maxSize) {
      const oldestKey = this.cache.keys().next().value;

      if (oldestKey !== undefined) {
        const oldest = this.cache.get(oldestKey);
        if (oldest) {
          this.revoke(oldest);
        }
        this.cache.delete(oldestKey);
      }
    }

    return safeUrl;
  }

  clear(): void {
    for (const entry of this.cache.values()) {
      this.revoke(entry);
    }
    this.cache.clear();
  }

  private revoke(entry: CachedDoc): void {
    try {
      URL.revokeObjectURL(entry.rawUrl);
    } catch (err) {
      console.warn('Failed to revoke object URL:', entry.rawUrl, err);
    }
  }
}
