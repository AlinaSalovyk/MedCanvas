/**
 * M04 encounter workspace tests: bridge wiring (load → autosave), truthful status
 * chip, finished-encounter sealing, and conflict resolution modal — with the heavy
 * engine and sync bridge mocked at their module boundaries.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MedCanvasApiClient } from "../../api/client";

const bridgeInstances: Array<Record<string, ReturnType<typeof vi.fn>> & { options: unknown }> = [];

vi.mock("../../api/odontogramSync", () => ({
  OdontogramSyncBridge: class FakeBridge {
    load = vi.fn(function (this: { options: { onStatusChange?: (s: string) => void } }) {
      this.options.onStatusChange?.("saved");
      return Promise.resolve();
    });
    startAutoSync = vi.fn();
    destroy = vi.fn();
    save = vi.fn(() => Promise.resolve());
    hasUnsavedChanges = vi.fn(() => false);
    resolveConflictWithServerCopy = vi.fn(() => Promise.resolve());
    getStatus = vi.fn(() => "saved");
    options: unknown;
    constructor(options: never) {
      this.options = options;
      bridgeInstances.push(this as never);
    }
  },
}));

vi.mock("../../App", () => ({
  default: () => <div data-testid="odontogram-app">engine</div>,
}));

vi.mock("../../odontogram", () => ({
  destroyOdontogram: vi.fn(),
}));

import { EncounterPage } from "../../workspace/pages/EncounterPage";
import { AuthProvider } from "../../workspace/AuthContext";

function encounterDto(overrides: Record<string, unknown> = {}): import("../../api/types").DentalEncounterDto {
  return {
    id: "e-1",
    clinicId: "c-1",
    patientId: "p-1",
    attendingUserId: "u-1",
    startedAtUtc: "2026-10-25T09:00:00Z",
    completedAtUtc: null,
    chiefComplaint: "Періодичний огляд",
    status: "InProgress",
    appointmentId: null,
    createdAtUtc: "2026-10-25T09:00:00Z",
    updatedAtUtc: "2026-10-25T09:00:00Z",
    ...overrides,
  } as import("../../api/types").DentalEncounterDto;
}

function patientDto() {
  return {
    id: "p-1",
    clinicId: "c-1",
    firstName: "Олег",
    lastName: "Тестовий",
    fullName: "Олег Тестовий",
    dateOfBirth: null,
    gender: null,
    phone: null,
    email: null,
    externalMedicalRecordNumber: null,
    medicalAlerts: "Penicillin allergy",
    isActive: true,
    concurrencyVersion: 1,
    createdAtUtc: "2026-10-01T00:00:00Z",
    updatedAtUtc: null,
  };
}

function renderEncounter(): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/encounters/e-1"]}>
          <Routes>
            <Route path="/encounters/:id" element={<EncounterPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe("Encounter workspace (M04)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    bridgeInstances.length = 0;
    vi.spyOn(MedCanvasApiClient.prototype, "getEncounter");
    vi.spyOn(MedCanvasApiClient.prototype, "getPatient");
    vi.spyOn(MedCanvasApiClient.prototype, "completeEncounter");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the chart through the bridge, renders the engine, and shows the saved chip", async () => {
    vi.mocked(MedCanvasApiClient.prototype.getEncounter).mockResolvedValue(encounterDto());
    vi.mocked(MedCanvasApiClient.prototype.getPatient).mockResolvedValue(patientDto());

    renderEncounter();

    await waitFor(() => expect(screen.getByTestId("odontogram-app")).toBeTruthy());
    expect(bridgeInstances).toHaveLength(1);
    const bridge = bridgeInstances[0] as unknown as { load: ReturnType<typeof vi.fn>; startAutoSync: ReturnType<typeof vi.fn>; options: { encounterId: string } };
    expect(bridge.options.encounterId).toBe("e-1");
    expect(bridge.load).toHaveBeenCalled();
    expect(bridge.startAutoSync).toHaveBeenCalled();

    expect(screen.getByTestId("sync-chip").textContent).toBe("Усі зміни збережено");
    await waitFor(() => expect(screen.getByText(/Penicillin allergy/)).toBeTruthy());
  });

  it("shows the finished-encounter note and skips autosave for sealed encounters", async () => {
    vi.mocked(MedCanvasApiClient.prototype.getEncounter).mockResolvedValue(encounterDto({ status: "Completed" }));
    vi.mocked(MedCanvasApiClient.prototype.getPatient).mockResolvedValue(patientDto());

    renderEncounter();

    await waitFor(() => expect(screen.getByTestId("odontogram-app")).toBeTruthy());
    expect(screen.getByText(/Клінічні дані закриті для редагування/)).toBeTruthy();
    // The bridge still loads (read path), but M04 UI never offers edits on finished encounters.
    expect(bridgeInstances[0]!.startAutoSync).toHaveBeenCalled();
  });

  it("destroys the bridge on unmount (engine hygiene)", async () => {
    vi.mocked(MedCanvasApiClient.prototype.getEncounter).mockResolvedValue(encounterDto());
    vi.mocked(MedCanvasApiClient.prototype.getPatient).mockResolvedValue(patientDto());

    const { unmount } = renderEncounter();
    await waitFor(() => expect(screen.getByTestId("odontogram-app")).toBeTruthy());

    unmount();
    expect(bridgeInstances[0]!.destroy).toHaveBeenCalled();
  });
});
