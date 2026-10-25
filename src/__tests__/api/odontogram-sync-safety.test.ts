/**
 * M00 — Clinical Safety Foundation regression tests.
 *
 * Covers the MVP M00 acceptance criteria for OdontogramSyncBridge:
 *   - Strict snapshot validation before recoverChart(): an invalid snapshot never
 *     lifts the fail-closed recovery lock, and hydration is never attempted for it.
 *   - After failed recovery all clinical writes stay forbidden.
 *   - Autosave resumption after recovery is an explicit opt-in policy.
 *   - "saved" is never reported without server acknowledgement (recovery without
 *     server metadata reports "idle"; a missing ETag header is an error, never a
 *     fabricated tag).
 *   - Edits made during an encounter switch are preserved under the SOURCE
 *     encounter: the switch aborts, and deferred autosave resumes afterwards.
 *   - Structurally invalid snapshots are rejected at load/switch before hydration.
 *   - Unload protection warns on beforeunload with unsaved edits and best-effort
 *     flushes pending edits on pagehide.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConcurrencyConflictError, MedCanvasApiClient } from "../../api/client";

let mockStateListener: (() => void) | null = null;
const mockGetStatusChart = vi.fn(() => ({ version: "2.22", teeth: {} }));
const mockImportStatus = vi.fn();

vi.mock("../../odontogram", () => ({
  getStatusChart: () => mockGetStatusChart(),
  importStatus: (data: unknown) => mockImportStatus(data),
  onStateChange: (listener: () => void) => {
    mockStateListener = listener;
    return () => {
      mockStateListener = null;
    };
  },
}));

import { OdontogramSyncBridge, assertValidOdontogramSnapshotStructure } from "../../api/odontogramSync";
import type { SyncOptions } from "../../api/odontogramSync";

// Unload guards attach window-level listeners; every bridge created through this
// helper is destroyed after each test so guards never leak across tests.
const liveBridges: OdontogramSyncBridge[] = [];
function newBridge(options: SyncOptions): OdontogramSyncBridge {
  const bridge = new OdontogramSyncBridge(options);
  liveBridges.push(bridge);
  return bridge;
}

afterEach(() => {
  for (const bridge of liveBridges.splice(0)) {
    try {
      bridge.destroy();
    } catch {
      // already disposed
    }
  }
});

function dtoFor(encounterId: string, snapshot: unknown, concurrencyVersion = 1) {
  return {
    id: `rec-${encounterId}`,
    clinicId: "c-1",
    patientId: `pat-${encounterId}`,
    encounterId,
    payloadVersion: "2.22",
    snapshotJson: typeof snapshot === "string" ? snapshot : JSON.stringify(snapshot),
    isFinalized: false,
    concurrencyVersion,
    createdAtUtc: "2026-10-22T12:00:00Z",
  };
}

async function enterRecoveryLock(client: MedCanvasApiClient, encounterId: string): Promise<OdontogramSyncBridge> {
  vi.spyOn(client, "getOdontogramByEncounter").mockResolvedValueOnce({
    odontogram: dtoFor(encounterId, { version: "2.22", teeth: {} }),
    etag: '"1"',
  });
  const bridge = newBridge({ client, encounterId });
  mockImportStatus
    .mockImplementationOnce(() => {
      throw new Error("Hydration error");
    })
    .mockImplementationOnce(() => {
      throw new Error("Rollback error");
    });
  await expect(bridge.load()).rejects.toThrow("locked in recovery-required state");
  expect(bridge.isLockedForRecovery()).toBe(true);
  return bridge;
}

describe("assertValidOdontogramSnapshotStructure (M00)", () => {
  it("accepts a canonical status+plan payload with permanent and primary FDI keys", () => {
    expect(() =>
      assertValidOdontogramSnapshotStructure(
        { version: "2.22", teeth: { "11": { toothSelection: "tooth-base" }, "55": {} }, plan: { "16": { endo: "endo-filling" } } },
        "test"
      )
    ).not.toThrow();
  });

  it("rejects non-object roots, bad versions, missing teeth, and invalid FDI keys", () => {
    for (const bad of [null, [], "json", 42, {}, { version: "two.twenty", teeth: {} }, { version: "2.22" }, { version: "2.22", teeth: [] }, { version: "2.22", teeth: { "99": {} } }, { version: "2.22", teeth: { "11": "not-an-object" } }, { version: "2.22", teeth: {}, plan: { "0": {} } }]) {
      expect(() => assertValidOdontogramSnapshotStructure(bad, "test")).toThrow("test");
    }
  });
});

describe("OdontogramSyncBridge M00 — strict recovery validation", () => {
  let client: MedCanvasApiClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockImportStatus.mockReset();
    mockGetStatusChart.mockReset();
    mockGetStatusChart.mockReturnValue({ version: "2.22", teeth: {} });
    mockStateListener = null;
    client = new MedCanvasApiClient({ baseUrl: "http://localhost:5000/api/v1" });
  });

  it("keeps the recovery lock when the verified snapshot is structurally invalid (no hydration attempted)", async () => {
    const bridge = await enterRecoveryLock(client, "enc-1");
    mockImportStatus.mockClear();

    // NOTE: null/undefined are NOT in this list — they mean "no verified chart
    // provided" and legitimately fall back to the stored rollback snapshot.
    const invalidSnapshots: unknown[] = [
      [],
      "not an object",
      { version: "x.y", teeth: {} },
      { version: "2.22" },
      { version: "2.22", teeth: { "99": {} } },
    ];
    for (const bad of invalidSnapshots) {
      expect(() => bridge.recoverChart(bad)).toThrow();
      expect(bridge.isLockedForRecovery()).toBe(true);
      expect(bridge.getStatus()).toBe("recovery-required");
    }

    // Hydration must never have been attempted with an invalid snapshot
    expect(mockImportStatus).not.toHaveBeenCalled();

    // After failed recovery, all clinical writes remain forbidden
    await expect(bridge.save()).rejects.toThrow("recovery-required");
    await expect(bridge.switchEncounter("enc-2")).rejects.toThrow("recovery-required");
    await expect(bridge.load()).rejects.toThrow("recovery-required");
  });

  it("keeps the recovery lock when hydration of the verified snapshot fails", async () => {
    const bridge = await enterRecoveryLock(client, "enc-1");
    mockImportStatus.mockImplementationOnce(() => {
      throw new Error("Verified chart is un-hydratable");
    });

    expect(() => bridge.recoverChart({ version: "2.22", teeth: {} })).toThrow("Failed to recover chart");
    expect(bridge.isLockedForRecovery()).toBe(true);
    expect(bridge.getStatus()).toBe("recovery-required");
  });

  it("recovers with 'idle' (not 'saved') without server metadata and autosave stays off by default", async () => {
    const bridge = await enterRecoveryLock(client, "enc-1");
    mockImportStatus.mockImplementationOnce(() => {});
    mockStateListener = null; // stopAutoSync detached it when the lock engaged

    bridge.recoverChart({ version: "2.22", teeth: {} });

    expect(bridge.isLockedForRecovery()).toBe(false);
    expect(bridge.getStatus()).toBe("idle");
    expect(bridge.getETag()).toBeNull();
    // Explicit policy: autosave resumption is opt-in — listener must stay detached
    expect(mockStateListener).toBeNull();
  });

  it("recovers to 'saved' with server metadata and re-attaches autosave only when explicitly requested", async () => {
    const bridge = await enterRecoveryLock(client, "enc-1");
    mockImportStatus.mockImplementationOnce(() => {});

    bridge.recoverChart({ version: "2.22", teeth: {} }, { resumeAutoSync: true, serverETag: '"7"', serverVersion: 7 });

    expect(bridge.getStatus()).toBe("saved");
    expect(bridge.getETag()).toBe('"7"');
    expect(mockStateListener).not.toBeNull();
  });
});

describe("OdontogramSyncBridge M00 — missing ETag is an error, never a fabricated tag", () => {
  let client: MedCanvasApiClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockImportStatus.mockReset();
    mockGetStatusChart.mockReset();
    mockGetStatusChart.mockReturnValue({ version: "2.22", teeth: {} });
    mockStateListener = null;
    client = new MedCanvasApiClient({ baseUrl: "http://localhost:5000/api/v1" });
  });

  it("load() rejects and stays error-free of fake concurrency state when the ETag header is missing", async () => {
    vi.spyOn(client, "getOdontogramByEncounter").mockResolvedValueOnce({
      odontogram: dtoFor("enc-1", { version: "2.22", teeth: {} }),
      etag: null as unknown as string,
    });
    const bridge = newBridge({ client, encounterId: "enc-1" });

    await expect(bridge.load()).rejects.toThrow("missing the required ETag header");
    expect(bridge.getStatus()).toBe("error");
    expect(bridge.getETag()).toBeNull();
  });

  it("save() retains dirty state and refuses a fabricated ETag when the response omits it", async () => {
    vi.spyOn(client, "saveOdontogram").mockResolvedValueOnce({
      odontogram: dtoFor("enc-1", { version: "2.22", teeth: {} }, 2),
      etag: null as unknown as string,
    });
    const bridge = newBridge({ client, encounterId: "enc-1" });

    await expect(bridge.save()).rejects.toThrow("missing the required ETag header");
    expect(bridge.getStatus()).toBe("error");
    expect(bridge.hasUnsavedChanges()).toBe(true);
    expect(bridge.getETag()).toBeNull();
  });

  it("switchEncounter() aborts before hydration when the target response omits the ETag", async () => {
    vi.spyOn(client, "getOdontogramByEncounter").mockResolvedValueOnce({
      odontogram: dtoFor("enc-B", { version: "2.22", teeth: {} }),
      etag: null as unknown as string,
    });
    const bridge = newBridge({ client, encounterId: "enc-A" });

    await expect(bridge.switchEncounter("enc-B")).rejects.toThrow("missing the required ETag header");
    expect(bridge.getEncounterId()).toBe("enc-A");
    expect(mockImportStatus).not.toHaveBeenCalled();
  });
});

describe("OdontogramSyncBridge M00 — structural validation at load/switch boundaries", () => {
  let client: MedCanvasApiClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockImportStatus.mockReset();
    mockGetStatusChart.mockReset();
    mockGetStatusChart.mockReturnValue({ version: "2.22", teeth: {} });
    mockStateListener = null;
    client = new MedCanvasApiClient({ baseUrl: "http://localhost:5000/api/v1" });
  });

  it("load() rejects a structurally invalid server snapshot before hydration", async () => {
    vi.spyOn(client, "getOdontogramByEncounter").mockResolvedValueOnce({
      odontogram: dtoFor("enc-1", { version: "2.22", teeth: { "0": {}, "110": {} } }),
      etag: '"1"',
    });
    const bridge = newBridge({ client, encounterId: "enc-1" });

    await expect(bridge.load()).rejects.toThrow("Odontogram load rejected");
    expect(bridge.getStatus()).toBe("error");
    expect(mockImportStatus).not.toHaveBeenCalled();
  });

  it("switchEncounter() rejects a structurally invalid target and preserves the active chart", async () => {
    vi.spyOn(client, "getOdontogramByEncounter").mockResolvedValueOnce({
      odontogram: dtoFor("enc-B", { version: "2.22", teeth: { "77": {} } }),
      etag: '"1"',
    });
    const bridge = newBridge({ client, encounterId: "enc-A" });

    await expect(bridge.switchEncounter("enc-B")).rejects.toThrow("Encounter switch rejected");
    expect(bridge.getEncounterId()).toBe("enc-A");
    expect(mockImportStatus).not.toHaveBeenCalled();
  });
});

describe("OdontogramSyncBridge M00 — edits during encounter switch are preserved", () => {
  let client: MedCanvasApiClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockImportStatus.mockReset();
    mockGetStatusChart.mockReset();
    mockGetStatusChart.mockReturnValue({ version: "2.22", teeth: {} });
    mockStateListener = null;
    client = new MedCanvasApiClient({ baseUrl: "http://localhost:5000/api/v1" });
  });

  it("aborts the switch when an edit lands during the target fetch, keeping chart, encounter, and edit", async () => {
    let resolveTarget: (val: unknown) => void = () => {};
    const targetFetch = new Promise((resolve) => {
      resolveTarget = resolve;
    });
    vi.spyOn(client, "getOdontogramByEncounter").mockImplementationOnce(() => targetFetch as Promise<{ odontogram: import("../../api/types").OdontogramResponseDto; etag?: string | null }>);
    const saveSpy = vi.spyOn(client, "saveOdontogram").mockResolvedValue({
      odontogram: dtoFor("enc-A", { version: "2.22", teeth: {} }, 2),
      etag: '"2"',
    });

    const bridge = newBridge({ client, encounterId: "enc-A", debounceMs: 5 });
    await bridge.save(); // establish clean saved baseline
    bridge.startAutoSync();

    const switchPromise = bridge.switchEncounter("enc-B");

    // An edit arrives while the target encounter is being fetched
    mockStateListener?.();
    expect(bridge.hasUnsavedChanges()).toBe(true);

    resolveTarget({ odontogram: dtoFor("enc-B", { version: "2.22", teeth: {} }), etag: '"1"' });
    await expect(switchPromise).rejects.toThrow("Encounter switch aborted");

    // Source encounter, chart, and the edit are all preserved; the target chart was never hydrated
    expect(bridge.getEncounterId()).toBe("enc-A");
    expect(mockImportStatus).not.toHaveBeenCalled();

    // Deferred autosave resumes once the switch window closes and saves under the SOURCE encounter
    await vi.waitFor(() => expect(saveSpy.mock.calls.some((c) => c[0] === "enc-A")).toBe(true));
    const sentToEncB = saveSpy.mock.calls.filter((c) => c[0] === "enc-B");
    expect(sentToEncB).toHaveLength(0);
  });

  it("rejects manual saves issued while a switch is in progress", async () => {
    let resolveTarget: (val: unknown) => void = () => {};
    const targetFetch = new Promise((resolve) => {
      resolveTarget = resolve;
    });
    vi.spyOn(client, "getOdontogramByEncounter").mockImplementationOnce(() => targetFetch as Promise<{ odontogram: import("../../api/types").OdontogramResponseDto; etag?: string | null }>);

    const bridge = newBridge({ client, encounterId: "enc-A" });
    const switchPromise = bridge.switchEncounter("enc-B");

    await expect(bridge.save("manual save during switch")).rejects.toThrow(
      "Cannot save while an encounter switch is in progress"
    );

    resolveTarget({ odontogram: dtoFor("enc-B", { version: "2.22", teeth: {} }), etag: '"1"' });
    await switchPromise;
    expect(bridge.getEncounterId()).toBe("enc-B");
  });
});

describe("OdontogramSyncBridge M00 — unload protection for unsaved edits", () => {
  let client: MedCanvasApiClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockImportStatus.mockReset();
    mockGetStatusChart.mockReset();
    mockGetStatusChart.mockReturnValue({ version: "2.22", teeth: {} });
    mockStateListener = null;
    client = new MedCanvasApiClient({ baseUrl: "http://localhost:5000/api/v1" });
  });

  it("warns on beforeunload only while unsaved edits exist", async () => {
    const saveSpy = vi.spyOn(client, "saveOdontogram").mockResolvedValue({
      odontogram: dtoFor("enc-1", { version: "2.22", teeth: {} }, 2),
      etag: '"2"',
    });
    const bridge = newBridge({ client, encounterId: "enc-1", debounceMs: 10_000 });

    // Clean bridge: no warning
    const cleanEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);

    // Dirty bridge: browser must warn the clinician
    bridge.startAutoSync();
    mockStateListener?.();
    const dirtyEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);

    bridge.destroy();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("flushes pending debounced edits on pagehide", async () => {
    const saveSpy = vi.spyOn(client, "saveOdontogram").mockResolvedValue({
      odontogram: dtoFor("enc-1", { version: "2.22", teeth: {} }, 2),
      etag: '"2"',
    });
    const bridge = newBridge({ client, encounterId: "enc-1", debounceMs: 60_000 });

    bridge.startAutoSync();
    mockStateListener?.(); // edit sits in the debounce window
    expect(bridge.hasUnsavedChanges()).toBe(true);

    window.dispatchEvent(new Event("pagehide"));

    await vi.waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    expect(saveSpy.mock.calls[0][0]).toBe("enc-1");
  });

  it("does not warn or flush after destroy()", async () => {
    const saveSpy = vi.spyOn(client, "saveOdontogram").mockResolvedValue({
      odontogram: dtoFor("enc-1", { version: "2.22", teeth: {} }, 2),
      etag: '"2"',
    });
    const bridge = newBridge({ client, encounterId: "enc-1" });
    bridge.startAutoSync();
    mockStateListener?.();
    bridge.destroy();

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    window.dispatchEvent(new Event("pagehide"));

    expect(event.defaultPrevented).toBe(false);
    expect(saveSpy).not.toHaveBeenCalled();
  });
});

describe("OdontogramSyncBridge M04 — conflict resolution", () => {
  let client: MedCanvasApiClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockImportStatus.mockReset();
    mockGetStatusChart.mockReset();
    mockGetStatusChart.mockReturnValue({ version: "2.22", teeth: {} });
    mockStateListener = null;
    client = new MedCanvasApiClient({ baseUrl: "http://localhost:5000/api/v1" });
  });

  it("adopts the server copy on explicit resolution and resumes autosave", async () => {
    const fresh = dtoFor("enc-1", { version: "2.22", teeth: { "11": { toothSelection: "implant" } } }, 7);
    const getSpy = vi.spyOn(client, "getOdontogramByEncounter")
      // conflict fresh-copy fetch
      .mockResolvedValueOnce({ odontogram: fresh, etag: '"7"' })
      // resolve fetch
      .mockResolvedValueOnce({ odontogram: fresh, etag: '"7"' });

    const bridge = newBridge({ client, encounterId: "enc-1" });
    bridge.startAutoSync();
    mockStateListener?.();

    // Enter conflict
    vi.spyOn(client, "saveOdontogram").mockRejectedValueOnce(new ConcurrencyConflictError("stale"));
    await expect(bridge.save()).rejects.toThrow(ConcurrencyConflictError);
    expect(bridge.getStatus()).toBe("conflict");
    expect(bridge.hasUnsavedChanges()).toBe(true);

    // Explicit resolution adopts the server copy
    mockImportStatus.mockImplementationOnce(() => {});
    await bridge.resolveConflictWithServerCopy();

    expect(bridge.getStatus()).toBe("saved");
    expect(bridge.getETag()).toBe('"7"');
    expect(mockImportStatus).toHaveBeenCalledWith(fresh.snapshotJson ? JSON.parse(fresh.snapshotJson) : expect.anything());
    expect(mockStateListener).not.toBeNull(); // autosave resumed
  });

  it("refuses resolution outside conflict state", async () => {
    const bridge = newBridge({ client, encounterId: "enc-1" });
    await expect(bridge.resolveConflictWithServerCopy()).rejects.toThrow("requires an active conflict state");
  });
});
