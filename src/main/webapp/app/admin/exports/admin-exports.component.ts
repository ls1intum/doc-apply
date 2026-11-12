import { Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { TranslateDirective } from 'app/shared/language';
import { ToastService } from 'app/service/toast-service';
import { AdminExportResourceApi } from 'app/generated/api/admin-export-resource-api';
import { AdminExportTaskDTO, AdminExportTaskDTOStatusEnum } from 'app/generated/model/admin-export-task-dto';

/**
 * Mirrors {@code de.tum.cit.aet.core.constants.AdminExportType} on the
 * server. Derived from the generated API method signature so it stays in
 * sync automatically when the backend enum changes and openapi is
 * regenerated.
 */
type AdminExportType = Parameters<AdminExportResourceApi['startExport']>[0];

interface ExportButton {
  type: AdminExportType;
  labelKey: string;
  descriptionKey: string;
  icon: string;
}

interface ExportSection {
  titleKey: string;
  buttons: ExportButton[];
}

/**
 * How often we poll the status endpoint while a task is in progress.
 * Large exports take many minutes; a slow cadence keeps the server load
 * low while still refreshing the in-card counters often enough that the
 * admin sees progress. The live download progress bar inside the card
 * is driven by chunk-level updates, not by polling, so a longer poll
 * interval does not make the UI feel frozen.
 */
const POLL_INTERVAL_MS = 45000;

/**
 * Size of each byte-range chunk the browser requests when downloading a
 * finished export. Using many small chunks instead of one long-lived request
 * sidesteps nginx's {@code proxy_max_temp_file_size} (defaults to 1 GB) and
 * any proxy read timeouts. 64 MB gives good throughput on fast connections
 * while still keeping per-chunk latency low on slow ones, and for a ~1.5 GB
 * file that is still ~24 chunks — enough to keep the live progress UI
 * refreshing at a useful cadence.
 */
const DOWNLOAD_CHUNK_SIZE = 64 * 1024 * 1024;

/**
 * Delays (in ms) between chunk download attempts. The first attempt fires
 * immediately; subsequent attempts wait for the corresponding entry. The
 * array length minus one is therefore the retry count. Short retries
 * absorb transient failures (network blip, proxy hiccup, token-refresh
 * race) without making the user re-click the Download button.
 */
const CHUNK_RETRY_BACKOFF_MS = [0, 1000, 3000, 7000];

/** sessionStorage key under which we persist the live task map across page refreshes. */
const STORAGE_KEY = 'docapply.adminExports.tasks';

interface DownloadProgress {
  /** Bytes received so far from the server. */
  loaded: number;
  /** Total bytes expected, or {@code undefined} if the server did not set {@code Content-Length}. */
  total: number | undefined;
}

/**
 * Admin "Bulk Exports" page. Each button POSTs to start a background task and
 * then polls the status endpoint until the task is READY, at which point the
 * file is downloaded with a regular browser dialog. Build progress is shown
 * live (research groups / jobs / applications / documents counters) so the
 * user can see something is happening during the multi-minute build.
 *
 * <p>Only one export can run at a time per admin user. The backend enforces
 * this with a {@code 409 Conflict} response; the frontend also visually
 * disables every button while any task is in progress so the admin can't
 * accidentally start a second build from another tab.
 *
 * <p>Task ids are persisted in {@code sessionStorage} and hydrated on init
 * via {@code GET /mine}, so a page refresh (or tab crash) does not strand
 * the admin — polling resumes automatically and the download still triggers
 * once the task completes.
 */
@Component({
  selector: 'jhi-admin-exports',
  standalone: true,
  imports: [CommonModule, TranslateDirective, ButtonComponent],
  templateUrl: './admin-exports.component.html',
})
export class AdminExportsComponent {
  /** Live task per export type — drives both the busy flag and the progress UI. */
  readonly tasks = signal<Map<AdminExportType, AdminExportTaskDTO>>(new Map());

  /**
   * Live download progress per export type. Present only while the browser
   * is actively streaming a READY task's ZIP file. Drives the in-card
   * "Downloading X% (Y MB / Z MB)" label and the loading state of the
   * manual Download button.
   */
  readonly downloadProgress = signal<Map<AdminExportType, DownloadProgress>>(new Map());

  /** True while *any* task is IN_PROGRESS — used to grey out all buttons at once. */
  readonly anyBusy = computed<boolean>(() => {
    for (const task of this.tasks().values()) {
      if (task.status === AdminExportTaskDTOStatusEnum.InProgress) {
        return true;
      }
    }
    return false;
  });

  /** Static section/button definitions rendered by the template. */
  readonly sections: ExportSection[] = [
    {
      titleKey: 'adminExports.sections.jobs',
      buttons: [
        {
          type: 'JOBS_OPEN',
          labelKey: 'adminExports.buttons.jobsOpen.label',
          descriptionKey: 'adminExports.buttons.jobsOpen.description',
          icon: 'database',
        },
        {
          type: 'JOBS_EXPIRED',
          labelKey: 'adminExports.buttons.jobsExpired.label',
          descriptionKey: 'adminExports.buttons.jobsExpired.description',
          icon: 'database',
        },
        {
          type: 'JOBS_CLOSED',
          labelKey: 'adminExports.buttons.jobsClosed.label',
          descriptionKey: 'adminExports.buttons.jobsClosed.description',
          icon: 'database',
        },
        {
          type: 'JOBS_DRAFT',
          labelKey: 'adminExports.buttons.jobsDraft.label',
          descriptionKey: 'adminExports.buttons.jobsDraft.description',
          icon: 'database',
        },
      ],
    },
    {
      titleKey: 'adminExports.sections.full',
      buttons: [
        {
          type: 'FULL_ADMIN',
          labelKey: 'adminExports.buttons.full.label',
          descriptionKey: 'adminExports.buttons.full.description',
          icon: 'database',
        },
      ],
    },
    {
      titleKey: 'adminExports.sections.usersAndOrgs',
      buttons: [
        {
          type: 'USERS_AND_ORGS',
          labelKey: 'adminExports.buttons.usersAndOrgs.label',
          descriptionKey: 'adminExports.buttons.usersAndOrgs.description',
          icon: 'database',
        },
      ],
    },
    {
      titleKey: 'adminExports.sections.applicationsOnly',
      buttons: [
        {
          type: 'APPLICATIONS_ONLY',
          labelKey: 'adminExports.buttons.applicationsOnly.label',
          descriptionKey: 'adminExports.buttons.applicationsOnly.description',
          icon: 'database',
        },
      ],
    },
  ];

  /**
   * Sections that render as a single full-width grid (currently only the
   * Jobs section, which has multiple buttons).
   */
  readonly multiButtonSections = computed<ExportSection[]>(() => this.sections.filter(section => section.buttons.length > 1));

  /**
   * Sections that own a single button. They are rendered side-by-side as
   * cards in one row instead of stacking on top of each other.
   */
  readonly singleButtonSections = computed<ExportSection[]>(() => this.sections.filter(section => section.buttons.length === 1));

  private readonly api = inject(AdminExportResourceApi);
  private readonly http = inject(HttpClient);
  private readonly toastService = inject(ToastService);
  private readonly pollHandles = new Map<AdminExportType, ReturnType<typeof setTimeout>>();
  /**
   * Monotonically increasing generation counter per export type. Every call
   * to {@link downloadReadyTask} bumps the counter and captures the new
   * value; the chunk loop then checks between chunks whether the map still
   * holds its generation. If it doesn't — because a retry superseded it or
   * because teardown cleared the map — the loop bails out silently.
   * Using a generation counter (instead of a mutable {@code canceled} flag)
   * keeps TypeScript's control-flow narrowing happy across {@code await}
   * boundaries.
   */
  private readonly downloadGeneration = new Map<AdminExportType, number>();

  constructor() {
    // afterNextRender is browser-only (safe for sessionStorage) and runs
    // once after the first render — the modern replacement for ngOnInit
    // when the init work is browser-side only.
    afterNextRender(() => void this.hydrate());

    // DestroyRef replaces ngOnDestroy: register a teardown callback that
    // cancels every outstanding poll timeout and clears the download
    // generation map so any in-flight chunk loops bail out at their next
    // check instead of holding on to a growing blob chain.
    inject(DestroyRef).onDestroy(() => {
      for (const handle of this.pollHandles.values()) {
        clearTimeout(handle);
      }
      this.pollHandles.clear();
      this.downloadGeneration.clear();
    });
  }

  /** True while the given type specifically is building (spinner on its button). */
  isBusy(type: AdminExportType): boolean {
    return this.tasks().get(type)?.status === AdminExportTaskDTOStatusEnum.InProgress;
  }

  /** Returns the live task for the given type, or undefined when there is none. */
  taskFor(type: AdminExportType): AdminExportTaskDTO | undefined {
    return this.tasks().get(type);
  }

  /** True while the browser is actively downloading a ready ZIP for this type. */
  isDownloading(type: AdminExportType): boolean {
    return this.downloadProgress().has(type);
  }

  /**
   * Aggregate build progress across every counter the server reports for
   * the given task (schools / departments / research groups / jobs /
   * applications / documents / users / role assignments / applicants /
   * subscriptions). Returns a number between 0 and 100, or {@code undefined}
   * when the server has not yet reported any expected counts (e.g. the
   * task just started). Drives the in-card progress bar so the admin
   * sees concrete movement during the multi-minute build.
   */
  buildProgressPercent(task: AdminExportTaskDTO | undefined): number | undefined {
    if (task === undefined) return undefined;
    let exported = 0;
    let expected = 0;
    for (const counter of [
      task.schools,
      task.departments,
      task.researchGroups,
      task.jobs,
      task.applications,
      task.documents,
      task.users,
      task.userResearchGroupRoles,
      task.applicants,
      task.applicantSubjectAreaSubscriptions,
    ]) {
      if (counter?.expected !== undefined && counter.expected > 0) {
        expected += counter.expected;
        exported += counter.exported ?? 0;
      }
    }
    if (expected === 0) return undefined;
    return Math.min(100, Math.floor((exported / expected) * 100));
  }

  /**
   * Returns a human-friendly progress label for an in-flight download, e.g.
   * {@code "42% (12.3 MB / 29.1 MB)"}. Falls back to a byte-count-only label
   * when the server did not set a {@code Content-Length} header, and returns
   * an empty string when the given type has no active download.
   */
  downloadProgressLabel(type: AdminExportType): string {
    const progress = this.downloadProgress().get(type);
    if (progress === undefined) return '';
    if (progress.total === undefined || progress.total === 0) {
      return this.formatBytes(progress.loaded);
    }
    const percent = Math.floor((progress.loaded / progress.total) * 100);
    return `${percent}% (${this.formatBytes(progress.loaded)} / ${this.formatBytes(progress.total)})`;
  }

  /**
   * Re-triggers the download for a task that is already in the {@code READY}
   * state. Used both for the "Download" button on every ready task and for
   * recovery after an interrupted download — the server-side task remains
   * available until its TTL expires, so the client can re-request the file
   * any number of times.
   */
  retryDownload(type: AdminExportType): void {
    const task = this.tasks().get(type);
    if (task?.status !== AdminExportTaskDTOStatusEnum.Ready) return;
    if (this.isDownloading(type)) return;
    void this.downloadReadyTask(type, task);
  }

  /**
   * Starts a new export of the given type. The button stays in a loading
   * state while we poll the status endpoint; once the task is READY the file
   * is automatically downloaded.
   */
  async start(type: AdminExportType): Promise<void> {
    if (this.anyBusy()) return;
    try {
      const task = await firstValueFrom(this.api.startExport(type));
      this.upsertTask(type, task);
      this.persistTask(type, task);
      this.toastService.showSuccessKey('adminExports.toast.queued');
      this.scheduleNextPoll(type);
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 409) {
        // Server says an export is already running for this admin — adopt
        // it into the local state so the user can watch its progress
        // instead of being stuck with a silent failure.
        const existing = err.error as AdminExportTaskDTO | undefined;
        if (existing?.type !== undefined) {
          this.upsertTask(existing.type, existing);
          this.persistTask(existing.type, existing);
          if (existing.status === AdminExportTaskDTOStatusEnum.InProgress) {
            this.scheduleNextPoll(existing.type);
          }
        }
        this.toastService.showErrorKey('adminExports.toast.alreadyRunning');
        return;
      }
      this.toastService.showErrorKey('adminExports.toast.startError');
    }
  }

  /**
   * Hydrates the component's state after page load. Runs inside
   * {@link afterNextRender} so it is safe to touch {@code sessionStorage}.
   *
   * <p>Two sources, in priority order:
   * <ol>
   *   <li>{@code GET /mine} — server-side truth, catches tasks that are
   *       still running even if sessionStorage was wiped.</li>
   *   <li>{@code sessionStorage} fallback — covers the case where the
   *       server already expired the task but the client still remembers
   *       its id; we ask /status/{id} once and either resume polling or
   *       forget the entry.</li>
   * </ol>
   */
  private async hydrate(): Promise<void> {
    try {
      const mine = await firstValueFrom(this.api.listMine());
      for (const task of mine) {
        if (task.type !== undefined) {
          this.upsertTask(task.type, task);
          if (task.status === AdminExportTaskDTOStatusEnum.InProgress) {
            this.scheduleNextPoll(task.type);
          }
        }
      }
    } catch {
      // non-fatal — fall through to sessionStorage and let the user re-trigger if needed
    }

    const persisted = this.loadFromStorage();
    for (const [key, taskId] of persisted) {
      if (this.tasks().has(key)) {
        // already hydrated from /mine
        continue;
      }
      try {
        const task = await firstValueFrom(this.api.getStatus(taskId));
        this.upsertTask(key, task);
        if (task.status === AdminExportTaskDTOStatusEnum.InProgress) {
          this.scheduleNextPoll(key);
        }
      } catch {
        // 404 or network error → forget it
        this.clearStoredTask(key);
      }
    }
  }

  private scheduleNextPoll(type: AdminExportType): void {
    // If a poll is already scheduled for this type, cancel it first so we
    // don't fan out (hydrate + manual start could otherwise race).
    const existing = this.pollHandles.get(type);
    if (existing !== undefined) {
      clearTimeout(existing);
    }
    const handle = setTimeout(() => void this.poll(type), POLL_INTERVAL_MS);
    this.pollHandles.set(type, handle);
  }

  private async poll(type: AdminExportType): Promise<void> {
    const current = this.tasks().get(type);
    if (current?.taskId === undefined) return;
    try {
      const updated = await firstValueFrom(this.api.getStatus(current.taskId));
      this.upsertTask(type, updated);
      if (updated.status === AdminExportTaskDTOStatusEnum.InProgress) {
        this.scheduleNextPoll(type);
        return;
      }
      if (updated.status === AdminExportTaskDTOStatusEnum.Ready) {
        void this.downloadReadyTask(type, updated);
      } else {
        this.toastService.showErrorKey('adminExports.toast.buildFailed');
        this.clearStoredTask(type);
      }
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 404) {
        // Task expired on the server — drop it so the UI stops showing it.
        this.forgetTask(type);
        return;
      }
      this.toastService.showErrorKey('adminExports.toast.pollError');
    }
  }

  /**
   * Streams a READY task's ZIP to the browser in {@link DOWNLOAD_CHUNK_SIZE}
   * byte chunks using HTTP {@code Range} requests, reporting progress after
   * every chunk.
   *
   * <p>A single long-lived download is fragile for GB-scale exports:
   * <ul>
   *   <li>nginx's {@code proxy_max_temp_file_size} defaults to 1 GB, which
   *       the full admin export exceeds; anything above that cap terminates
   *       the response.</li>
   *   <li>Any proxy or server read timeout can kill the response mid-flight.</li>
   *   <li>The browser has to hold the full {@code Blob} in memory at once.</li>
   * </ul>
   * Chunking avoids all three: each chunk is a fresh HTTP request that
   * finishes in seconds, so no single response is ever long-lived enough or
   * large enough to hit those limits. The chunks are accumulated in an
   * array and combined into a single {@code Blob} only once, at the end,
   * right before handing it to the browser.
   *
   * <p>The task itself is intentionally <em>not</em> removed from the signal
   * on either success or failure: on success the user may want to re-download
   * (e.g. they lost the file) and on failure they need to retry. The
   * sessionStorage entry is cleared on success so a page refresh starts
   * clean, but the in-memory task stays so the Download button keeps working
   * until the server's TTL expires the task.
   */
  private async downloadReadyTask(type: AdminExportType, task: AdminExportTaskDTO): Promise<void> {
    if (task.taskId === undefined) return;
    // Bump the generation counter for this type. Any previously running
    // download loop for the same type sees its generation mismatch on the
    // next check and bails silently.
    const generation = (this.downloadGeneration.get(type) ?? 0) + 1;
    this.downloadGeneration.set(type, generation);

    const taskId = task.taskId;
    const url = `/api/admin/exports/download/${encodeURIComponent(taskId)}`;

    this.setDownloadProgress(type, 0, undefined);

    const chunks: Blob[] = [];
    let nextOffset = 0;
    let total: number | undefined = undefined;
    let filename: string | undefined = undefined;

    try {
      while (total === undefined || nextOffset < total) {
        if (this.downloadGeneration.get(type) !== generation) return;
        const chunkEndExclusive =
          total === undefined ? nextOffset + DOWNLOAD_CHUNK_SIZE : Math.min(nextOffset + DOWNLOAD_CHUNK_SIZE, total);
        // HTTP Range header end is inclusive, so we subtract 1.
        const rangeHeader = `bytes=${nextOffset}-${chunkEndExclusive - 1}`;
        const response = await this.fetchChunkWithRetry(url, rangeHeader, type, generation);
        if (this.downloadGeneration.get(type) !== generation) return;
        const chunk = response.body ?? undefined;
        if (chunk === undefined) {
          throw new Error('Empty chunk body');
        }
        chunks.push(chunk);
        nextOffset += chunk.size;

        if (total === undefined) {
          // First chunk — parse the total size from Content-Range
          // ("bytes start-end/total") so we know how many more chunks to
          // request. Fall back to Content-Length when the server did not
          // return a 206 (treating the response as the whole file).
          total =
            this.parseTotalFromContentRange(response.headers.get('Content-Range') ?? undefined) ??
            this.parseContentLength(response.headers.get('Content-Length') ?? undefined);
          filename = this.parseFilename(response.headers.get('Content-Disposition') ?? undefined);
        }
        this.setDownloadProgress(type, nextOffset, total);

        // Defensive: if the server did not return a 206 (e.g. Range was
        // mis-handled) we've just downloaded the full file in one shot.
        // Bail out of the loop instead of requesting a second chunk that
        // would overlap the first.
        if (response.status !== 206) {
          break;
        }
      }

      if (this.downloadGeneration.get(type) !== generation) return;

      const finalBlob = new Blob(chunks, { type: 'application/zip' });
      const effectiveFilename = filename ?? `admin-export-${type.toLowerCase()}.zip`;
      this.triggerBrowserDownload(finalBlob, effectiveFilename);
      this.toastService.showSuccessKey('adminExports.toast.downloaded');
      // Drop the sessionStorage entry so a refresh starts clean, but
      // keep the signal task around so the Download button remains
      // usable until the server TTL expires the task.
      this.clearStoredTask(type);
      this.clearDownloadProgress(type);
    } catch {
      if (this.downloadGeneration.get(type) === generation) {
        // Network blip, tab closed mid-transfer, proxy disconnect, etc.
        // The server-side task is still READY, so leave the Download
        // button in place for the user to retry. A mismatched generation
        // means the loop was superseded (retry) or torn down, in which
        // case stay silent.
        this.toastService.showErrorKey('adminExports.toast.downloadError');
        this.clearDownloadProgress(type);
      }
    } finally {
      if (this.downloadGeneration.get(type) === generation) {
        this.downloadGeneration.delete(type);
      }
    }
  }

  /**
   * Fetches a single byte-range chunk with a small retry budget. Absorbs
   * transient failures (network blip, proxy hiccup, token-refresh race)
   * that would otherwise tear down the whole multi-GB download after a
   * single bad chunk. Checks the download generation between attempts so
   * a retry doesn't fire after the user superseded or canceled the
   * download.
   *
   * <p>Rethrows the last seen error if every attempt failed. The outer
   * catch in {@link downloadReadyTask} then checks the generation — if
   * the loop was canceled it stays silent, otherwise it surfaces the
   * {@code downloadError} toast.
   */
  private async fetchChunkWithRetry(
    url: string,
    rangeHeader: string,
    type: AdminExportType,
    generation: number,
  ): Promise<HttpResponse<Blob>> {
    let lastError: unknown = new Error('Chunk download failed');
    for (const waitMs of CHUNK_RETRY_BACKOFF_MS) {
      if (waitMs > 0) {
        await new Promise<void>(resolve => setTimeout(resolve, waitMs));
      }
      if (this.downloadGeneration.get(type) !== generation) {
        throw new Error('Download canceled');
      }
      try {
        const headers = new HttpHeaders({ Range: rangeHeader });
        return await firstValueFrom(this.http.get(url, { headers, responseType: 'blob', observe: 'response' }));
      } catch (err) {
        lastError = err;
        // If the loop was canceled during the request, abort immediately
        // instead of sleeping for the next backoff.
        if (this.downloadGeneration.get(type) !== generation) {
          throw err;
        }
      }
    }
    throw lastError;
  }

  /**
   * Parses the total file size out of an HTTP {@code Content-Range} header
   * value like {@code "bytes 0-32767/102400"}. Returns {@code undefined} for
   * malformed or missing headers, or when the server sent an unknown
   * total (indicated by {@code *}).
   */
  private parseTotalFromContentRange(header: string | undefined): number | undefined {
    if (header === undefined) return undefined;
    const match = /\/(\d+)$/.exec(header) ?? undefined;
    if (match === undefined) return undefined;
    const parsed = parseInt(match[1], 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  /** Parses a numeric {@code Content-Length} header, or {@code undefined} when absent/malformed. */
  private parseContentLength(header: string | undefined): number | undefined {
    if (header === undefined) return undefined;
    const parsed = parseInt(header, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private setDownloadProgress(type: AdminExportType, loaded: number, total: number | undefined): void {
    this.downloadProgress.update(prev => {
      const next = new Map(prev);
      next.set(type, { loaded, total });
      return next;
    });
  }

  private clearDownloadProgress(type: AdminExportType): void {
    this.downloadProgress.update(prev => {
      if (!prev.has(type)) return prev;
      const next = new Map(prev);
      next.delete(type);
      return next;
    });
  }

  /** Immutable-update helper: adds or replaces a task in the signal's backing map. */
  private upsertTask(type: AdminExportType, task: AdminExportTaskDTO): void {
    this.tasks.update(prev => {
      const next = new Map(prev);
      next.set(type, task);
      return next;
    });
  }

  /**
   * Drops a task from both the live signal and the persisted sessionStorage
   * map. Used when a task 404s on the server (already expired) or after a
   * successful download.
   */
  private forgetTask(type: AdminExportType): void {
    this.tasks.update(prev => {
      const next = new Map(prev);
      next.delete(type);
      return next;
    });
    this.clearStoredTask(type);
  }

  // ---------------- sessionStorage helpers ----------------

  private persistTask(type: AdminExportType, task: AdminExportTaskDTO): void {
    if (task.taskId === undefined) return;
    const current = this.loadFromStorage();
    current.set(type, task.taskId);
    this.saveToStorage(current);
  }

  private clearStoredTask(type: AdminExportType): void {
    const current = this.loadFromStorage();
    if (!current.has(type)) return;
    current.delete(type);
    this.saveToStorage(current);
  }

  private loadFromStorage(): Map<AdminExportType, string> {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY) ?? undefined;
      if (raw === undefined) return new Map();
      const parsed = JSON.parse(raw) as Partial<Record<AdminExportType, string>>;
      const result = new Map<AdminExportType, string>();
      for (const key of Object.keys(parsed) as AdminExportType[]) {
        const value = parsed[key];
        if (value !== undefined) {
          result.set(key, value);
        }
      }
      return result;
    } catch {
      return new Map();
    }
  }

  private saveToStorage(map: Map<AdminExportType, string>): void {
    try {
      const serialized: Partial<Record<AdminExportType, string>> = {};
      for (const [key, value] of map) {
        serialized[key] = value;
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    } catch {
      // sessionStorage may be unavailable (private mode quota, etc.); the
      // server-side /mine endpoint is still the authoritative fallback.
    }
  }

  // ---------------- misc helpers ----------------

  private parseFilename(contentDisposition: string | undefined): string | undefined {
    if (contentDisposition === undefined) return undefined;
    return /filename="([^"]+)"/.exec(contentDisposition)?.[1];
  }

  private triggerBrowserDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}
