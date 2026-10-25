/**
 * M01 workspace E2E (Chromium): login → workspace → clinic switcher presence →
 * logout → protected route redirect, against contract-accurate API route mocks
 * (the frontend CI has no backend; full-stack E2E arrives with M09).
 */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const ADMIN_SESSION = {
  requiresClinicSelection: false,
  clinics: [],
  token: "e2e-token",
  expiresAtUtc: "2099-01-01T00:00:00Z",
  userId: "u-1",
  email: "admin@clinic.example",
  fullName: "E2E Admin",
  clinicId: "c-1",
  clinicName: "E2E Clinic",
  role: "ClinicAdmin",
};

async function mockApi(page: Page): Promise<void> {
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(ADMIN_SESSION),
    })
  );
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: ADMIN_SESSION.userId,
        email: ADMIN_SESSION.email,
        fullName: ADMIN_SESSION.fullName,
        clinicId: ADMIN_SESSION.clinicId,
        role: ADMIN_SESSION.role,
      }),
    })
  );
  await page.route("**/api/v1/auth/clinics", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { clinicId: "c-1", clinicName: "E2E Clinic", clinicIdentifier: "E2E", role: "ClinicAdmin" },
      ]),
    })
  );
  await page.route("**/api/v1/clinics/members", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          userId: "u-1",
          email: "admin@clinic.example",
          fullName: "E2E Admin",
          role: "ClinicAdmin",
          membershipActive: true,
          userActive: true,
          memberSinceUtc: "2026-10-01T00:00:00Z",
        },
      ]),
    })
  );
  await page.route("**/api/v1/patients?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
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
          },
        ],
        pageNumber: 1,
        pageSize: 10,
        totalCount: 1,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      }),
    })
  );
  await page.route("**/api/v1/patients/p-1", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
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
      }),
    })
  );
  await page.route("**/api/v1/patients/p-1/encounters", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "e-1",
          clinicId: "c-1",
          patientId: "p-1",
          attendingUserId: "u-1",
          startedAtUtc: "2026-10-21T09:00:00Z",
          chiefComplaint: "Періодичний огляд",
          status: "Completed",
        },
      ]),
    })
  );
  await page.route("**/api/v1/patients/p-1/odontogram/latest", (route) =>
    route.fulfill({ status: 404, contentType: "application/problem+json", body: '{"title":"Not Found","status":404}' })
  );
}

test("workspace: login, staff table, logout, and protected-route redirect", async ({ page }) => {
  await mockApi(page);
  await page.goto("/app.html");

  // Unauthenticated: redirected to the login screen
  await expect(page.getByRole("heading", { name: /Вхід до MedCanvas/ })).toBeVisible();

  // Login
  await page.getByLabel(/Електронна пошта/).fill("admin@clinic.example");
  await page.getByLabel(/Пароль/).fill("StrongP@ssw0rd123!");
  await page.getByRole("button", { name: /Увійти/ }).click();

  // Workspace shell with the active clinic and staff table
  await expect(page.getByTestId("active-clinic")).toHaveText("E2E Clinic");
  await expect(page.getByRole("heading", { name: /Персонал клініки/ })).toBeVisible();
  await expect(page.getByText("admin@clinic.example")).toBeVisible();

  // Logout
  await page.getByRole("button", { name: /Вийти/ }).click();
  await expect(page.getByRole("heading", { name: /Вхід до MedCanvas/ })).toBeVisible();

  // Protected route after logout: back to login
  await page.goto("/app.html");
  await page.keyboard.press("End");
  await expect(page.getByRole("heading", { name: /Вхід до MedCanvas/ })).toBeVisible();
});

test("workspace: patients list and patient card", async ({ page }) => {
  await mockApi(page);
  await page.goto("/app.html");

  await page.getByLabel(/Електронна пошта/).fill("admin@clinic.example");
  await page.getByLabel(/Пароль/).fill("StrongP@ssw0rd123!");
  await page.getByRole("button", { name: /Увійти/ }).click();

  await page.getByRole("link", { name: /Пацієнти/ }).click();

  // List renders the mocked patient with controls
  await expect(page.getByRole("link", { name: "Олена Коваленко" })).toBeVisible();
  await expect(page.getByText("MRN-001")).toBeVisible();

  // Patient card: identity, alerts, visit history; no chart yet (M04)
  await page.getByRole("link", { name: "Олена Коваленко" }).click();
  await expect(page.getByText("Penicillin allergy")).toBeVisible();
  await expect(page.getByText("Періодичний огляд")).toBeVisible();
  await expect(page.getByText(/Одонтограма ще не створена/)).toBeVisible();
});
