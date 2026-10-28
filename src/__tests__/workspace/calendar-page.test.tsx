/**
 * M03 calendar tests: week/day render with appointment cards, status filter,
 * booking dialog flow (patient search → book), lifecycle actions, and admin
 * chairs/availability wiring — against contract-accurate mocked API calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MedCanvasApiClient } from "../../api/client";
import type { AppointmentDto, ChairDto } from "../../api/types";
import { AuthProvider } from "../../workspace/AuthContext";
import { WorkspaceApp } from "../../workspace/WorkspaceApp";

function thisWeeksMonday(): Date {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diff = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  date.setUTCHours(9, 0, 0, 0);
  return date;
}

function appointmentDto(overrides: Partial<AppointmentDto> = {}): AppointmentDto {
  const start = thisWeeksMonday();
  const end = new Date(start.getTime() + 30 * 60000);
  return {
    id: "appt-1",
    clinicId: "c-1",
    patientId: "p-1",
    patientFullName: "Олена Коваленко",
    clinicianUserId: "u-doc",
    clinicianFullName: "Dr. Sched",
    chairId: "ch-1",
    chairName: "Chair 1",
    startAtUtc: start.toISOString(),
    endAtUtc: end.toISOString(),
    status: "Scheduled",
    reasonForVisit: "Checkup",
    internalNote: null,
    cancellationReason: null,
    concurrencyVersion: 1,
    createdAtUtc: "2026-10-25T10:00:00Z",
    updatedAtUtc: "2026-10-25T10:00:00Z",
    ...overrides,
  };
}

const chairs: ChairDto[] = [
  { id: "ch-1", clinicId: "c-1", name: "Chair 1", isActive: true },
];

const members = [
  { userId: "u-1", email: "admin@clinic.example", fullName: "Адмін", role: "ClinicAdmin", membershipActive: true, userActive: true, memberSinceUtc: "2026-10-01T00:00:00Z" },
  { userId: "u-doc", email: "doc@clinic.example", fullName: "Dr. Sched", role: "Clinician", membershipActive: true, userActive: true, memberSinceUtc: "2026-10-01T00:00:00Z" },
];

function renderWorkspace(): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/calendar"]}>
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
  fireEvent.click(screen.getByRole("link", { name: /Календар|Calendar/ }));
  await waitFor(() => expect(screen.getByRole("heading", { name: /Календар прийомів|Appointment calendar/ })).toBeTruthy(), { timeout: 5000 });
}

describe("Calendar page (M03)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(MedCanvasApiClient.prototype, "getClinicSettings").mockResolvedValue({
      clinicId: "c-1", name: "Clinic One", identifier: "ONE", timeZoneId: "Europe/Kyiv",
    });
    for (const m of [
      "login",
      "getMyClinics",
      "getClinicMembers",
      "getAppointments",
      "getChairs",
      "getPatients",
      "createAppointment",
      "appointmentAction",
      "cancelAppointment",
    ] as const) {
      vi.spyOn(MedCanvasApiClient.prototype, m);
    }
    localStorage.removeItem("medcanvas.workspace.lang");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem("medcanvas.workspace.lang");
  });

  it("renders the week view with appointment cards and filters wired", async () => {
    vi.mocked(MedCanvasApiClient.prototype.getMyClinics).mockResolvedValue([]);
    vi.mocked(MedCanvasApiClient.prototype.getClinicMembers).mockResolvedValue(members);
    vi.mocked(MedCanvasApiClient.prototype.getChairs).mockResolvedValue(chairs);
    const getAppointments = vi.mocked(MedCanvasApiClient.prototype.getAppointments);
    getAppointments.mockResolvedValue([appointmentDto()]);

    await loginAs();

    await waitFor(() => expect(screen.getByText("Олена Коваленко")).toBeTruthy());
    expect(screen.getByText(/Dr\. Sched · Chair 1/)).toBeTruthy();
    expect(screen.getAllByText("Заплановано").length).toBeGreaterThan(1);
    const requested = getAppointments.mock.calls[getAppointments.mock.calls.length - 1][0]!;
    const localClock = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Kyiv", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    expect(localClock.format(new Date(requested.fromUtc))).toBe("00:00");
    expect(localClock.format(new Date(requested.toUtc))).toBe("00:00");

    // Status filter propagates
    fireEvent.change(screen.getByLabelText(/Статус|Status/, { selector: "select" }), { target: { value: "Confirmed" } });
    await waitFor(() =>
      expect(getAppointments).toHaveBeenLastCalledWith(expect.objectContaining({ status: "Confirmed" }))
    );
  });

  it("books an appointment through the dialog: patient search → book", async () => {
    vi.mocked(MedCanvasApiClient.prototype.getMyClinics).mockResolvedValue([]);
    vi.mocked(MedCanvasApiClient.prototype.getClinicMembers).mockResolvedValue(members);
    vi.mocked(MedCanvasApiClient.prototype.getChairs).mockResolvedValue(chairs);
    vi.mocked(MedCanvasApiClient.prototype.getAppointments).mockResolvedValue([]);
    const getPatients = vi.mocked(MedCanvasApiClient.prototype.getPatients);
    getPatients.mockResolvedValue({
      items: [
        {
          id: "p-1",
          clinicId: "c-1",
          firstName: "Олена",
          lastName: "Коваленко",
          fullName: "Олена Коваленко",
          dateOfBirth: null,
          gender: null,
          phone: null,
          email: null,
          externalMedicalRecordNumber: "MRN-1",
          medicalAlerts: null,
          isActive: true,
          concurrencyVersion: 1,
          createdAtUtc: "2026-10-01T00:00:00Z",
        },
      ],
      pageNumber: 1,
      pageSize: 8,
      totalCount: 1,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });
    const create = vi.mocked(MedCanvasApiClient.prototype.createAppointment);
    create.mockResolvedValue(appointmentDto());

    await loginAs();

    await waitFor(() => expect(screen.getByRole("button", { name: /Записати|Book/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Записати|Book/ }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeTruthy();

    const searchInput = dialog.querySelectorAll("input")[0] as HTMLInputElement;
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "Коваленко" } });
    });
    fireEvent.click(screen.getByRole("button", { name: /Пошук пацієнтів|Search patients/ }));

    const clinicianSelect = within(dialog).getAllByLabelText(/Лікар|Clinician/, { selector: "select" })[0] as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(clinicianSelect, { target: { value: "u-doc" } });
    });

    const patientSelect = await screen.findByLabelText(/Пацієнт|Patient/, { selector: "select" });
    await act(async () => {
      fireEvent.change(patientSelect, { target: { value: "p-1" } });
    });

    const reasonInput = dialog.querySelectorAll("input")[dialog.querySelectorAll("input").length - 1] as HTMLInputElement;
    await act(async () => {
      fireEvent.change(reasonInput, { target: { value: "Первинний огляд" } });
    });

    await act(async () => {
      fireEvent.submit(within(dialog).getByRole("button", { name: /^Записати$|^Book$/ }).closest("form")!);
    });

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0].patientId).toBe("p-1");
    expect(create.mock.calls[0][0].clinicianUserId).toBe("u-doc");
    expect(create.mock.calls[0][0].chairId).toBe("ch-1");
    expect(create.mock.calls[0][0].reasonForVisit).toBe("Первинний огляд");
  });

  it("runs lifecycle actions from the appointment card", async () => {
    vi.mocked(MedCanvasApiClient.prototype.getMyClinics).mockResolvedValue([]);
    vi.mocked(MedCanvasApiClient.prototype.getClinicMembers).mockResolvedValue(members);
    vi.mocked(MedCanvasApiClient.prototype.getChairs).mockResolvedValue(chairs);
    vi.mocked(MedCanvasApiClient.prototype.getAppointments).mockResolvedValue([appointmentDto()]);
    const action = vi.mocked(MedCanvasApiClient.prototype.appointmentAction);
    action.mockResolvedValue(appointmentDto({ status: "Confirmed" }));

    await loginAs();
    await waitFor(() => expect(screen.getByText("Олена Коваленко")).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Підтвердити|Confirm/ }));
    });

    await waitFor(() => expect(action).toHaveBeenCalledWith("appt-1", "confirm"));
  });

  it("hides booking and actions from Viewers", async () => {
    vi.mocked(MedCanvasApiClient.prototype.getMyClinics).mockResolvedValue([]);
    vi.mocked(MedCanvasApiClient.prototype.getClinicMembers).mockResolvedValue(members);
    vi.mocked(MedCanvasApiClient.prototype.getChairs).mockResolvedValue(chairs);
    vi.mocked(MedCanvasApiClient.prototype.getAppointments).mockResolvedValue([appointmentDto()]);

    await loginAs("Viewer");

    await waitFor(() => expect(screen.getByText("Олена Коваленко")).toBeTruthy());
    expect(screen.queryByRole("button", { name: /Записати|Book/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Підтвердити|Confirm/ })).toBeNull();
  });
});
