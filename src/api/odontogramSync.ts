import { onStateChange, getStatusChart, importStatus } from "../odontogram";
import { MedCanvasApiClient, ConcurrencyConflictError } from "./client";
import type { OdontogramResponseDto } from "./types";

export type SyncStatus = "idle" | "loading" | "saving" | "saved" | "conflict" | "error" | "recovery-required";

export interface SyncOptions {
  client: MedCanvasApiClient;
  encounterId: string;
  autoSave?: boolean;
  debounceMs?: number;
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

  // Revision tracking for accurate dirty/saved state
  private localRevision = 0;
  private savedRevision = 0;
  private lastSavedResponse: OdontogramResponseDto | null = null;

  // Fail-closed recovery lock (MC-P0-01)
  private isRecoveryRequired = false;
  private recoveryRollbackChart: unknown = null;

  constructor(options: SyncOptions) {
    this.client = options.client;
    this.encounterId = options.encounterId;
    this.autoSave = options.autoSave ?? true;
    this.debounceMs = options.debounceMs ?? 1000;
    this.onStatusChange = options.onStatusChange;
    this.onConflict = options.onConflict;
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
   * Explicitly restore chart integrity after a fatal hydration/rollback failure.
   * Unlocks the bridge only if the verified chart is successfully hydrated into the engine.
   */
  public recoverChart(verifiedChart?: unknown): void {
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

    this.isHydrating = true;
    try {
      importStatus(chartToRestore);
      this.isRecoveryRequired = false;
      this.recoveryRollbackChart = null;
      this.localRevision = 0;
      this.savedRevision = 0;
      this.hasPendingEdits = false;
      this.setStatus("saved");
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
   *   1. Rejects if bridge is in recovery-required state.
   *   2. Will not silently overwrite unsaved local changes.
   *   3. Catches hydration errors and restores previous chart state, locking down if rollback fails.
   */
  public async load(): Promise<void> {
    if (this.isDisposed) {
      throw new Error("OdontogramSyncBridge is disposed.");
    }

    if (this.isRecoveryRequired || this.currentStatus === "recovery-required") {
      throw new Error("Cannot load encounter: bridge is locked in recovery-required state.");
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

      this.currentETag = etag || `"${odontogram.concurrencyVersion}"`;
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
   *   3. Fetches target encounter snapshot into local variables WITHOUT mutating active encounter state.
   *   4. Validates target snapshot ownership and parses snapshot JSON.
   * Phase B (Commit):
   *   5. Hydrates target snapshot with rollback safety.
   *   6. If target hydration fails AND rollback fails, locks down permanently in "recovery-required" state.
   *   7. Atomically commits target encounter identity and concurrency metadata.
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

    // 4. Validate snapshot JSON before touching the active chart
    const parsedTarget = JSON.parse(odontogram.snapshotJson);

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
    this.currentETag = etag || `"${odontogram.concurrencyVersion}"`;
    this.currentVersion = odontogram.concurrencyVersion;
    this.localRevision = 0;
    this.savedRevision = 0;
    this.hasPendingEdits = false;
    this.lastSavedResponse = odontogram;
    this.setStatus("saved");
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
    this.stopAutoSync();
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

        this.currentETag = etag || `"${odontogram.concurrencyVersion}"`;
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


