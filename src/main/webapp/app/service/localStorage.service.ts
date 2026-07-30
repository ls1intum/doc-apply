import { hasText } from 'app/shared/util/text.util';
import { Injectable, signal } from '@angular/core';
import { ApplicationCreationPage1Data } from 'app/application/application-creation/application-creation-page1/application-creation-page1.component';

export interface ApplicationDraftData {
  personalInfoData: ApplicationCreationPage1Data;
  applicationId: string;
  jobId: string;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class LocalStorageService {
  readonly APPLICATION_DRAFT_VALIDITY_DURATION_IN_DAYS = 30;
  readonly SIDEBAR_STATE_KEY = 'sidebarCollapsed';
  readonly sidebarCollapsed = signal(localStorage.getItem(this.SIDEBAR_STATE_KEY) === 'true');

  // =======================================================
  // STORING APPLICATION DRAFT DATA
  // =======================================================

  saveApplicationDraft(data: ApplicationDraftData): void {
    const key = this.getApplicationKey(data.applicationId, data.jobId);
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save to local storage:', error);
      throw new Error('Failed to save application data locally.');
    }
  }

  loadApplicationDraft(applicationId?: string, jobId?: string): ApplicationDraftData | null {
    const key = this.getApplicationKey(applicationId, jobId);
    const savedData = localStorage.getItem(key);
    if (savedData === null || savedData === '') return null;

    const parsed = JSON.parse(savedData) as ApplicationDraftData;

    // Check if draft is expired (older than 30 days)
    const now = new Date();
    const saved = new Date(parsed.timestamp);
    const daysDiff = (now.getTime() - saved.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > this.APPLICATION_DRAFT_VALIDITY_DURATION_IN_DAYS) {
      this.clearApplicationDraft(applicationId, jobId);
      return null;
    }

    return parsed;
  }

  clearApplicationDraft(applicationId?: string, jobId?: string): void {
    const key = this.getApplicationKey(applicationId, jobId);
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear local storage:', error);
    }
  }
  // =======================================================
  // SIDEBAR STATE MANAGEMENT
  // =======================================================

  toggle(): void {
    this.sidebarCollapsed.set(!this.sidebarCollapsed());
    localStorage.setItem(this.SIDEBAR_STATE_KEY, String(this.sidebarCollapsed()));
  }

  // =======================================================
  // PAGE SIZE PREFERENCE
  // =======================================================

  /**
   * Returns the user's stored page-size preference for a given key.
   *
   * @param key storage key identifying the paginated view
   * @param fallback value returned when nothing is stored or the value cannot be parsed
   * @param allowed optional whitelist; values outside it are treated as missing
   * @returns the stored page size if valid, otherwise the fallback
   */
  loadPageSize(key: string, fallback: number, allowed?: readonly number[]): number {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    if (allowed && !allowed.includes(parsed)) return fallback;
    return parsed;
  }

  /**
   * Persists a page-size preference under the given key so it survives navigation and reloads.
   *
   * @param key storage key identifying the paginated view
   * @param pageSize the page size to remember
   */
  savePageSize(key: string, pageSize: number): void {
    localStorage.setItem(key, String(pageSize));
  }

  private getApplicationKey(applicationId?: string, jobId?: string): string {
    if (hasText(applicationId)) return `application_draft_${applicationId}`;
    if (hasText(jobId)) return `application_draft_job_${jobId}`;
    throw new Error('Either applicationId or jobId is required.');
  }
}
