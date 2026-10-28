import { test, expect } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";
import { workspaceT } from "../src/workspace/i18n";

const t = (key: string): string => workspaceT("uk", key);
const password = "SyntheticE2e#12345";
interface Session { token: string; userId: string; clinicId: string; clinicName: string }

async function post<T>(request: APIRequestContext, path: string, data: unknown, token?: string): Promise<T> {
  const response = await request.post(`/api/v1${path}`, { data, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  expect(response.ok(), `${path}: ${response.status()} ${await response.text()}`).toBeTruthy();
  return response.json() as Promise<T>;
}

async function login(page: Page, email: string): Promise<void> {
  await page.getByLabel(t("login.email"), { exact: true }).fill(email);
  await page.getByLabel(t("login.password"), { exact: true }).fill(password);
  await page.getByRole("button", { name: t("login.submit"), exact: true }).click();
  await expect(page.getByTestId("active-clinic")).toBeVisible();
}

test("E2E-MVP-001: real browser, API and PostgreSQL complete clinic workflow", async ({ page, request }) => {
  const run = Date.now().toString();
  const adminEmail = `admin-${run}@synthetic.example`;
  const clinicianEmail = `clinician-${run}@synthetic.example`;
  const onboard = (suffix: string, email: string): Promise<Session> => post(request, "/clinics/onboarding", {
    clinicName: `Synthetic Clinic ${suffix} ${run}`, clinicIdentifier: `E2E-${suffix}-${run}`,
    adminEmail: email, adminFullName: `Synthetic Admin ${suffix}`, adminPassword: password, timeZoneId: "Europe/Kyiv",
  });
  const clinicA = await onboard("A", adminEmail);
  const clinicB = await onboard("B", `foreign-${run}@synthetic.example`);
  const member = await post<{ userId: string }>(request, "/clinics/members", {
    email: clinicianEmail, fullName: "Synthetic Clinician", password, role: "Clinician",
  }, clinicA.token);
  const chair = await post<{ id: string }>(request, "/chairs", { name: "Synthetic Chair" }, clinicA.token);
  const catalog = await post<{ id: string }>(request, "/catalog", {
    code: "DEMO-1000", name: "Synthetic Procedure", defaultPrice: 1000, estimatedDurationMinutes: 30,
  }, clinicA.token);
  const availability = await request.put(`/api/v1/availability/${member.userId}`, {
    headers: { Authorization: `Bearer ${clinicA.token}` },
    data: { windows: Array.from({ length: 7 }, (_, i) => ({ dayOfWeek: i + 1, startTime: "08:00:00", endTime: "18:00:00", breaks: [] })) },
  });
  expect(availability.ok()).toBeTruthy();

  await page.goto("/app.html");
  await login(page, adminEmail);
  await page.getByRole("link", { name: t("nav.patients"), exact: true }).click();
  await page.getByRole("button", { name: t("patients.add"), exact: true }).click();
  await page.getByLabel(t("patients.firstName"), { exact: true }).fill("Synthetic");
  await page.getByLabel(t("patients.lastName"), { exact: true }).fill(`Patient-${run}`);
  const patientSaved = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith("/api/v1/patients"));
  await page.locator("form.ws-patient-form").getByRole("button", { name: t("common.save"), exact: true }).click();
  const patientResponse = await patientSaved;
  expect(patientResponse.status()).toBe(201);
  const patient = await patientResponse.json() as { id: string; fullName: string };
  await page.getByRole("link", { name: patient.fullName, exact: true }).click();
  await page.getByRole("link", { name: t("patients.book"), exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("combobox", { name: t("calendar.patient"), exact: true })).toHaveValue(patient.id);
  await dialog.getByRole("combobox", { name: t("calendar.clinician"), exact: true }).selectOption(member.userId);
  await dialog.getByRole("combobox", { name: t("calendar.chair"), exact: true }).selectOption(chair.id);
  // Select this week's local date so the booked slot is visible in the calendar.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  await dialog.getByLabel(t("calendar.reason"), { exact: true }).fill("Synthetic examination");
  await dialog.getByLabel(t("calendar.start"), { exact: true }).fill(`${today}T07:00`);
  const unavailable = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith("/api/v1/appointments"));
  await dialog.getByRole("button", { name: t("calendar.book"), exact: true }).click();
  expect((await unavailable).status()).toBe(400);
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByLabel(t("calendar.start"), { exact: true }).fill(`${today}T10:00`);
  await dialog.getByRole("button", { name: t("calendar.book"), exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const appointment = page.locator("article.ws-appt").filter({ hasText: patient.fullName });
  await expect(appointment).toBeVisible();
  await appointment.getByRole("button", { name: t("calendar.confirm"), exact: true }).click();
  await expect(appointment.getByText(t("calendar.statuses.Confirmed"), { exact: true })).toBeVisible();

  await page.getByRole("button", { name: t("nav.logout"), exact: true }).click();
  await login(page, clinicianEmail);
  await page.getByRole("link", { name: t("nav.calendar"), exact: true }).click();
  const started = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith("/api/v1/encounters"));
  await page.locator("article.ws-appt").filter({ hasText: patient.fullName })
    .getByRole("button", { name: t("calendar.startEncounter"), exact: true }).click();
  const encounter = await (await started).json() as { id: string };
  await page.getByRole("button", { name: t("encounters.initializeChart"), exact: true }).click();
  await expect(page.locator("#toothGrid .tooth-tile.side-view")).toHaveCount(32);
  await page.locator('#toothGrid .tooth-tile.side-view[data-tooth="11"]').click();
  const saved = page.waitForResponse(r => r.request().method() === "PUT" && r.url().includes(`/encounters/${encounter.id}/odontogram`));
  await page.locator("#pulpEndoSelect").selectOption("endo-filling");
  expect((await saved).ok()).toBeTruthy();
  await expect(page.getByTestId("sync-chip")).toHaveText(t("sync.saved"));

  await page.reload();
  await login(page, clinicianEmail);
  await page.getByRole("link", { name: t("nav.patients"), exact: true }).click();
  await page.getByRole("link", { name: patient.fullName, exact: true }).click();
  await page.locator(`a[href$="/encounters/${encounter.id}"]`).click();
  await expect(page.locator("#toothGrid .tooth-tile.side-view")).toHaveCount(32);
  await page.locator('#toothGrid .tooth-tile.side-view[data-tooth="11"]').click();
  await expect(page.locator("#pulpEndoSelect")).toHaveValue("endo-filling");

  // Route navigation must retain unsaved edits when a real save cannot reach
  // the API, and resume only after the same chart successfully persists.
  const chartRoute = `**/encounters/${encounter.id}/odontogram`;
  await page.route(chartRoute, route => route.request().method() === "PUT" ? route.abort("failed") : route.continue());
  await page.locator('#toothGrid .tooth-tile.side-view[data-tooth="21"]').click();
  await page.locator("#pulpEndoSelect").selectOption("endo-filling");
  await page.getByRole("link", { name: t("nav.patients"), exact: true }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/encounters/${encounter.id}$`));
  await expect(page.locator("#pulpEndoSelect")).toHaveValue("endo-filling");
  await page.unroute(chartRoute);
  await page.getByRole("link", { name: t("nav.patients"), exact: true }).click();
  await page.getByRole("link", { name: patient.fullName, exact: true }).click();
  await page.getByRole("link", { name: t("plans.open"), exact: true }).click();
  await page.getByRole("combobox", { name: t("plans.sourceEncounter"), exact: true }).selectOption(encounter.id);
  await page.getByRole("button", { name: t("plans.create"), exact: true }).click();
  await page.getByRole("button", { name: t("plans.addItem"), exact: true }).click();
  await page.getByRole("combobox", { name: t("plans.item"), exact: true }).selectOption(catalog.id);
  await page.getByLabel(t("plans.tooth"), { exact: true }).fill("11");
  await page.getByRole("button", { name: t("plans.addItem"), exact: true }).click();
  await expect(page.getByTestId("plan-total")).toContainText("1000.00");
  await page.getByRole("button", { name: t("common.cancel"), exact: true }).click();
  await page.getByRole("button", { name: t("plans.submit"), exact: true }).click();
  await page.getByRole("button", { name: t("plans.approve"), exact: true }).click();
  await expect(page.getByRole("heading", { level: 2 })).toContainText(t("plans.statuses.Approved"));

  await page.getByRole("link", { name: t("patients.backToList"), exact: true }).click();
  await page.locator(`a[href$="/encounters/${encounter.id}"]`).click();
  const performed = page.locator(".ws-performed > form");
  await performed.getByRole("combobox", { name: t("plans.item"), exact: true }).selectOption(catalog.id);
  await performed.getByLabel(t("plans.tooth"), { exact: true }).fill("11");
  await performed.getByRole("button", { name: t("performed.record"), exact: true }).click();
  await expect(page.locator(".ws-performed > table tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: t("nav.logout"), exact: true }).click();
  await login(page, adminEmail);
  await page.getByRole("link", { name: t("nav.patients"), exact: true }).click();
  await page.getByRole("link", { name: patient.fullName, exact: true }).click();
  await page.locator(`a[href$="/encounters/${encounter.id}"]`).click();
  await page.getByRole("button", { name: t("billing.issue"), exact: true }).click();
  await expect(page.locator(".ws-invoice")).toBeVisible();
  await expect(page.locator(".ws-demo-badge")).toHaveText(t("billing.demoBadge"));
  // Fault injection forwards the REAL payment request and lets PostgreSQL commit,
  // then loses its response. The retry must reuse the exact operation key.
  const paymentKeys: string[] = [];
  let intercepted = false;
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>(resolve => { releaseResponse = resolve; });
  await page.route("**/simulated-payments", async route => {
    const body = route.request().postDataJSON() as { idempotencyKey: string };
    paymentKeys.push(body.idempotencyKey);
    if (!intercepted) {
      intercepted = true;
      const committed = await route.fetch();
      expect(committed.ok()).toBeTruthy();
      await responseGate;
      await route.abort("failed");
    } else {
      await route.continue();
    }
  });
  await page.getByLabel(t("billing.pay"), { exact: true }).fill("400");
  await page.getByRole("button", { name: t("billing.pay"), exact: true }).click();
  await expect.poll(() => intercepted).toBe(true);
  await expect(page.getByRole("button", { name: /billing\.retryPayment|Повторити цю симульовану оплату/ })).toBeDisabled();
  releaseResponse();
  const retryPayment = page.getByRole("button", { name: /Повторити цю симульовану оплату/ });
  await expect(retryPayment).toBeEnabled();
  await retryPayment.click();
  await expect(retryPayment).toHaveCount(0);
  expect(paymentKeys).toHaveLength(2);
  expect(paymentKeys[0]).toBe(paymentKeys[1]);
  await page.unroute("**/simulated-payments");
  await expect(page.locator(".ws-invoice-header")).toContainText(t("billing.statuses.PartiallySimulated"));
  await page.getByRole("button", { name: /Симулювати повну оплату/ }).click();
  await expect(page.locator(".ws-invoice-header")).toContainText(t("billing.statuses.FullySimulated"));
  await page.getByRole("button", { name: t("encounters.complete"), exact: true }).click();
  await expect(page.locator(".ws-finished-note")).toBeVisible();

  await page.getByRole("button", { name: t("nav.logout"), exact: true }).click();
  await login(page, adminEmail);
  await page.getByRole("link", { name: t("nav.patients"), exact: true }).click();
  await page.getByRole("link", { name: patient.fullName, exact: true }).click();
  await expect(page.getByText(t("patients.encounterStatus.Completed"), { exact: true })).toBeVisible();
  await page.getByRole("link", { name: t("patients.book"), exact: true }).click();
  await dialog.getByRole("combobox", { name: t("calendar.clinician"), exact: true }).selectOption(member.userId);
  await dialog.getByRole("combobox", { name: t("calendar.chair"), exact: true }).selectOption(chair.id);
  await dialog.getByLabel(t("calendar.start"), { exact: true }).fill(`${today}T15:00`);
  await dialog.getByLabel(t("calendar.reason"), { exact: true }).fill("Synthetic follow-up");
  await dialog.getByRole("button", { name: t("calendar.book"), exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("article.ws-appt").filter({ hasText: patient.fullName })).toHaveCount(2);

  const headers = { Authorization: `Bearer ${clinicA.token}` };
  const invoices = await request.get(`/api/v1/invoices/by-patient/${patient.id}`, { headers });
  const history = await invoices.json() as Array<{ id: string; status: string; simulatedPaid: number; payments: unknown[] }>;
  expect(history).toHaveLength(1);
  expect(history[0]).toMatchObject({ status: "FullySimulated", simulatedPaid: 1000 });
  expect(history[0].payments).toHaveLength(2);
  for (const path of [`/patients/${patient.id}`, `/encounters/${encounter.id}`, `/invoices/${history[0].id}`]) {
    const foreign = await request.get(`/api/v1${path}`, { headers: { Authorization: `Bearer ${clinicB.token}` } });
    expect(foreign.status()).toBe(404);
    expect(await foreign.text()).not.toContain(patient.fullName);
  }
  await page.getByRole("button", { name: t("nav.logout"), exact: true }).click();
  await login(page, `foreign-${run}@synthetic.example`);
  await page.getByRole("link", { name: t("nav.patients"), exact: true }).click();
  await expect(page.getByText(patient.fullName)).toHaveCount(0);
  await page.evaluate(id => { window.location.hash = `/patients/${id}`; }, patient.id);
  await expect(page.getByText(t("patients.notFound"), { exact: true })).toBeVisible();
  await expect(page.getByText(patient.fullName)).toHaveCount(0);
});
