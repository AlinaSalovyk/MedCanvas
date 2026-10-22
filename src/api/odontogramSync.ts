import { onStateChange, getStatusChart, importStatus } from "../odontogram";
import { MedCanvasApiClient, ConcurrencyConflictError } from "./client";
import type { OdontogramResponseDto } from "./types";

export type SyncStatus = "idle" | "loading" | "saving" | "saved" | "conflict" | "error";

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
   * Load the remote odontogram snapshot for this encounter and hydrate into the engine.
   * Safety guardrail: will not silently overwrite unsaved local changes.
   */
  public async load(): Promise<void> {
    if (this.isDisposed) {
      throw new Error("OdontogramSyncBridge is disposed.");
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

      // Hydrate into odontogram engine without triggering autoSave cycle
      this.isHydrating = true;
      try {
        importStatus(parsed);
      } finally {
        this.isHydrating = false;
      }

      this.currentETag = etag || `"${odontogram.concurrencyVersion}"`;
      this.currentVersion = odontogram.concurrencyVersion;
      this.localRevision = 0;
      this.savedRevision = 0;
      this.hasPendingEdits = false;

      this.setStatus("saved");
    } catch (err: unknown) {
      if (this.isDisposed || gen !== this.generation) {
        return;
      }
      const error = err instanceof Error ? err : new Error(String(err));
      this.setStatus("error", error);
      throw error;
    }
  }

  /**
   * Safely switch to another encounter using an atomic two-phase protocol:
   * Phase A (Prepare):
   *   1. Flushes pending edits for current encounter.
   *   2. Fetches target encounter snapshot into local variables WITHOUT mutating active encounter state.
   *   3. Validates target snapshot ownership and parses snapshot JSON.
   * Phase B (Commit):
   *   4. Hydrates target snapshot with rollback safety.
   *   5. Atomically commits target encounter identity and concurrency metadata.
   * If any step in Phase A fails, active encounter identity, chart, and metadata remain untouched.
   */
  public async switchEncounter(newEncounterId: string): Promise<void> {
    if (this.isDisposed) {
      throw new Error("OdontogramSyncBridge is disposed.");
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
      try {
        importStatus(chartRollback);
      } catch {
        // Rollback failed; retain error status
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
    this.setStatus("saved");
  }

  /**
   * Attach live state listener to automatically push changes after debounce delay.
   */
  public startAutoSync(): void {
    if (this.unsubscribeListener || this.isDisposed) {
      return;
    }

    this.unsubscribeListener = onStateChange(() => {
      if (this.isHydrating || !this.autoSave || this.isDisposed) {
        return;
      }

      // If in conflict, halt auto-saves so we do not spam or clobber conflict state
      if (this.currentStatus === "conflict") {
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
   * If a write is in flight, records pending changes and coalesces callers into a single next serialized save.
   */
  public async save(changeSummary?: string): Promise<OdontogramResponseDto> {
    if (this.isDisposed) {
      throw new Error("OdontogramSyncBridge is disposed.");
    }

    if (this.currentStatus === "conflict") {
      throw new Error("Cannot save while concurrency conflict is active. Resolve conflict first.");
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
          if (this.isDisposed || this.currentStatus === "conflict") {
            throw new Error("Save aborted due to bridge state transition.");
          }
          return this.save();
        })();
      }
      return this.pendingBatchPromise;
    }

    if (this.localRevision === this.savedRevision) {
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

