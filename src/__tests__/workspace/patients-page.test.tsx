/**
 * M02 Patient 360 tests: list/search/sort controls, create form with duplicate
 * warning, edit carrying the concurrency version, archive/restore actions,
 * Viewer read-only gating, and the patient detail card.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MedCanvasApiClient } from "../../api/client";
import type { PatientDto, PagedResult } from "../../api/types";
import { AuthProvider } from "../../workspace/AuthContext";
import { WorkspaceApp } from "../../workspace/WorkspaceApp";

function patientDto(overrides: Partial<PatientDto> = {}): PatientDto {
  return {
    id: "p-1",
    clinicId: "c-1",
    firstName: "Олена",
    lastName: "Коваленко",
    fullName: "Олена Коваленко",
    dateOfBirth: "1990-05-14",
    gender: "Female",
    phone: "+380501234567",
    email: "olena@example.com",
    externalMedicalRecordNumber: "MRN-001",
    medicalAlerts: "Penicillin allergy",
    isActive: true,
    concurrencyVersion: 1,
    createdAtUtc: "2026-10-20T10:00:00Z",
    updatedAtUtc: "2026-10-20T10:00:00Z",
    ...overrides,
  };
}

function paged(items: PatientDto[], page = 1, totalPages = 1): PagedResult<PatientDto> {
  return {
    items,
    pageNumber: page,
    pageSize: 10,
    totalCount: items.length,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}

function renderWorkspace(initialPath = "/patients"): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <WorkspaceApp />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

async function loginAs(role = "ClinicAdmin"): Promise<void> {
  renderWorkspace();
  fireEvent.change(screen.getByLabelText(/Електронна пошта|Email/), { target: { value: "admin@clinic.example" } });
  fireEvent.change(screen.getByLabelText(/Пароль|Password/), { target: { value: "StrongP@ssw0rd123!" } });
  vi.mocked(MedCanvasApiClient.prototype.login).mockResolvedValueOnce({
    requiresClinicSelection: false,
    clinics: [],
    token: "jwt",
    expiresAtUtc: "2099-01-01T00:00:00Z",
    userId: "u-1",
    email: "admin@clinic.example",
    fullName: "Адмін",
    clinicId: "c-1",
    clinicName: "Clinic One",
    role,
  } as never);
  fireEvent.submit(screen.getByRole("button", { name: /Увійти|Sign in/ }).closest("form")!);
  await waitFor(() => expect(screen.getByTestId("active-clinic")).toBeTruthy());
  // Login lands on the index route (staff); walk to the patients page via the nav.
  fireEvent.click(screen.getByRole("link", { name: /Пацієнти|Patients/ }));
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: /Пацієнти|Patients/ })).toBeTruthy()
  );
}

describe("Patients page (M02)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(MedCanvasApiClient.prototype, "login");
    vi.spyOn(MedCanvasApiClient.prototype, "getMyClinics");
    vi.spyOn(MedCanvasApiClient.prototype, "getClinicMembers");
    vi.spyOn(MedCanvasApiClient.prototype, "getPatients");
    vi.spyOn(MedCanvasApiClient.prototype, "getPatient");
    vi.spyOn(MedCanvasApiClient.prototype, "getPatientEncounters");
    vi.spyOn(MedCanvasApiClient.prototype, "getLatestOdontogramByPatient");
    vi.spyOn(MedCanvasApiClient.prototype, "getPatientDuplicates");
    vi.spyOn(MedCanvasApiClient.prototype, "createPatient");
    vi.spyOn(MedCanvasApiClient.prototype, "updatePatient");
    vi.spyOn(MedCanvasApiClient.prototype, "archivePatient");
    vi.spyOn(MedCanvasApiClient.prototype, "restorePatient");
    localStorage.removeItem("medcanvas.workspace.lang");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem("medcanvas.workspace.lang");
  });

  it("lists patients with search, sort, and archived filter wired to the API", async () => {
    vi.mocked(MedCanvasApiClient.prototype.getMyClinics).mockResolvedValue([]);
    const getPatients = vi.mocked(MedCanvasApiClient.prototype.getPatients);
    getPatients.mockResolvedValue(paged([patientDto()]));

    await loginAs();

    await waitFor(() => expect(screen.getByText("Олена Коваленко")).toBeTruthy());
    expect(getPatients).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 1, sortBy: "lastname" }));

    // Search submits a trimmed term and resets the page
    fireEvent.change(screen.getByLabelText(/Пошук пацієнтів/), { target: { value: "Коваленко" } });
    await act(async () => {
      fireEvent.submit(screen.getByLabelText(/Пошук пацієнтів/).closest("form")!);
    });
    await waitFor(() =>
      expect(getPatients).toHaveBeenLastCalledWith(expect.objectContaining({ searchTerm: "Коваленко" }))
    );

    // Archived filter toggles the query
    fireEvent.click(screen.getByRole("checkbox", { name: /Показати архівних/ }));
    await waitFor(() =>
      expect(getPatients).toHaveBeenLastCalledWith(expect.objectContaining({ includeArchived: true }))
    );
  });

  it("creates a patient and warns about duplicates without blocking", async () => {
    vi.mocked(MedCanvasApiClient.prototype.getMyClinics).mockResolvedValue([]);
    vi.mocked(MedCanvasApiClient.prototype.getPatients)
      .mockResolvedValueOnce(paged([]))
      .mockResolvedValueOnce(paged([patientDto()]));
    const duplicates = vi.mocked(MedCanvasApiClient.prototype.getPatientDuplicates);
    duplicates.mockResolvedValue([patientDto({ id: "p-x", firstName: "Олена", lastName: "Дублікат" })]);
    const create = vi.mocked(MedCanvasApiClient.prototype.createPatient);
    create.mockResolvedValue(patientDto());

    await loginAs();

    fireEvent.click(screen.getByRole("button", { name: /Додати пацієнта/ }));
    fireEvent.change(screen.getAllByLabelText(/Імʼя/)[0], { target: { value: "Олена" } });
    fireEvent.change(screen.getAllByLabelText(/Прізвище/)[0], { target: { value: "Коваленко" } });
    fireEvent.change(screen.getAllByLabelText(/Дата народження/)[0], { target: { value: "1990-05-14" } });
    fireEvent.blur(screen.getAllByLabelText(/Прізвище/)[0]);

    await waitFor(() => expect(screen.getByText(/Можливі дублікати/)).toBeTruthy());

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /Зберегти/ }).closest("form")!);
    });

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0].firstName).toBe("Олена");
  });

  it("edits a patient carrying its concurrency version", async () => {
    vi.mocked(MedCanvasApiClient.prototype.getMyClinics).mockResolvedValue([]);
    const existing = patientDto({ concurrencyVersion: 4 });
    vi.mocked(MedCanvasApiClient.prototype.getPatients).mockResolvedValue(paged([existing]));
    const update = vi.mocked(MedCanvasApiClient.prototype.updatePatient);
    update.mockResolvedValue(patientDto({ concurrencyVersion: 5 }));

    await loginAs();
    await waitFor(() => expect(screen.getByText("Олена Коваленко")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /^Редагувати$/ }));
    const phoneInput = screen.getAllByLabelText(/Телефон/)[0];
    await act(async () => {
      fireEvent.change(phoneInput, { target: { value: "+380997776655" } });
    });

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /Зберегти/ }).closest("form")!);
    });

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][1].phone).toBe("+380997776655");
    expect(update.mock.calls[0][2]).toBe(4);
  });

  it("archives and restores a patient from the list", async () => {
    vi.mocked(MedCanvasApiClient.prototype.getMyClinics).mockResolvedValue([]);
    vi.mocked(MedCanvasApiClient.prototype.getPatients)
      .mockResolvedValueOnce(paged([patientDto()]))
      .mockResolvedValueOnce(paged([patientDto({ isActive: false })]))
      .mockResolvedValueOnce(paged([patientDto({ isActive: true })]));
    const archive = vi.mocked(MedCanvasApiClient.prototype.archivePatient);
    archive.mockResolvedValue(patientDto({ isActive: false }));
    const restore = vi.mocked(MedCanvasApiClient.prototype.restorePatient);
    restore.mockResolvedValue(patientDto());
    window.confirm = vi.fn(() => true);

    await loginAs();
    await waitFor(() => expect(screen.getByText("Олена Коваленко")).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Архівувати/ }));
    });
    await waitFor(() => expect(archive).toHaveBeenCalledWith("p-1"));

    await waitFor(() => expect(screen.getByRole("button", { name: /Відновити/ })).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Відновити/ }));
    });
    await waitFor(() => expect(restore).toHaveBeenCalledWith("p-1"));
  });

  it("hides mutation controls from the Viewer role", async () => {
    vi.mocked(MedCanvasApiClient.prototype.getMyClinics).mockResolvedValue([]);
    vi.mocked(MedCanvasApiClient.prototype.getPatients).mockResolvedValue(paged([patientDto()]));

    await loginAs("Viewer");

    await waitFor(() => expect(screen.getByText("Олена Коваленко")).toBeTruthy());
    expect(screen.queryByRole("button", { name: /Додати пацієнта/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Архівувати/ })).toBeNull();
  });

  it("shows the detail card with history and latest-chart metadata", async () => {
    vi.mocked(MedCanvasApiClient.prototype.getMyClinics).mockResolvedValue([]);
    vi.mocked(MedCanvasApiClient.prototype.getPatients).mockResolvedValue(paged([patientDto()]));
    vi.mocked(MedCanvasApiClient.prototype.getPatient).mockResolvedValue(patientDto());
    vi.mocked(MedCanvasApiClient.prototype.getPatientEncounters).mockResolvedValue([
      {
        id: "e-1",
        clinicId: "c-1",
        patientId: "p-1",
        attendingUserId: "u-1",
        startedAtUtc: "2026-10-21T09:00:00Z",
        chiefComplaint: "Періодичний огляд",
        status: "Completed",
      },
    ]);
    vi.mocked(MedCanvasApiClient.prototype.getLatestOdontogramByPatient).mockResolvedValue({
      odontogram: {
        id: "rec-1",
        clinicId: "c-1",
        patientId: "p-1",
        encounterId: "e-1",
        payloadVersion: "2.22",
        snapshotJson: "{}",
        isFinalized: false,
        concurrencyVersion: 3,
        createdAtUtc: "2026-10-21T09:30:00Z",
        updatedAtUtc: "2026-10-21T09:30:00Z",
      },
      etag: '"3"',
    });

    await loginAs();
    const patientLink = await screen.findByRole("link", { name: /Олена Коваленко/ });
    fireEvent.click(patientLink);

    await waitFor(() => expect(screen.getByText("Penicillin allergy")).toBeTruthy());
    expect(screen.getByText("Періодичний огляд")).toBeTruthy();
    expect(screen.getByText("Завершений")).toBeTruthy();
    expect(screen.getByText("2.22 · v3")).toBeTruthy();
  });
});
