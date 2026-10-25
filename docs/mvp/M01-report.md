# MEDCANVAS — MODULE M01 IMPLEMENTATION & QUALITY REPORT

**Module:** M01 — SaaS Workspace, Identity & Clinic Context
**Branch:** `feat/mvp-workspace-identity` · **Base:** `2b59f50` (M00 merge) · Final SHA recorded in PR.

## 1. Purpose
Turn the standalone odontogram into a multi-page SaaS platform: authentication, controlled clinic onboarding, staff membership management, clinic switching with tenant-safe client caches, and the role-aware workspace shell — without touching the frozen engine page.

## 2. Implemented requirements (TZ §M01)

| Requirement | Implementation |
|---|---|
| **FR-001 Authentication** | Login page (email/password); `LoginCommand.ClinicId` optional — single membership auto-selects, multiple memberships return a selection prompt (no token). Logout discards the memory-only token. `GET /auth/me` powers the session profile. `Jwt:ExpiryMinutes` config now honored (clamped 5–1440, default 480) — fixes dead-config defect C2. |
| **FR-002 Controlled onboarding** | `POST /api/v1/clinics/onboarding` (anonymous, rate-limited): creates clinic + **brand-new** admin user + ClinicAdmin membership in one transaction (audit `CLINIC_ONBOARDED`), returns an authenticated session. Existing email ⇒ 409 (no account takeover); duplicate identifier ⇒ 409. No endpoint self-assigns roles in existing clinics. |
| **FR-003 Staff membership** | ClinicAdmin-only endpoints: list members (revoked included with flags), add member (new account + role), change role (self-change 409, last-admin guard), revoke (self-revoke 409; membership deactivated — never deleted; revocation is instantly enforced per request by the DB-verified membership handler), reactivate. Audit events on every lifecycle action. |
| **FR-004 Clinic switching** | `GET /api/v1/auth/clinics` lists own memberships; `POST /api/v1/auth/switch-clinic` re-verifies membership and issues a fresh clinic-scoped token (foreign clinic ⇒ 404 anti-enumeration). Frontend switcher clears the entire TanStack Query cache before adopting the new session. |
| **FR-005 Workspace** | `/app.html` Vite entry: React Router, guarded routes, role-aware nav (Staff/Settings/Profile only — unbuilt modules are absent, not faked), clinic switcher, uk/en language toggle, profile page. |
| **Engine preserved** | `index.html`/`App.tsx` untouched; parity goldens, API-surface (349+184), import cycles, and all 14 legacy E2E specs pass unchanged. |

## 3. Architecture / DB / API / UI changes
- **DB:** `Clinics.TimeZoneId varchar(64) NOT NULL DEFAULT 'Europe/Kyiv'` (migration `AddClinicTimeZone`, additive, verified on Testcontainers). No other schema changes.
- **API:** 10 new endpoints (§2.1/2.1b of `docs/backend/api-contracts.md`); new policies `CanManageClinic` (ClinicAdmin) and `CanReadClinicProfile` (all members); per-IP fixed-window rate limiter on login/onboarding (429 problem details, configurable); security headers (nosniff/DENY/no-referrer) + HSTS outside Dev/Testing.
- **Frontend:** new `src/workspace/` tree (auth context, router with guards, shell, 5 pages, CSS, uk/en dictionaries); `src/api` extended with typed contracts (login now returns `LoginResult` union). Dependencies: `react-router-dom`, `@tanstack/react-query`. Vite multi-entry build.
- **Domain:** `Clinic` gains validated `TimeZoneId` (IANA) + `UpdateProfile` (identifier immutable).

## 4. Validation matrix
Validators (§7.2): onboarding (name/identifier format+length/email/password strength incl. null/whitespace/overlength/timezone matrix), member add (role enum exact-match, password, lengths), role change, revoke/activate, settings (name/timezone) — 55 Application tests incl. boundary and enum cases.
Handlers/HTTP: onboarding success/409×2/400; members list incl. revoked/401/403 (Clinician); add 201/409/403 (Assistant)/400 (bad role); role change 200/409 self/404 cross-clinic; revoke 204/409 self/instant-revocation 403 with old token/404 cross-clinic; activate 204; settings read (Viewer OK)/update 200/403/400; switching (token claim verified via /me)/foreign 404/empty Guid 400; rate limiting 429 (login + onboarding) with problem+json.

## 5. Test evidence (actual runs)
| Suite | Result |
|---|---|
| Domain | **121/121** (+12 clinic timezone) |
| Application | **152/152** (+57: validators, aligned login validator) |
| Infrastructure (Testcontainers PG) | **21/21** |
| API integration | **86/86** (+32: auth flows, clinics endpoints, rate limiting) — migration applied on clean DB |
| Vitest | **2663 passed / 2 skipped** (+9 workspace) |
| Playwright | **15/15** (14 legacy + 1 workspace E2E) |
| tsc / eslint / build / dotnet build / dotnet format | PASS / 0 errors (248 pre-existing warnings) / PASS / 0w0e / PASS |

## 6. Security & tenant isolation
Two-clinic isolation on every new endpoint (cross-tenant ⇒ 404 without existence disclosure); membership/role re-verified per request against the live DB (revocation instant — regression tested with a previously issued token); rate limiting on anonymous auth surfaces; security headers + HSTS; no secrets committed; audit trail for all tenancy actions; passwords PBKDF2-hashed; login errors uniform (no user enumeration); workspace token memory-only.

## 7. Concurrency & resilience
Rate limiter partitioned per IP (burst ⇒ deterministic 429 tested); staff operations run single-SaveChanges transactions (atomic); concurrent onboarding with same email/identifier ⇒ unique-index conflict surfaced as 409.

## 8. Known limitations
- No refresh tokens; token lifetime is the configured expiry (MVP: re-login after expiry; 401 interception returns users to login).
- Staff invitations create accounts with an initial password set by the admin (no email invitation flow in MVP).
- Workspace E2E uses contract-accurate route mocks (frontend CI has no backend); full-stack E2E arrives in M04+/M09.
- Clinic switching re-issues tokens; open odontogram sessions (M04) must be saved or explicitly left before switching — enforced by the M00 switch guard at the bridge level.

## 9. Verdict
`READY FOR INDEPENDENT REVIEW` (CI verification on PR HEAD pending at publication; all local gates green).
