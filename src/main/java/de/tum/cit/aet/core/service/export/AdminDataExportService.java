package de.tum.cit.aet.core.service.export;

import de.tum.cit.aet.core.constants.AdminExportType;
import de.tum.cit.aet.core.exception.UserDataExportException;
import de.tum.cit.aet.core.service.export.admin.AdminExportTask;
import de.tum.cit.aet.core.service.export.admin.AdminExportZipWriter;
import de.tum.cit.aet.core.service.export.admin.ExportManifest;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Background admin bulk export service. The HTTP request lifecycle is too short
 * (and too fragile — proxies, browsers, network blips) to keep open for the
 * minutes that a full export takes, so each export runs as a background task:
 *
 * <ol>
 *   <li>The client POSTs to start an export → {@link #startExport} creates an
 *       {@link AdminExportTask}, schedules it on the shared {@link TaskExecutor}
 *       and returns the task id immediately.</li>
 *   <li>The client polls {@link #getTask} for status updates while the build
 *       runs in the background.</li>
 *   <li>Once the task flips to {@code READY}, the client downloads the file via
 *       {@link #getDownloadPath}, which streams the on-disk ZIP back as a fast
 *       network transfer.</li>
 * </ol>
 *
 * <p>Tasks live in memory; the actual ZIPs live on disk under
 * {@code aet.admin-export.storage-dir}. A scheduled cleanup removes any task
 * (and its file) older than {@code aet.admin-export.ttl-hours} so the temp
 * directory cannot grow unbounded.
 */
@Slf4j
@Service
public class AdminDataExportService {

    private final AdminExportZipWriter adminExportZipWriter;
    private final PlatformTransactionManager transactionManager;
    private final TaskExecutor taskExecutor;

    private final Path storageDir;
    private final int ttlHours;

    private final Map<UUID, AdminExportTask> tasks = new ConcurrentHashMap<>();

    @Autowired
    public AdminDataExportService(
        AdminExportZipWriter adminExportZipWriter,
        PlatformTransactionManager transactionManager,
        TaskExecutor taskExecutor,
        @Value("${aet.admin-export.storage-dir:${java.io.tmpdir}/doc-apply-admin-exports}") String storageDir,
        @Value("${aet.admin-export.ttl-hours:24}") int ttlHours
    ) {
        this.adminExportZipWriter = adminExportZipWriter;
        this.transactionManager = transactionManager;
        this.taskExecutor = taskExecutor;
        this.storageDir = Paths.get(storageDir);
        this.ttlHours = ttlHours;
    }

    @PostConstruct
    void init() throws IOException {
        Files.createDirectories(storageDir);
        log.info("Admin export storage directory: {} (TTL: {}h)", storageDir.toAbsolutePath(), ttlHours);
    }

    /**
     * Schedules an admin export to run in the background and returns the task
     * immediately. The caller (the controller) responds with the task id; the
     * client then polls {@link #getTask} until the task flips to {@code READY}.
     *
     * <p>Only one concurrent export is allowed per admin user — if the caller
     * already has a task in {@link AdminExportTask.Status#IN_PROGRESS}, this
     * method throws {@link ExportAlreadyRunningException} carrying that task
     * so the controller can return it as a {@code 409 Conflict}. This both
     * prevents accidental double-starts (e.g. two open tabs) and shields the
     * shared task executor / DB connection pool from having multiple heavy
     * exports contend with each other.
     *
     * @param type        which kind of admin export to produce
     * @param requestedBy id of the admin user who initiated this export
     * @return the freshly created task, already submitted to the task executor
     * @throws ExportAlreadyRunningException if the user already has a task in progress
     */
    public AdminExportTask startExport(@NonNull AdminExportType type, @NonNull UUID requestedBy) {
        AdminExportTask existing = findInProgressTaskFor(requestedBy);
        if (existing != null) {
            throw new ExportAlreadyRunningException(existing);
        }
        UUID taskId = UUID.randomUUID();
        Path file = storageDir.resolve(taskId + ".zip");
        AdminExportTask task = new AdminExportTask(taskId, type, requestedBy, file);
        tasks.put(taskId, task);
        taskExecutor.execute(() -> runBuild(task));
        return task;
    }

    /**
     * Returns the first task in state {@code IN_PROGRESS} owned by the given
     * user, or {@code null} if none. Used by {@link #startExport} to enforce
     * the one-concurrent-export-per-user rule.
     */
    private AdminExportTask findInProgressTaskFor(UUID requestedBy) {
        for (AdminExportTask task : tasks.values()) {
            if (task.status() == AdminExportTask.Status.IN_PROGRESS && requestedBy.equals(task.requestedBy())) {
                return task;
            }
        }
        return null;
    }

    /**
     * Returns all tasks currently tracked for the given admin user, newest
     * first. Used by the polling UI to hydrate its state on page load — after
     * a refresh the frontend has lost its task ids but the server-side map
     * still holds every task the user hasn't yet expired out of.
     *
     * @param requestedBy id of the admin user whose tasks to list
     * @return a newest-first list of tasks for that user; empty if none
     */
    public List<AdminExportTask> listTasksFor(@NonNull UUID requestedBy) {
        return tasks
            .values()
            .stream()
            .filter(t -> requestedBy.equals(t.requestedBy()))
            .sorted(Comparator.comparing(AdminExportTask::createdAt).reversed())
            .toList();
    }

    /**
     * Thrown by {@link #startExport} when the calling user already has a
     * task in progress. Carries the existing task so the controller can
     * surface its id to the client in the {@code 409 Conflict} response.
     */
    public static final class ExportAlreadyRunningException extends RuntimeException {

        private final transient AdminExportTask existing;

        ExportAlreadyRunningException(AdminExportTask existing) {
            super("Admin export already in progress: " + existing.taskId());
            this.existing = existing;
        }

        public AdminExportTask existing() {
            return existing;
        }
    }

    /**
     * Runs the actual export build for the given task. Wrapped in a read-only
     * transaction so the strategies can lazily load entity collections. Emits
     * a single summary log line at the end — this is the canonical per-task
     * completion event (the HTTP POST only logs the queueing, since the build
     * runs on a background thread after the request returns).
     */
    private void runBuild(AdminExportTask task) {
        TransactionTemplate tx = new TransactionTemplate(Objects.requireNonNull(transactionManager));
        tx.setReadOnly(true);
        try {
            tx.executeWithoutResult(status -> {
                try (OutputStream out = Files.newOutputStream(task.file())) {
                    adminExportZipWriter.writeExport(out, task.type(), task.manifest());
                } catch (IOException e) {
                    throw new UserDataExportException("Failed to write admin export ZIP for " + task.type(), e);
                }
            });
            task.markReady();
            logCompletionSummary(task);
        } catch (Exception e) {
            log.error("Admin export task {} failed", task.taskId(), e);
            task.markFailed(e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
            try {
                Files.deleteIfExists(task.file());
            } catch (IOException ignored) {
                // best-effort cleanup
            }
        }
    }

    /**
     * Emits the completion summary log line: status, duration, and per-category
     * counts including the total number of failures. This is how the admin
     * verifies on the server side that the export finished cleanly — match it
     * against {@code manifest.json} inside the ZIP for a legal handover.
     */
    private void logCompletionSummary(AdminExportTask task) {
        ExportManifest.Payload p = task.manifest().snapshot();
        log.info(
            "Admin export {} (task {}) finished with status {} in {}s — RG {}/{} (failed {}), Jobs {}/{} (failed {}), " +
                "Applications {}/{} (failed {}), Documents {}/{} (failed {}), Users {}/{} (failed {}), " +
                "Schools {}/{} (failed {}), Departments {}/{} (failed {}), UserResearchGroupRoles {}/{} (failed {}), " +
                "Applicants {}/{} (failed {}), ApplicantSubjectAreaSubscriptions {}/{} (failed {}), " +
                "total failures: {}, file: {} bytes",
            task.type(),
            task.taskId(),
            p.status(),
            p.durationSeconds(),
            p.totals().researchGroups().exported(),
            p.totals().researchGroups().expected(),
            p.totals().researchGroups().failed(),
            p.totals().jobs().exported(),
            p.totals().jobs().expected(),
            p.totals().jobs().failed(),
            p.totals().applications().exported(),
            p.totals().applications().expected(),
            p.totals().applications().failed(),
            p.totals().documents().exported(),
            p.totals().documents().expected(),
            p.totals().documents().failed(),
            p.totals().users().exported(),
            p.totals().users().expected(),
            p.totals().users().failed(),
            p.totals().schools().exported(),
            p.totals().schools().expected(),
            p.totals().schools().failed(),
            p.totals().departments().exported(),
            p.totals().departments().expected(),
            p.totals().departments().failed(),
            p.totals().userResearchGroupRoles().exported(),
            p.totals().userResearchGroupRoles().expected(),
            p.totals().userResearchGroupRoles().failed(),
            p.totals().applicants().exported(),
            p.totals().applicants().expected(),
            p.totals().applicants().failed(),
            p.totals().applicantSubjectAreaSubscriptions().exported(),
            p.totals().applicantSubjectAreaSubscriptions().expected(),
            p.totals().applicantSubjectAreaSubscriptions().failed(),
            p.failures().size(),
            safeFileSize(task.file())
        );
    }

    /**
     * Returns the task with the given id, or {@code null} if no such task is
     * tracked. Used by the polling endpoint and the download endpoint.
     *
     * @param taskId the task id returned from {@link #startExport}
     * @return the task, or {@code null} if not found / expired
     */
    public AdminExportTask getTask(@NonNull UUID taskId) {
        return tasks.get(taskId);
    }

    /**
     * Returns the on-disk path of the built ZIP for the given task, or
     * {@code null} if the task does not exist, is not ready, or its file has
     * been cleaned up. The caller is responsible for streaming the file back
     * to the client.
     *
     * @param taskId the task id returned from {@link #startExport}
     * @return path to the ZIP file, or {@code null} if not available
     */
    public Path getDownloadPath(@NonNull UUID taskId) {
        AdminExportTask task = tasks.get(taskId);
        if (task == null || !task.isReady()) {
            return null;
        }
        Path file = task.file();
        if (!Files.exists(file)) {
            return null;
        }
        return file;
    }

    /**
     * Returns a stable, human-friendly file name for the produced ZIP based on
     * the export type and the current date. Used by the controller for the
     * {@code Content-Disposition} header.
     *
     * @param type which kind of admin export to produce
     * @return a sanitized base file name including the {@code .zip} extension
     */
    public String fileNameFor(@NonNull AdminExportType type) {
        String today = java.time.LocalDate.now().toString();
        return "admin-export-" + type.name().toLowerCase() + "-" + today + ".zip";
    }

    /**
     * Hourly cleanup: removes any task whose creation time is older than
     * {@code ttlHours} and deletes its file from disk. Keeps the in-memory map
     * and the temp directory bounded over time.
     */
    @Scheduled(fixedDelayString = "PT1H")
    void cleanupExpired() {
        Instant cutoff = Instant.now().minus(Duration.ofHours(ttlHours));
        tasks
            .entrySet()
            .removeIf(entry -> {
                AdminExportTask t = entry.getValue();
                if (t.createdAt().isBefore(cutoff)) {
                    try {
                        Files.deleteIfExists(t.file());
                    } catch (IOException ignored) {
                        // best-effort cleanup
                    }
                    return true;
                }
                return false;
            });
    }

    private static long safeFileSize(Path file) {
        try {
            return Files.size(file);
        } catch (IOException e) {
            return -1L;
        }
    }
}
