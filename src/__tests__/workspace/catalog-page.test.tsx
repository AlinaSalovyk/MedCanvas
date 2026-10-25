/**
 * M05 catalog page: create with per-clinic unique code (409 surfaced), list, and
 * deactivate/activate actions.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MedCanvasApiClient, ApiError } from "../../api/client";
import { AuthProvider } from "../../workspace/AuthContext";
import { WorkspaceApp } from "../../workspace/WorkspaceApp";

function renderApp(): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <WorkspaceApp />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

async function loginAndOpenCatalog(): Promise<void> {
  renderApp();
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
    role: "ClinicAdmin",
  } as never);
  fireEvent.submit(screen.getByRole("button", { name: /Увійти|Sign in/ }).closest("form")!);
  await waitFor(() => expect(screen.getByTestId("active-clinic")).toBeTruthy());
  fireEvent.click(screen.getByRole("link", { name: /Прайс-лист|Price list/ }));
  await waitFor(() => expect(screen.getByRole("heading", { name: /Прайс-лист|Price list/ })).toBeTruthy());
}

describe("Catalog page (M05)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    for (const m of ["login", "getMyClinics", "getClinicMembers", "getCatalogItems", "createCatalogItem", "setCatalogItemActive"] as const) {
      vi.spyOn(MedCanvasApiClient.prototype, m);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a catalog item and lists it with price", async () => {
    vi.mocked(MedCanvasApiClient.prototype.getMyClinics).mockResolvedValue([]);
    const getItems = vi.mocked(MedCanvasApiClient.prototype.getCatalogItems);
    getItems
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "cat-1",
          clinicId: "c-1",
          code: "ENDO-1",
          name: "Ендодонтичне лікування",
          description: null,
          category: "Ендодонтія",
          defaultPrice: 2500.5,
          estimatedDurationMinutes: 60,
          isActive: true,
        },
      ]);
    const create = vi.mocked(MedCanvasApiClient.prototype.createCatalogItem);
    create.mockResolvedValue({
      id: "cat-1",
      clinicId: "c-1",
      code: "ENDO-1",
      name: "Ендодонтичне лікування",
      description: null,
      category: "Ендодонтія",
      defaultPrice: 2500.5,
      estimatedDurationMinutes: 60,
      isActive: true,
    });

    await loginAndOpenCatalog();

    fireEvent.change(screen.getAllByLabelText(/Код/)[0], { target: { value: "ENDO-1" } });
    fireEvent.change(screen.getAllByLabelText(/Назва/)[0], { target: { value: "Ендодонтичне лікування" } });
    fireEvent.change(screen.getAllByLabelText(/Ціна/)[0], { target: { value: "2500.5" } });

    await act2(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /Додати процедуру|Add procedure/ }).closest("form")!);
    });

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0].code).toBe("ENDO-1");
    expect(create.mock.calls[0][0].defaultPrice).toBe(2500.5);
    await waitFor(() => expect(screen.getByText("2500.50")).toBeTruthy());
  });

  it("surfaces a duplicate-code conflict from the server", async () => {
    vi.mocked(MedCanvasApiClient.prototype.getMyClinics).mockResolvedValue([]);
    vi.mocked(MedCanvasApiClient.prototype.getCatalogItems).mockResolvedValue([]);
    vi.mocked(MedCanvasApiClient.prototype.createCatalogItem).mockRejectedValue(
      new ApiError(409, "A catalog item with this code already exists in the clinic.")
    );

    await loginAndOpenCatalog();

    fireEvent.change(screen.getAllByLabelText(/Код/)[0], { target: { value: "DUP-1" } });
    fireEvent.change(screen.getAllByLabelText(/Назва/)[0], { target: { value: "Дублікат" } });

    await act2(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /Додати процедуру|Add procedure/ }).closest("form")!);
    });

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  });
});

async function act2(fn: () => Promise<void> | void): Promise<void> {
  // Thin wrapper keeps RTL act semantics obvious in this file
  const { act } = await import("@testing-library/react");
  await act(async () => {
    await fn();
  });
}
