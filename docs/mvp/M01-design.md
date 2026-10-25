# M01 — SaaS Workspace, Identity & Clinic Context · Design Decisions

Branch `feat/mvp-workspace-identity` from `2b59f50`. Locked decisions; deviations must be recorded here.

## D1 — Multi-page without touching the frozen engine page
- Vite **MPA**: new `app.html` entry (`/app.html`) mounting `src/workspace/main.tsx` (React Router). `index.html` + `src/main.tsx` + `src/App.tsx` remain byte-compatible so parity goldens (shell DOM, 349+184 API surface) and all existing Playwright specs stay green untouched.
- The engine is consumed by the workspace only in M04 (encounter page). M01 ships shell + identity only.
- `vite.config.ts`: add `build.rollupOptions.input` for both entries.

## D2 — Authentication flow
- `LoginCommand.ClinicId` becomes **optional** (`Guid?`):
  - null + exactly one active membership → auto-select;
  - null + multiple → `LoginResultDto.RequiresClinicSelection = true` with clinic list (no token);
  - null + zero → 401.
  - supplied → current behavior (verified membership).
- Response contract: `LoginResultDto { RequiresClinicSelection, Clinics[], Token?, ExpiresAtUtc?, UserId?, Email?, FullName?, ClinicId?, ClinicName?, Role? }`. Success path identical fields to today's `LoginResponseDto` (frontend `client.ts` updated to match; M00 sync untouched).
- Token stays **memory-only** client-side (reload ⇒ login). No refresh tokens in MVP.
- `Jwt:ExpiryMinutes` config honored (default 480) — fixes dead-config defect C2; `IDateTimeProvider` used for expiry computation.

## D3 — Clinic switching (FR-004)
- `POST /api/v1/auth/switch-clinic {clinicId}` (`[Authorize]`, any role): re-verifies active user/clinic/membership, issues a fresh token for the target clinic (same expiry policy). Returns the same success shape as login.
- Frontend on switch: replace token, reload current user, **`queryClient.clear()`**, re-render clinic-scoped data. Tenant cache isolation is test-covered.

## D4 — Controlled onboarding (FR-002)
- `POST /api/v1/clinics/onboarding` `[AllowAnonymous]`, rate-limited: `{ clinicName, clinicIdentifier, adminEmail, adminFullName, adminPassword }`.
- Creates Clinic + **brand-new** User + ClinicAdmin membership in one transaction; email already registered ⇒ 409 (no binding to existing accounts — anti-takeover). Returns success login (auto-authenticated first admin).
- No endpoint can self-assign a role in an *existing* clinic without an authenticated ClinicAdmin — enforced by policy + tests.

## D5 — Membership management (FR-003)
- New policy `CanManageClinic` = ClinicAdmin (per-request DB-verified as today).
- `GET /api/v1/clinics/members`; `POST /api/v1/clinics/members` (new user + role); `PUT /api/v1/clinics/members/{userId}/role`; `DELETE /api/v1/clinics/members/{userId}` (revoke = deactivate membership; **self-revoke forbidden** to prevent clinic lockout); `POST /api/v1/clinics/members/{userId}/activate` (reactivate).
- Roles per `MembershipRole` (ClinicAdmin/Clinician/Assistant/Viewer). Last-active-admin guard: revoking the last active ClinicAdmin ⇒ 409.

## D6 — Clinic profile (settings)
- `Clinics.TimeZoneId` (string, default `Europe/Kyiv`, validated against IANA list via `TimeZoneInfo`); migration `AddClinicTimeZone`.
- `GET /api/v1/clinics/settings` (any member) / `PUT /api/v1/clinics/settings {name, timeZoneId}` (ClinicAdmin). Timezone consumed by M03 scheduling display.

## D7 — Hardening (audit C2/C7)
- Rate limiter: fixed-window per-IP on `login` + `onboarding` (10 req/min each; configurable). 429 ProblemDetails (`https://medcanvas.health/errors/rate-limited`).
- `UseHsts` (non-dev) + security-headers middleware (X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy no-referrer).
- Audit events (existing `ClinicalAuditEvent` pattern): `CLINIC_ONBOARDED`, `MEMBERSHIP_CREATED`, `MEMBERSHIP_ROLE_CHANGED`, `MEMBERSHIP_REVOKED`, `MEMBERSHIP_REACTIVATED`, `CLINIC_SETTINGS_UPDATED`. No PHI beyond ids/emails-hashes per existing rules (email stored in DetailsHash only as hash or omitted — keep DetailsHash = action-scoped token like existing `rev:` pattern).

## D8 — Frontend architecture
- `src/workspace/`: `main.tsx` (BrowserRouter), `AuthProvider` (client + token + user state + 401 handler), `WorkspaceLayout` (topbar: clinic name/switcher, user menu; sidebar: only implemented modules — Staff, Settings, Profile in M01), pages: `LoginPage`, `OnboardingPage`, `StaffPage`, `ClinicSettingsPage`, `ProfilePage`. Route guards by auth + role.
- TanStack Query introduced here (`QueryClientProvider`); all workspace server state via queries/mutations; cache cleared on clinic switch.
- i18n: reuse engine i18n system (keys `workspace.*` added to `en.ts`/`uk.ts`, parity-tested); default language uk, switchable.
- Styling: vanilla CSS (`src/workspace/workspace.css`) using existing CSS custom properties/theme tokens; WCAG-minded semantics (labels, focus, contrast), desktop/tablet responsive.
- `src/api/client.ts` extended: `login` (new contract), `switchClinic`, `getMyClinics`, onboarding + membership + settings calls; typed DTOs in `types.ts`.

## D9 — Testing strategy
- Backend: validator matrix (§7.2 per field), handler tests (success/401/403/404/409/self-revoke/last-admin), API integration incl. two-clinic isolation, role matrix, rate-limit 429, revoked-member-immediate-403, onboarding anti-takeover.
- Frontend: RTL tests per page (loading/empty/error/invalid form/success/unauthorized/stale), guard tests, clinic-switch cache-clear test.
- Playwright: `e2e/workspace-auth.spec.ts` with contract-accurate `page.route()` mocks (no backend in CI): login (single + clinic-selection), workspace shell renders role-aware nav, staff page, switch clinic, logout, protected-route redirect.

## D10 — Documentation
- Update `docs/backend/api-contracts.md` (new endpoints), `data-model.md` (TimeZoneId), AGENTS.md §9 skill notes only if conventions change; CLAUDE.md Scope-Control paragraph updated to reflect the TZ-mandated workspace (stale prohibition of multi-page routing superseded by TZ §4.1).
