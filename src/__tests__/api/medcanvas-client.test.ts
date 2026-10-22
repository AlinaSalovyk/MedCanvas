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
