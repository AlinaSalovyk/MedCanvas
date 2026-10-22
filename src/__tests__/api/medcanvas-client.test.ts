import { describe, it, expect, vi, beforeEach } from "vitest";
import { MedCanvasApiClient, ApiError, ConcurrencyConflictError } from "../../api/client";

describe("MedCanvasApiClient", () => {
  let client: MedCanvasApiClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new MedCanvasApiClient({ baseUrl: "http://localhost:5000/api/v1" });
  });

  it("initializes with correct base URL and manages token", () => {
    expect(client.getToken()).toBeNull();

    client.setToken("sample-jwt-token");
    expect(client.getToken()).toBe("sample-jwt-token");

    client.logout();
    expect(client.getToken()).toBeNull();
  });

  it("handles login and sets bearer token on success", async () => {
    const mockAuthResponse = {
      token: "jwt-abc-123",
      expiresAtUtc: "2026-10-22T18:00:00Z",
      userId: "u-1",
      fullName: "Dr. Dentist",
      email: "dr@medcanvas.com",
      clinicId: "c-1",
      clinicName: "MedCanvas Clinic",
      role: "Clinician",
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockAuthResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await client.login({
      email: "dr@medcanvas.com",
      password: "Password123!",
      clinicId: "c-1",
    });

    expect(result.token).toBe("jwt-abc-123");
    expect(client.getToken()).toBe("jwt-abc-123");
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:5000/api/v1/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "dr@medcanvas.com",
          password: "Password123!",
          clinicId: "c-1",
        }),
      })
    );
  });

  it("invokes onUnauthorized callback when response status is 401", async () => {
    const onUnauthorized = vi.fn();
    const authedClient = new MedCanvasApiClient({
      baseUrl: "http://localhost:5000/api/v1",
      token: "expired-token",
      onUnauthorized,
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ title: "Unauthorized" }), { status: 401 })
    );

    await expect(authedClient.getCurrentUser()).rejects.toThrow(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("passes If-Match header and captures ETag on saveOdontogram", async () => {
    client.setToken("valid-token");

    const mockResponseDto = {
      id: "rec-1",
      clinicId: "c-1",
      patientId: "p-1",
      encounterId: "e-1",
      payloadVersion: "2.22",
      snapshotJson: `{"version":"2.22","teeth":{}}`,
      isFinalized: false,
      concurrencyVersion: 3,
      createdAtUtc: "2026-10-22T12:00:00Z",
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponseDto), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ETag: '"3"',
        },
      })
    );

    const result = await client.saveOdontogram(
      "e-1",
      {
        snapshotJson: `{"version":"2.22","teeth":{}}`,
        expectedVersion: 2,
        changeSummary: "Added caries to tooth 11",
      },
      '"2"'
    );

    expect(result.odontogram.concurrencyVersion).toBe(3);
    expect(result.etag).toBe('"3"');

    const calledHeaders = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(calledHeaders["If-Match"]).toBe('"2"');
    expect(calledHeaders["Authorization"]).toBe("Bearer valid-token");
  });

  it("throws ConcurrencyConflictError when server returns 412 Precondition Failed", async () => {
    client.setToken("valid-token");

    const conflictProblem = {
      type: "https://tools.ietf.org/html/rfc7232#section-4.2",
      title: "Precondition Failed",
      status: 412,
      detail: "The odontogram record concurrency version has changed.",
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(conflictProblem), {
        status: 412,
        headers: { "Content-Type": "application/problem+json" },
      })
    );

    await expect(
      client.saveOdontogram("e-1", { snapshotJson: "{}" }, '"1"')
    ).rejects.toThrow(ConcurrencyConflictError);
  });

  it("parses HL7 FHIR Bundle from encounter fhir endpoint", async () => {
    client.setToken("valid-token");

    const fhirBundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [{ resource: { resourceType: "Patient", id: "p-1" } }],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(fhirBundle), {
        status: 200,
        headers: { "Content-Type": "application/fhir+json" },
      })
    );

    const result = await client.getEncounterFhirBundle("e-1");
    expect(result).toEqual(fhirBundle);
  });
});

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

import { OdontogramSyncBridge } from "../../api/odontogramSync";

describe("OdontogramSyncBridge", () => {
  let client: MedCanvasApiClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockStateListener = null;
    mockGetStatusChart.mockReturnValue({ version: "2.22", teeth: {} });
    client = new MedCanvasApiClient({ baseUrl: "http://localhost:5000/api/v1" });
  });

  it("loads encounter state and transitions to saved without triggering autosave", async () => {
    const mockRemote = {
      id: "rec-1",
      clinicId: "c-1",
      patientId: "p-1",
      encounterId: "enc-1",
      payloadVersion: "2.22",
      snapshotJson: JSON.stringify({ version: "2.22", teeth: { "11": { toothSelection: "tooth-base" } } }),
      isFinalized: false,
      concurrencyVersion: 1,
      createdAtUtc: "2026-10-22T12:00:00Z",
    };

    vi.spyOn(client, "getOdontogramByEncounter").mockResolvedValueOnce({
      odontogram: mockRemote,
      etag: '"1"',
    });

    const statusChanges: string[] = [];
    const bridge = new OdontogramSyncBridge({
      client,
      encounterId: "enc-1",
      onStatusChange: (status) => statusChanges.push(status),
    });

    await bridge.load();

    expect(bridge.getStatus()).toBe("saved");
    expect(bridge.getETag()).toBe('"1"');
    expect(mockImportStatus).toHaveBeenCalledWith({
      version: "2.22",
      teeth: { "11": { toothSelection: "tooth-base" } },
    });
    expect(statusChanges).toEqual(["loading", "saved"]);
  });

  it("queues and serializes overlapping saves without parallel in-flight HTTP requests", async () => {
    let resolveFirstSave: (val: unknown) => void = () => {};
    const firstSavePromise = new Promise((resolve) => {
      resolveFirstSave = resolve;
    });

    const saveSpy = vi.spyOn(client, "saveOdontogram")
      // First save hangs until resolveFirstSave() is called
      .mockImplementationOnce(() => firstSavePromise as any)
      // Second queued save resolves immediately
      .mockResolvedValueOnce({
        odontogram: {
          id: "rec-1",
          clinicId: "c-1",
          patientId: "p-1",
          encounterId: "enc-1",
          payloadVersion: "2.22",
          snapshotJson: "{}",
          isFinalized: false,
          concurrencyVersion: 3,
          createdAtUtc: "2026-10-22T12:00:00Z",
        },
        etag: '"3"',
      });

    const bridge = new OdontogramSyncBridge({
      client,
      encounterId: "enc-1",
    });

    // Start first save (now in-flight)
    const savePromise1 = bridge.save("Change 1");
    expect(bridge.getStatus()).toBe("saving");
    expect(saveSpy).toHaveBeenCalledTimes(1);

    // Simultaneous second edit arrives chairside while first is in-flight
    const savePromise2 = bridge.save("Change 2");
    // At most 1 write in-flight: saveOdontogram should NOT have been called a second time yet!
    expect(saveSpy).toHaveBeenCalledTimes(1);

    // Resolve first save
    resolveFirstSave({
      odontogram: {
        id: "rec-1",
        clinicId: "c-1",
        patientId: "p-1",
        encounterId: "enc-1",
        payloadVersion: "2.22",
        snapshotJson: "{}",
        isFinalized: false,
        concurrencyVersion: 2,
        createdAtUtc: "2026-10-22T12:00:00Z",
      },
      etag: '"2"',
    });

    await Promise.all([savePromise1, savePromise2]);

    // Both saves completed serially, with the second taking version 2 and updating to version 3
    expect(saveSpy).toHaveBeenCalledTimes(2);
    expect(bridge.getStatus()).toBe("saved");
    expect(bridge.getETag()).toBe('"3"');
  });

  it("handles HTTP 412 ConcurrencyConflict by stopping autosync and calling onConflict", async () => {
    const conflictError = new ConcurrencyConflictError("Conflict: modified by another session.");
    vi.spyOn(client, "saveOdontogram").mockRejectedValueOnce(conflictError);

    const freshServerRecord = {
      id: "rec-1",
      clinicId: "c-1",
      patientId: "p-1",
      encounterId: "enc-1",
      payloadVersion: "2.22",
      snapshotJson: `{"version":"2.22","teeth":{}}`,
      isFinalized: false,
      concurrencyVersion: 5,
      createdAtUtc: "2026-10-22T12:00:00Z",
    };
    vi.spyOn(client, "getOdontogramByEncounter").mockResolvedValueOnce({
      odontogram: freshServerRecord,
      etag: '"5"',
    });

    const onConflict = vi.fn();
    const bridge = new OdontogramSyncBridge({
      client,
      encounterId: "enc-1",
      onConflict,
    });

    bridge.startAutoSync();

    await expect(bridge.save()).rejects.toThrow(ConcurrencyConflictError);

    expect(bridge.getStatus()).toBe("conflict");
    expect(onConflict).toHaveBeenCalledWith(freshServerRecord);

    // After conflict, further auto-save attempts are blocked
    expect(bridge.hasUnsavedChanges()).toBe(false);
  });

  it("safely flushes edits and reloads on encounter switch", async () => {
    vi.spyOn(client, "saveOdontogram").mockResolvedValueOnce({
      odontogram: {
        id: "rec-1",
        clinicId: "c-1",
        patientId: "p-1",
        encounterId: "enc-1",
        payloadVersion: "2.22",
        snapshotJson: "{}",
        isFinalized: false,
        concurrencyVersion: 2,
        createdAtUtc: "2026-10-22T12:00:00Z",
      },
      etag: '"2"',
    });

    vi.spyOn(client, "getOdontogramByEncounter").mockResolvedValueOnce({
      odontogram: {
        id: "rec-2",
        clinicId: "c-1",
        patientId: "p-1",
        encounterId: "enc-2",
        payloadVersion: "2.22",
        snapshotJson: "{}",
        isFinalized: false,
        concurrencyVersion: 1,
        createdAtUtc: "2026-10-22T12:00:00Z",
      },
      etag: '"1"',
    });

    const bridge = new OdontogramSyncBridge({
      client,
      encounterId: "enc-1",
    });

    bridge.startAutoSync();
    // Trigger an edit
    mockStateListener?.();

    await bridge.switchEncounter("enc-2");

    expect(bridge.getEncounterId()).toBe("enc-2");
    expect(bridge.getStatus()).toBe("saved");
    expect(bridge.getETag()).toBe('"1"');
  });

  it("properly tears down when destroy() is invoked", async () => {
    const bridge = new OdontogramSyncBridge({
      client,
      encounterId: "enc-1",
    });

    bridge.startAutoSync();
    expect(mockStateListener).not.toBeNull();

    bridge.destroy();
    expect(mockStateListener).toBeNull();
    expect(bridge.hasUnsavedChanges()).toBe(false);

    await expect(bridge.save()).rejects.toThrow("disposed");
  });
});

