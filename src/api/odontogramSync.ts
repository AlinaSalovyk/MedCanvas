import { onStateChange, getStatusChart, importStatus } from "../odontogram";
import { MedCanvasApiClient, ConcurrencyConflictError } from "./client";
import type { OdontogramResponseDto } from "./types";

export type SyncStatus = "idle" | "loading" | "saving" | "saved" | "conflict" | "error" | "recovery-required";

/** FDI tooth keys accepted at the top level of `teeth`/`plan` maps:
 *  permanent quadrants 11–48 and primary quadrants 51–85 (ISO 3950). */
const FDI_KEY_PATTERN = /^(?:[1-4][1-8]|5[1-5]|[6-8][1-5])$/;

/**
 * Strict structural validation of an odontogram snapshot before it may be trusted
 * for recovery, load, or encounter-switch hydration (M00 clinical safety gate).
 * Rejects anything that is not a plausible canonical payload: non-object roots,
 * missing/malformed `version`, missing/non-object `teeth`, and non-FDI tooth keys.
 */
export function assertValidOdontogramSnapshotStructure(snapshot: unknown, context: string): void {
  if (typeof snapshot !== "object" || snapshot === null || Array.isArray(snapshot)) {
    throw new Error(`${context}: snapshot must be a plain object.`);
  }
  const root = snapshot as Record<string, unknown>;
  if (typeof root.version !== "string" || !/^\d+\.\d+(\.\d+)?$/.test(root.version)) {
    throw new Error(`${context}: snapshot 'version' must be a semantic version string.`);
  }
  if (typeof root.teeth !== "object" || root.teeth === null || Array.isArray(root.teeth)) {
    throw new Error(`${context}: snapshot 'teeth' must be an object.`);
  }
  for (const [key, value] of Object.entries(root.teeth)) {
    if (!FDI_KEY_PATTERN.test(key)) {
      throw new Error(`${context}: invalid FDI tooth key '${key}' in 'teeth'.`);
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(`${context}: tooth '${key}' state must be an object.`);
    }
  }
  if (root.plan !== undefined) {
    if (typeof root.plan !== "object" || root.plan === null || Array.isArray(root.plan)) {
      throw new Error(`${context}: snapshot 'plan' must be an object.`);
    }
    for (const [key, value] of Object.entries(root.plan)) {
      if (!FDI_KEY_PATTERN.test(key)) {
        throw new Error(`${context}: invalid FDI tooth key '${key}' in 'plan'.`);
      }
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`${context}: plan tooth '${key}' state must be an object.`);
      }
    }
  }
}

/** Explicit recovery policy options (M00): autosave resumption is opt-in and the
 *  bridge only claims "saved" when the host supplies the server's concurrency
 *  metadata for the verified chart. */
export interface RecoverChartOptions {
  /** Re-attach the autosave listener after successful recovery. Default: stay disabled. */
  resumeAutoSync?: boolean;
  /** Server ETag of the verified chart, when the host fetched it from the server. */
  serverETag?: string;
  /** Server concurrency version matching {@link serverETag}. */
  serverVersion?: number;
}

export interface SyncOptions {
  client: MedCanvasApiClient;
  encounterId: string;
  autoSave?: boolean;
  debounceMs?: number;
  /** Warn on unload while unsaved edits exist (default true). */
  unloadGuard?: boolean;
  onStatusChange?: (status: SyncStatus, error?: Error) => void;
  onConflict?: (serverVersion: OdontogramResponseDto) => void;
}

export class OdontogramSyncBridge {
  private client: MedCanvasApiClient;
  private encounterId: string;
  private autoSave: boolean;
  private debounceMs: number;
  private onStatusChange?: (status: SyncStatus, error?: Error) => void;
  private onConflict?: (serverVersion: OdontogramResponseDto) => void;

  private currentETag: string | null = null;
  private currentVersion = 1;
  private currentStatus: SyncStatus = "idle";
  private unsubscribeListener: (() => void) | null = null;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private isHydrating = false;

  // Concurrency & Autosave State Machine
  private inFlightPromise: Promise<OdontogramResponseDto> | null = null;
  private pendingBatchPromise: Promise<OdontogramResponseDto> | null = null;
  private hasPendingEdits = false;
  private pendingChangeSummary?: string;
  private isDisposed = false;
  private generation = 0;

  // Encounter-switch edit protection (M00): >0 while a switch is between its
  // flush and commit. Edits landing in this window are counted but not scheduled;
  // the switch's pre-commit check aborts on them so they can never be written
  // under the wrong encounter, and resumption re-schedules autosave.
  private switchDepth = 0;

  // Revision tracking for accurate dirty/saved state
  private localRevision = 0;
  private savedRevision = 0;
  private lastSavedResponse: OdontogramResponseDto | null = null;

  // Fail-closed recovery lock (MC-P0-01)
  private isRecoveryRequired = false;
  private recoveryRollbackChart: unknown = null;

  // Unload guard (M00): warn before leaving with unsaved edits + best-effort flush
  private unloadHandler: ((event: Event) => void) | null = null;

  /**
   * Explicitly resolve an active concurrency conflict by adopting the server copy
   * (M04): local unsaved edits ARE discarded — the caller must have obtained the
   * user's confirmation. Refuses outside the conflict state, refuses while locked.
   * Reloads the server snapshot through the guarded load path and resumes autosave.
   */
  public async resolveConflictWithServerCopy(): Promise<void> {
    if (this.isDisposed) {
      throw new Error("OdontogramSyncBridge is disposed.");
    }
    if (this.isRecoveryRequired || this.currentStatus === "recovery-required") {
      throw new Error("Cannot resolve conflict: bridge is locked in recovery-required state.");
    }
    if (this.currentStatus !== "conflict") {
      throw new Error("resolveConflictWithServerCopy requires an active conflict state.");
    }

    // Disarm any pending save work and account the local edits as discarded.
    this.generation++;
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.localRevision = 0;
    this.savedRevision = 0;
    this.hasPendingEdits = false;
    this.pendingBatchPromise = null;

    // load() re-validates identity, structure, ETag, hydrates with rollback safety.
    await this.load();
    if (this.autoSave && !this.unsubscribeListener) {
      this.startAutoSync();
    }
  }

  constructor(options: SyncOptions) {
    this.client = options.client;
    this.encounterId = options.encounterId;
    this.autoSave = options.autoSave ?? true;
    this.debounceMs = options.debounceMs ?? 1000;
    this.onStatusChange = options.onStatusChange;
    this.onConflict = options.onConflict;
    if (options.unloadGuard !== false) {
      this.attachUnloadGuard();
    }
  }

  public getStatus(): SyncStatus {
    return this.currentStatus;
  }

  public getETag(): string | null {
    return this.currentETag;
  }

  public getEncounterId(): string {
    return this.encounterId;
  }

  public isLockedForRecovery(): boolean {
    return this.isRecoveryRequired || this.currentStatus === "recovery-required";
  }

  public hasUnsavedChanges(): boolean {
    if (this.isDisposed) {
      return false;
    }
    return (
      this.localRevision > this.savedRevision ||
      this.currentStatus === "saving" ||
      this.hasPendingEdits ||
      this.saveTimeout !== null ||
      this.inFlightPromise !== null ||
      this.pendingBatchPromise !== null
    );
  }

  private setStatus(status: SyncStatus, error?: Error): void {
    this.currentStatus = status;
    this.onStatusChange?.(status, error);
  }

  /**
   * Resolve the concurrency ETag for a server response. The ETag is mandatory
   * protocol state: fabricating one from the concurrency version would risk a
   * permanent 412 loop against a server that did not actually send the header.
   */
  private requireServerETag(etag: string | null | undefined, context: string): string {
    if (typeof etag !== "string" || etag.length === 0) {
      throw new Error(
        `${context}: server response is missing the required ETag header; refusing to fabricate a concurrency tag.`
      );
    }
    return etag;
  }

  /**
   * Explicitly restore chart integrity after a fatal hydration/rollback failure.
   * Strict validation runs BEFORE any hydration attempt: an invalid snapshot
   * throws and the fail-closed recovery lock stays engaged. The bridge unlocks
   * only if the verified chart is successfully hydrated into the engine.
   *
   * Post-recovery policy (M00):
   *  - Autosave stays disabled unless {@link RecoverChartOptions.resumeAutoSync} is set.
   *  - Status is "saved" only when the host supplies the server concurrency metadata
   *    for the verified chart; otherwise the bridge reports "idle" because no server
   *    acknowledgement exists, and the next save must re-establish concurrency state.
   */
  public recoverChart(verifiedChart?: unknown, options?: RecoverChartOptions): void {
    if (this.isDisposed) {
      throw new Error("OdontogramSyncBridge is disposed.");
    }

    if (!this.isRecoveryRequired && this.currentStatus !== "recovery-required") {
      return;
    }

    const chartToRestore = verifiedChart ?? this.recoveryRollbackChart;
    if (!chartToRestore) {
      throw new Error("Cannot recover chart: no verified chart snapshot provided and no rollback snapshot available.");
    }

    assertValidOdontogramSnapshotStructure(chartToRestore, "Chart recovery rejected");

    this.isHydrating = true;
    try {
      importStatus(chartToRestore);
      this.isRecoveryRequired = false;
      this.recoveryRollbackChart = null;
      this.localRevision = 0;
      this.savedRevision = 0;
      this.hasPendingEdits = false;

      const hasServerMetadata =
        typeof options?.serverETag === "string" &&
        options.serverETag.length > 0 &&
        typeof options.serverVersion === "number";
      if (hasServerMetadata) {
        this.currentETag = options!.serverETag!;
        this.currentVersion = options!.serverVersion!;
        this.lastSavedResponse = null;
        this.setStatus("saved");
      } else {
        this.currentETag = null;
        this.lastSavedResponse = null;
        this.setStatus("idle");
      }

      if (options?.resumeAutoSync === true && this.autoSave) {
        this.startAutoSync();
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.setStatus("recovery-required", error);
      throw new Error(`Failed to recover chart: ${error.message}`);
    } finally {
      this.isHydrating = false;
    }
  }

  /**
   * Load the remote odontogram snapshot for this encounter and hydrate into the engine.
   * Safety guardrails:
   *   1. Rejects if bridge is in recovery-required state or a switch is in progress.
   *   2. Will not silently overwrite unsaved local changes.
   *   3. Strictly validates the snapshot structure before touching the chart.
   *   4. Catches hydration errors and restores previous chart state, locking down if rollback fails.
   */
  public async load(): Promise<void> {
    if (this.isDisposed) {
      throw new Error("OdontogramSyncBridge is disposed.");
    }

    if (this.isRecoveryRequired || this.currentStatus === "recovery-required") {
      throw new Error("Cannot load encounter: bridge is locked in recovery-required state.");
    }

    if (this.switchDepth > 0) {
      throw new Error("Cannot load encounter while an encounter switch is in progress.");
    }

    if (this.hasUnsavedChanges()) {
      throw new Error(
        "Cannot load remote encounter while unsaved changes exist for the active encounter. Save or discard changes first."
      );
    }

    const gen = this.generation;
    this.setStatus("loading");
    try {
      const { odontogram, etag } = await this.client.getOdontogramByEncounter(this.encounterId);
      if (this.isDisposed || gen !== this.generation) {
        return;
      }

      if (odontogram.encounterId !== this.encounterId) {
        throw new Error(
          `Encounter mismatch: requested '${this.encounterId}', received snapshot for '${odontogram.encounterId}'.`
        );
      }

      // Parse JSON before touching any bridge metadata or chart
      const parsed = JSON.parse(odontogram.snapshotJson);
      assertValidOdontogramSnapshotStructure(parsed, "Odontogram load rejected");
      const resolvedETag = this.requireServerETag(etag, "Odontogram load");

      const loadRollback = getStatusChart();

      // Hydrate into odontogram engine without triggering autoSave cycle
      this.isHydrating = true;
      try {
        importStatus(parsed);
      } catch (hydrateErr: unknown) {
        let rollbackOk = false;
        try {
          importStatus(loadRollback);
          rollbackOk = true;
        } catch {
          rollbackOk = false;
        }

        if (!rollbackOk) {
          this.isRecoveryRequired = true;
          this.recoveryRollbackChart = loadRollback;
          this.stopAutoSync();
          const fatalError = new Error(
            "Fatal clinical integrity state: chart hydration and rollback failed during load. OdontogramSyncBridge is locked in recovery-required state."
          );
          this.setStatus("recovery-required", fatalError);
          throw fatalError;
        }

        const error = hydrateErr instanceof Error ? hydrateErr : new Error(String(hydrateErr));
        this.setStatus("error", error);
        throw error;
      } finally {
        this.isHydrating = false;
      }

      this.currentETag = resolvedETag;
      this.currentVersion = odontogram.concurrencyVersion;
      this.localRevision = 0;
      this.savedRevision = 0;
      this.hasPendingEdits = false;
      this.lastSavedResponse = odontogram;

      this.setStatus("saved");
    } catch (err: unknown) {
      if (this.isDisposed || gen !== this.generation) {
        return;
      }
      const error = err instanceof Error ? err : new Error(String(err));
      if (!this.isRecoveryRequired) {
        this.setStatus("error", error);
      }
      throw error;
    }
  }

  /**
   * Safely switch to another encounter using an atomic two-phase protocol:
   * Phase A (Prepare):
   *   1. Rejects if bridge is in recovery-required state.
   *   2. Flushes pending edits for current encounter.
   *   3. Marks the switch window: edits arriving now are counted but deferred, and
   *      the pre-commit check below aborts the switch if any exist, so an edit can
   *      never be lost under, or silently written to, the target encounter.
   *   4. Fetches target encounter snapshot into local variables WITHOUT mutating active encounter state.
   *   5. Validates target snapshot ownership, structure, and parses snapshot JSON.
   * Phase B (Commit):
   *   6. Hydrates target snapshot with rollback safety.
   *   7. If target hydration fails AND rollback fails, locks down permanently in "recovery-required" state.
   *   8. Atomically commits target encounter identity and concurrency metadata.
   * If any step in Phase A fails, active encounter identity, chart, and metadata remain untouched.
   */
  public async switchEncounter(newEncounterId: string): Promise<void> {
    if (this.isDisposed) {
      throw new Error("OdontogramSyncBridge is disposed.");
    }

    if (this.isRecoveryRequired || this.currentStatus === "recovery-required") {
      throw new Error("Cannot switch encounter: bridge is locked in recovery-required state.");
    }

    if (!newEncounterId || typeof newEncounterId !== "string") {
      throw new Error("Target encounter ID is required.");
    }

    if (this.encounterId === newEncounterId) {
      return;
    }

    if (this.currentStatus === "conflict") {
      throw new Error("Cannot switch encounter while concurrency conflict is active. Resolve conflict first.");
    }

    // Phase A: PREPARE
    // 1. Flush any pending unsaved work for current encounter before switching.
    // If save fails or conflict occurs, the switch is REJECTED and active encounter remains unchanged.
    if (this.hasUnsavedChanges()) {
      await this.save("Auto-save prior to encounter switch");

      while (this.hasUnsavedChanges()) {
        await this.save("Auto-save queued edits prior to encounter switch");
      }
    }

    // Token for this switch attempt to disarm stale async responses
    const switchGen = ++this.generation;

    this.switchDepth++;
    try {
      // 2. Fetch target encounter snapshot WITHOUT mutating active encounter state
      const { odontogram, etag } = await this.client.getOdontogramByEncounter(newEncounterId);

      if (this.isDisposed || switchGen !== this.generation) {
        return;
      }

      // 3. Verify target payload belongs to the requested encounter (anti cross-patient corruption)
      if (odontogram.encounterId !== newEncounterId) {
        throw new Error(
          `Cross-patient isolation breach: requested encounter '${newEncounterId}', received payload for '${odontogram.encounterId}'.`
        );
      }

      // 4. Validate snapshot JSON and structure before touching the active chart
      const parsedTarget = JSON.parse(odontogram.snapshotJson);
      assertValidOdontogramSnapshotStructure(parsedTarget, "Encounter switch rejected");
      const resolvedETag = this.requireServerETag(etag, "Encounter switch");

      // 5. Pre-commit edit check: edits that arrived during the switch belong to the
      // SOURCE encounter. Committing now would silently discard them (the target
      // hydration replaces the chart) or write them under the wrong encounter.
      if (this.hasUnsavedChanges()) {
        const abortError = new Error(
          "Encounter switch aborted: new local edits arrived during the switch. The active encounter, chart, and edits are preserved — save and retry."
        );
        this.setStatus("error", abortError);
        throw abortError;
      }

      // Capture rollback snapshot of active chart in case hydration throws
      const chartRollback = getStatusChart();

      // Phase B: COMMIT
      this.isHydrating = true;
      try {
        importStatus(parsedTarget);
      } catch (hydrateErr: unknown) {
        let rollbackOk = false;
        try {
          importStatus(chartRollback);
          rollbackOk = true;
        } catch {
          rollbackOk = false;
        }

        if (!rollbackOk) {
          // FAIL-CLOSED CLINICAL LOCK: Both target hydration and rollback failed.
          // Lock the bridge permanently against further writes or switches until explicit safe recovery.
          this.isRecoveryRequired = true;
          this.recoveryRollbackChart = chartRollback;
          this.stopAutoSync();
          const fatalError = new Error(
            "Fatal clinical integrity state: target chart hydration and rollback failed during encounter switch. OdontogramSyncBridge is locked in recovery-required state. All writes, switches, and loads are blocked until explicit safe recovery."
          );
          this.setStatus("recovery-required", fatalError);
          throw fatalError;
        }

        const error = hydrateErr instanceof Error ? hydrateErr : new Error(String(hydrateErr));
        this.setStatus("error", error);
        throw error;
      } finally {
        this.isHydrating = false;
      }

      // Commit identity, concurrency metadata, and reset revisions as one logical operation
      this.encounterId = newEncounterId;
      this.currentETag = resolvedETag;
      this.currentVersion = odontogram.concurrencyVersion;
      this.localRevision = 0;
      this.savedRevision = 0;
      this.hasPendingEdits = false;
      this.lastSavedResponse = odontogram;
      this.setStatus("saved");
    } finally {
      this.switchDepth--;
      if (this.switchDepth === 0) {
        this.resumeDeferredAutoSave();
      }
    }
  }

  /**
   * Attach live state listener to automatically push changes after debounce delay.
   */
  public startAutoSync(): void {
    if (this.unsubscribeListener || this.isDisposed) {
      return;
    }

    if (this.isRecoveryRequired || this.currentStatus === "recovery-required") {
      return;
    }

    this.unsubscribeListener = onStateChange(() => {
      if (this.isHydrating || !this.autoSave || this.isDisposed) {
        return;
      }

      // If in conflict or recovery-required, halt auto-saves
      if (this.currentStatus === "conflict" || this.currentStatus === "recovery-required" || this.isRecoveryRequired) {
        return;
      }

      this.localRevision++;
      this.hasPendingEdits = true;
      if (this.switchDepth > 0) {
        // Edit landed inside an encounter-switch window: counted, but its save is
        // deferred — the switch's pre-commit check will abort on it (preserving
        // the edit under the source encounter) and resumption re-schedules.
        return;
      }
      this.scheduleSave();
    });
  }

  /**
   * Detach state listener and cancel any pending debounced save.
   */
  public stopAutoSync(): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    if (this.unsubscribeListener) {
      this.unsubscribeListener();
      this.unsubscribeListener = null;
    }
  }

  /**
   * Disposes the bridge, detaching listeners and cancelling timers.
   */
  public destroy(): void {
    this.isDisposed = true;
    this.generation++;
    this.switchDepth = 0;
    this.stopAutoSync();
    this.detachUnloadGuard();
  }

  private scheduleSave(): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.save().catch(() => {
        // Errors surfaced through setStatus
      });
    }, this.debounceMs);
  }

  /** After an encounter-switch window closes, re-arm autosave for any edit that
   *  was deliberately left unscheduled while the switch was in flight. */
  private resumeDeferredAutoSave(): void {
    if (
      !this.isDisposed &&
      !this.isRecoveryRequired &&
      this.currentStatus !== "conflict" &&
      this.currentStatus !== "recovery-required" &&
      this.saveTimeout === null &&
      this.hasUnsavedChanges()
    ) {
      this.scheduleSave();
    }
  }

  private attachUnloadGuard(): void {
    if (typeof window === "undefined" || this.unloadHandler !== null) {
      return;
    }

    this.unloadHandler = (event: Event) => {
      if (this.isDisposed || !this.hasUnsavedChanges()) {
        return;
      }

      if (event.type === "beforeunload") {
        // Interactive close: ask the browser to warn the clinician about unsaved edits.
        event.preventDefault();
        (event as BeforeUnloadEvent).returnValue = "";
        return;
      }

      // pagehide (tab hidden/closed): best-effort flush of pending edits.
      if (this.saveTimeout !== null) {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = null;
      }
      if (
        this.inFlightPromise === null &&
        this.pendingBatchPromise === null &&
        this.switchDepth === 0 &&
        !this.isRecoveryRequired &&
        this.currentStatus !== "conflict"
      ) {
        void this.save().catch(() => {
          // Best effort only; failures surfaced through setStatus
        });
      }
    };

    window.addEventListener("beforeunload", this.unloadHandler);
    window.addEventListener("pagehide", this.unloadHandler);
  }

  private detachUnloadGuard(): void {
    if (this.unloadHandler === null || typeof window === "undefined") {
      return;
    }
    window.removeEventListener("beforeunload", this.unloadHandler);
    window.removeEventListener("pagehide", this.unloadHandler);
    this.unloadHandler = null;
  }

  /**
   * Immediately save current clinical state with strict serial queuing to prevent race conditions.
   * Differentiates genuinely dirty snapshots from clean no-op requests and explicit force-saves.
   */
  public async save(changeSummary?: string, options?: { force?: boolean }): Promise<OdontogramResponseDto> {
    if (this.isDisposed) {
      throw new Error("OdontogramSyncBridge is disposed.");
    }

    if (this.isRecoveryRequired || this.currentStatus === "recovery-required") {
      throw new Error(
        "Cannot save: bridge is locked in recovery-required state due to failed chart hydration and rollback."
      );
    }

    if (this.currentStatus === "conflict") {
      throw new Error("Cannot save while concurrency conflict is active. Resolve conflict first.");
    }

    if (this.switchDepth > 0) {
      throw new Error("Cannot save while an encounter switch is in progress.");
    }

    // Check for clean no-op save:
    // If record is already saved on server, no local edits occurred, no pending edits exist,
    // status is not "error", and neither a changeSummary nor force save was requested: return acknowledged snapshot.
    const isExplicitUserSave = Boolean(changeSummary || options?.force);
    const isCleanNoOp =
      this.currentETag !== null &&
      this.localRevision <= this.savedRevision &&
      !this.hasPendingEdits &&
      this.saveTimeout === null &&
      this.currentStatus !== "error" &&
      !isExplicitUserSave;

    if (isCleanNoOp && this.lastSavedResponse) {
      return this.lastSavedResponse;
    }

    if (changeSummary) {
      this.pendingChangeSummary = changeSummary;
    }

    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    // Mutex: If a save is already in flight, coalesce into next serialized batch
    if (this.inFlightPromise !== null) {
      this.hasPendingEdits = true;
      if (!this.pendingBatchPromise) {
        this.pendingBatchPromise = (async () => {
          await this.inFlightPromise!.catch(() => {});
          this.pendingBatchPromise = null;
          if (this.isDisposed || this.currentStatus === "conflict" || this.isRecoveryRequired) {
            throw new Error("Save aborted due to bridge state transition.");
          }
          return this.save();
        })();
      }
      return this.pendingBatchPromise;
    }

    // Increment localRevision only when necessary (first-time create, explicit save, or retry after error)
    if (this.localRevision <= this.savedRevision && (this.currentETag === null || isExplicitUserSave || this.currentStatus === "error")) {
      this.localRevision++;
    }
    const revisionToSave = this.localRevision;
    this.hasPendingEdits = false;
    const summaryToUse = this.pendingChangeSummary;
    this.pendingChangeSummary = undefined;

    this.setStatus("saving");

    const gen = this.generation;
    const saveEncounterId = this.encounterId;

    const executeSave = async (): Promise<OdontogramResponseDto> => {
      try {
        const currentChart = getStatusChart();
        const snapshotJson = JSON.stringify(currentChart);

        const { odontogram, etag } = await this.client.saveOdontogram(
          saveEncounterId,
          {
            snapshotJson,
            expectedVersion: this.currentVersion,
            changeSummary: summaryToUse,
          },
          this.currentETag
        );

        if (this.isDisposed || gen !== this.generation || saveEncounterId !== this.encounterId) {
          return odontogram;
        }

        this.currentETag = this.requireServerETag(etag, "Odontogram save");
        this.currentVersion = odontogram.concurrencyVersion;
        this.savedRevision = Math.max(this.savedRevision, revisionToSave);
        this.lastSavedResponse = odontogram;

        // Check whether newer local edits arrived while the save was in-flight
        if (this.localRevision > this.savedRevision || this.hasPendingEdits || this.saveTimeout !== null) {
          this.hasPendingEdits = true;
          if (!this.pendingBatchPromise && this.saveTimeout === null) {
            this.scheduleSave();
          }
        } else {
          this.setStatus("saved");
        }

        return odontogram;
      } catch (err: unknown) {
        if (this.isDisposed || gen !== this.generation || saveEncounterId !== this.encounterId) {
          throw err;
        }

        // Retain dirty state on save failure so user edits are not lost
        this.hasPendingEdits = true;

        if (err instanceof ConcurrencyConflictError) {
          this.setStatus("conflict", err);
          this.stopAutoSync(); // Halt background saves

          // Fetch fresh server copy to pass to conflict callback
          try {
            const fresh = await this.client.getOdontogramByEncounter(this.encounterId);
            this.onConflict?.(fresh.odontogram);
          } catch {
            // Ignore failure fetching fresh copy
          }

          throw err;
        }

        const error = err instanceof Error ? err : new Error(String(err));
        this.setStatus("error", error);
        throw error;
      } finally {
        this.inFlightPromise = null;
      }
    };

    this.inFlightPromise = executeSave();
    return this.inFlightPromise;
  }
}
