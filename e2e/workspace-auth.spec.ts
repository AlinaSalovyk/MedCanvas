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
