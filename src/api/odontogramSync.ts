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
    return this.currentStatus === "saving" || this.hasPendingEdits || this.saveTimeout !== null;
  }

  private setStatus(status: SyncStatus, error?: Error): void {
    this.currentStatus = status;
    this.onStatusChange?.(status, error);
  }

  /**
   * Load the remote odontogram snapshot for this encounter and hydrate into the engine.
   */
  public async load(): Promise<void> {
    if (this.isDisposed) {
      throw new Error("OdontogramSyncBridge is disposed.");
    }

    this.setStatus("loading");
    try {
      const { odontogram, etag } = await this.client.getOdontogramByEncounter(this.encounterId);
      this.currentETag = etag || `"${odontogram.concurrencyVersion}"`;
      this.currentVersion = odontogram.concurrencyVersion;

      // Hydrate into odontogram engine without triggering autoSave cycle
      this.isHydrating = true;
      try {
        const parsed = JSON.parse(odontogram.snapshotJson);
        importStatus(parsed);
      } finally {
        this.isHydrating = false;
      }

      this.setStatus("saved");
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.setStatus("error", error);
      throw error;
    }
  }

  /**
   * Safely switch to another encounter. Flushes any pending edits first, then reloads.
   */
  public async switchEncounter(newEncounterId: string): Promise<void> {
    if (this.encounterId === newEncounterId) {
      return;
    }

    // Flush any pending unsaved work for current encounter before switching
    if (this.hasUnsavedChanges()) {
      await this.save("Auto-save prior to encounter switch").catch(() => {
        // Continue switch even if save encountered an error
      });
    }

    this.encounterId = newEncounterId;
    this.currentETag = null;
    this.currentVersion = 1;
    this.hasPendingEdits = false;
    await this.load();
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

    this.hasPendingEdits = false;
    const summaryToUse = this.pendingChangeSummary;
    this.pendingChangeSummary = undefined;

    this.setStatus("saving");

    const executeSave = async (): Promise<OdontogramResponseDto> => {
      try {
        const currentChart = getStatusChart();
        const snapshotJson = JSON.stringify(currentChart);

        const { odontogram, etag } = await this.client.saveOdontogram(
          this.encounterId,
          {
            snapshotJson,
            expectedVersion: this.currentVersion,
            changeSummary: summaryToUse,
          },
          this.currentETag
        );

        if (this.isDisposed) {
          return odontogram;
        }

        this.currentETag = etag || `"${odontogram.concurrencyVersion}"`;
        this.currentVersion = odontogram.concurrencyVersion;
        this.setStatus("saved");
        return odontogram;
      } catch (err: unknown) {
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

