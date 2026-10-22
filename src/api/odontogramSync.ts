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

  private setStatus(status: SyncStatus, error?: Error): void {
    this.currentStatus = status;
    this.onStatusChange?.(status, error);
  }

  /**
   * Load the remote odontogram snapshot for this encounter and hydrate into the engine.
   */
  public async load(): Promise<void> {
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
   * Attach live state listener to automatically push changes after debounce delay.
   */
  public startAutoSync(): void {
    if (this.unsubscribeListener) {
      return;
    }

    this.unsubscribeListener = onStateChange(() => {
      if (this.isHydrating || !this.autoSave) {
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

  private scheduleSave(): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.save().catch(() => {
        // Errors handled in save()
      });
    }, this.debounceMs);
  }

  /**
   * Immediately save current clinical state to the backend with optimistic locking.
   */
  public async save(changeSummary?: string): Promise<OdontogramResponseDto> {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    this.setStatus("saving");

    try {
      const currentChart = getStatusChart({ includePlan: true });
      const snapshotJson = JSON.stringify(currentChart);

      const { odontogram, etag } = await this.client.saveOdontogram(
        this.encounterId,
        {
          snapshotJson,
          expectedVersion: this.currentVersion,
          changeSummary,
        },
        this.currentETag
      );

      this.currentETag = etag || `"${odontogram.concurrencyVersion}"`;
      this.currentVersion = odontogram.concurrencyVersion;
      this.setStatus("saved");
      return odontogram;
    } catch (err: unknown) {
      if (err instanceof ConcurrencyConflictError) {
        this.setStatus("conflict", err);

        // Fetch fresh server copy to pass to conflict resolver
        try {
          const fresh = await this.client.getOdontogramByEncounter(this.encounterId);
          this.onConflict?.(fresh.odontogram);
        } catch {
          // ignore error fetching latest
        }

        throw err;
      }

      const error = err instanceof Error ? err : new Error(String(err));
      this.setStatus("error", error);
      throw error;
    }
  }
}
