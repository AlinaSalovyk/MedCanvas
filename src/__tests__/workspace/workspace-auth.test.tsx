/**
 * M01 workspace tests (RTL): route guards, login flows (auto-select, clinic
 * selection, failure), role gating, clinic switching with cache isolation,
 * staff CRUD surfacing, and i18n — against contract-accurate mocked API calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MedCanvasApiClient } from "../../api/client";
import type { LoginResult, ClinicMemberDto, ClinicMembershipSummary } from "../../api/types";
import { AuthProvider } from "../../workspace/AuthContext";
import { WorkspaceApp } from "../../workspace/WorkspaceApp";

function authedLogin(overrides: Partial<LoginResult> = {}): LoginResult {
  return {
    requiresClinicSelection: false,
    clinics: [],
    token: "jwt-token",
    expiresAtUtc: "2026-10-25T12:00:00Z",
    userId: "u-1",
    email: "admin@clinic.example",
    fullName: "Адмін Клініки",
    clinicId: "c-1",
    clinicName: "Clinic One",
    role: "ClinicAdmin",
    ...overrides,
  };
}

const members: ClinicMemberDto[] = [
  {
    userId: "u-1",
    email: "admin@clinic.example",
    fullName: "Адмін Клініки",
    role: "ClinicAdmin",
    membershipActive: true,
    userActive: true,
    memberSinceUtc: "2026-10-01T00:00:00Z",
  },
  {
    userId: "u-2",
    email: "doc@clinic.example",
    fullName: "Лікар Лікаренко",
    role: "Clinician",
    membershipActive: true,
    userActive: true,
    memberSinceUtc: "2026-10-02T00:00:00Z",
  },
];

function renderWorkspace(initialPath = "/"): ReturnType<typeof render> {
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

async function loginThroughUi(role = "ClinicAdmin"): Promise<void> {
  renderWorkspace();
  fireEvent.change(screen.getByLabelText(/Електронна пошта|Email/), { target: { value: "admin@clinic.example" } });
  fireEvent.change(screen.getByLabelText(/Пароль|Password/), { target: { value: "StrongP@ssw0rd123!" } });
  const loginMock = vi.mocked(MedCanvasApiClient.prototype.login);
  loginMock.mockResolvedValueOnce(authedLogin({ role }));
  fireEvent.submit(screen.getByRole("button", { name: /Увійти|Sign in/ }).closest("form")!);
  await waitFor(() => expect(screen.getByTestId("active-clinic")).toBeTruthy());
}

describe("Workspace M01", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(MedCanvasApiClient.prototype, "login");
    vi.spyOn(MedCanvasApiClient.prototype, "getMyClinics");
    vi.spyOn(MedCanvasApiClient.prototype, "switchClinic");
    vi.spyOn(MedCanvasApiClient.prototype, "getClinicMembers");
    vi.spyOn(MedCanvasApiClient.prototype, "addClinicMember");
    localStorage.removeItem("medcanvas.workspace.lang");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem("medcanvas.workspace.lang");
  });

  it("redirects unauthenticated visitors to the login screen", () => {
    renderWorkspace("/");

    expect(screen.getByText("Вхід до MedCanvas")).toBeTruthy();
    expect(screen.queryByTestId("active-clinic")).toBeNull();
  });

  it("logs in, lands in the workspace, and lists staff", async () => {
    const membersMock = vi.mocked(MedCanvasApiClient.prototype.getClinicMembers);
    membersMock.mockResolvedValue(members);
    vi.mocked(MedCanvasApiClient.prototype.getMyClinics).mockResolvedValue([
      { clinicId: "c-1", clinicName: "Clinic One", clinicIdentifier: "C1", role: "ClinicAdmin" },
    ]);

    await loginThroughUi();

    expect(screen.getByTestId("active-clinic").textContent).toBe("Clinic One");
    await waitFor(() => expect(screen.getByText("doc@clinic.example")).toBeTruthy());
    expect(membersMock).toHaveBeenCalled();
  });

  it("asks for clinic selection when the account has several memberships", async () => {
    renderWorkspace();
    const choices: ClinicMembershipSummary[] = [
      { clinicId: "c-1", clinicName: "Clinic One", clinicIdentifier: "C1", role: "ClinicAdmin" },
      { clinicId: "c-2", clinicName: "Clinic Two", clinicIdentifier: "C2", role: "Clinician" },
    ];
    const loginMock = vi.mocked(MedCanvasApiClient.prototype.login);
    loginMock.mockResolvedValueOnce({ requiresClinicSelection: true, clinics: choices, token: null });

    fireEvent.change(screen.getByLabelText(/Електронна пошта|Email/), { target: { value: "multi@example.com" } });
    fireEvent.change(screen.getByLabelText(/Пароль|Password/), { target: { value: "StrongP@ssw0rd123!" } });
    fireEvent.submit(screen.getByRole("button", { name: /Увійти|Sign in/ }).closest("form")!);

    await waitFor(() => expect(screen.getByText("Виберіть клініку")).toBeTruthy());
    expect(screen.getByRole("button", { name: /Clinic Two/ })).toBeTruthy();

    loginMock.mockResolvedValueOnce(authedLogin({ clinicId: "c-2", clinicName: "Clinic Two", role: "Clinician" }));
    vi.mocked(MedCanvasApiClient.prototype.getMyClinics).mockResolvedValue(choices);
    vi.mocked(MedCanvasApiClient.prototype.getClinicMembers).mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: /Clinic Two/ }));

    await waitFor(() => expect(screen.getByTestId("active-clinic").textContent).toBe("Clinic Two"));
  });

  it("shows an error message on invalid credentials and stays on login", async () => {
    renderWorkspace();
    vi.mocked(MedCanvasApiClient.prototype.login).mockRejectedValueOnce(new Error("401"));

    fireEvent.change(screen.getByLabelText(/Електронна пошта|Email/), { target: { value: "admin@clinic.example" } });
    fireEvent.change(screen.getByLabelText(/Пароль|Password/), { target: { value: "wrong" } });
    fireEvent.submit(screen.getByRole("button", { name: /Увійти|Sign in/}).closest("form")!);

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.queryByTestId("active-clinic")).toBeNull();
  });

  it("denies the staff page to non-admin roles", async () => {
    vi.mocked(MedCanvasApiClient.prototype.getMyClinics).mockResolvedValue([]);
    await loginThroughUi("Clinician");

    await waitFor(() => expect(screen.getByText("Доступ обмежено")).toBeTruthy());
    expect(vi.mocked(MedCanvasApiClient.prototype.getClinicMembers)).not.toHaveBeenCalled();
  });

  it("switches clinics through the switcher and refreshes the active clinic", async () => {
    const choices: ClinicMembershipSummary[] = [
      { clinicId: "c-1", clinicName: "Clinic One", clinicIdentifier: "C1", role: "ClinicAdmin" },
      { clinicId: "c-2", clinicName: "Clinic Two", clinicIdentifier: "C2", role: "ClinicAdmin" },
    ];
    vi.mocked(MedCanvasApiClient.prototype.getMyClinics).mockResolvedValue(choices);
    vi.mocked(MedCanvasApiClient.prototype.getClinicMembers).mockResolvedValue([]);
    vi.mocked(MedCanvasApiClient.prototype.switchClinic).mockResolvedValue(
      authedLogin({ clinicId: "c-2", clinicName: "Clinic Two" })
    );

    await loginThroughUi();

    const switcher = await screen.findByLabelText(/Змінити клініку/);
    await act(async () => {
      fireEvent.change(switcher, { target: { value: "c-2" } });
    });

    expect(vi.mocked(MedCanvasApiClient.prototype.switchClinic)).toHaveBeenCalledWith("c-2");
    await waitFor(() => expect(screen.getByTestId("active-clinic").textContent).toBe("Clinic Two"));
  });

  it("creates a staff member and refreshes the table", async () => {
    vi.mocked(MedCanvasApiClient.prototype.getMyClinics).mockResolvedValue([]);
    vi.mocked(MedCanvasApiClient.prototype.getClinicMembers)
      .mockResolvedValueOnce(members)
      .mockResolvedValueOnce([
        ...members,
        {
          userId: "u-3",
          email: "new@clinic.example",
          fullName: "Новий Працівник",
          role: "Assistant",
          membershipActive: true,
          userActive: true,
          memberSinceUtc: "2026-10-25T00:00:00Z",
        },
      ]);
    vi.mocked(MedCanvasApiClient.prototype.addClinicMember).mockResolvedValue({
      userId: "u-3",
      email: "new@clinic.example",
      fullName: "Новий Працівник",
      role: "Assistant",
      membershipActive: true,
      userActive: true,
      memberSinceUtc: "2026-10-25T00:00:00Z",
    });

    await loginThroughUi();
    await waitFor(() => expect(screen.getByText("doc@clinic.example")).toBeTruthy());

    fireEvent.change(screen.getAllByLabelText(/ПІБ|Full name/)[0], { target: { value: "Новий Працівник" } });
    fireEvent.change(screen.getAllByLabelText(/Електронна пошта|Email/, { selector: "input" })[0], {
      target: { value: "new@clinic.example" },
    });
    fireEvent.change(screen.getAllByLabelText(/Початковий пароль|Initial password/)[0], {
      target: { value: "StrongP@ssw0rd123!" },
    });

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /Додати працівника|Add staff member/ }).closest("form")!);
    });

    await waitFor(() => expect(vi.mocked(MedCanvasApiClient.prototype.addClinicMember)).toHaveBeenCalled());
    await waitFor(() => expect(vi.mocked(MedCanvasApiClient.prototype.getClinicMembers)).toHaveBeenCalledTimes(2));
  });

  it("surfaces staff loading errors with a retry control", async () => {
    vi.mocked(MedCanvasApiClient.prototype.getMyClinics).mockResolvedValue([]);
    vi.mocked(MedCanvasApiClient.prototype.getClinicMembers)
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValueOnce(members);

    await loginThroughUi();

    const retry = await screen.findByRole("button", { name: /Повторити|Retry/ });
    expect(screen.getByRole("alert")).toBeTruthy();

    await act(async () => {
      fireEvent.click(retry);
    });

    await waitFor(() => expect(screen.getByText("doc@clinic.example")).toBeTruthy());
  });

  it("switches the workspace language to English", async () => {
    vi.mocked(MedCanvasApiClient.prototype.getMyClinics).mockResolvedValue([]);
    vi.mocked(MedCanvasApiClient.prototype.getClinicMembers).mockResolvedValue([]);
    await loginThroughUi();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "EN" }));
    });

    expect(screen.getByText("Clinic staff")).toBeTruthy();
    expect(localStorage.getItem("medcanvas.workspace.lang")).toBe("en");
  });
});
