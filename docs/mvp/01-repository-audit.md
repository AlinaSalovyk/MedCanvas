# 01 — Repository Audit (Phase Zero)

**Program:** MedCanvas MVP · **Audit date:** 2026-10-24 · **Auditor:** autonomous MVP program (AI)
**Base revision:** `f970f285e97f694713ea4def8559fefafd52baa2` (`main`, matches TZ-verified revision)
**Method:** three parallel deep-audit agents (backend ~126 file reads, frontend ~61, docs/skills ~31) + direct verification of builds, tests, git state, and CI. Generated/vendor trees (`node_modules/`, `dist/`, `notes/`, `tools/` output) were identified, not line-audited.

---

## 1. Git preflight

| Item | Result |
|---|---|
| Branch | `main`, clean working tree (only untracked `docs/mvp/`) |
| Local vs remote | `main` up to date with `origin/main` (`f970f28`) |
| History | 2 merged PRs: #1 `feat/backend-core`, #2 `fix/backend-security-clinical-stabilization` |
| CI | Workflows `CI` (frontend: tsc/eslint/vitest/build/e2e) and `Backend CI` (restore/build/format/test+coverage) — both green on `main` HEAD |
| Branch protection | **None** on `main` (verified via API); all merge strategies enabled; `deleteBranchOnMerge=false` |
| Lockfiles | `package-lock.json` present and consistent (`npm ci` clean in CI) |
| Local branches | `feat/backend-core`, `fix/backend-security-clinical-stabilization` (both merged) |

**Security note:** `origin` remote URL embeds a GitHub PAT in the local git config. Not committed to the repo, but the token should be rotated to a credential helper at some point; never echoed into logs/docs.

## 2. Toolchain baseline

| Tool | Version | Status |
|---|---|---|
| Node | 22.14.0 | OK (engines ≥18) |
| npm | 11.5.2 | OK |
| .NET SDK | 10.0.400 | OK (net10.0 target) |
| Docker | 29.1.3 | OK — Testcontainers viable locally |

## 3. Inspected inventory (summary)

### Frontend (`src/`, 244 vitest files, 5 Playwright specs)
- **Engine core:** `src/odontogram.ts` (2 237 lines, 349 frozen exports), `src/state/` (chart, payload, notify, caseMeta, perio, settings), `src/engine/` (dualStateGate, rendering, controls, navigation, popups…), `src/registry/` (axes + FHIR mappings), `src/dx/`, `src/fhir/` (toFhir, toFhirPlan, toFhirPerio, fromFhir), `src/anatomy/` (lazy measured profile ~3.6 MB chunk), `src/surfaces/`, `src/features/` (shell, perio, settings, bridge-overlay), `src/i18n/`, `src/persistence.ts`.
- **Backend integration:** `src/api/client.ts` (typed client, RFC 7807 parsing, ETag capture), `src/api/odontogramSync.ts` (autosave queue/state machine, two-phase encounter switch, fail-closed recovery lock), `src/api/types.ts`.
- **Tests:** parity goldens (api-surface 349+184 symbols, SVG fingerprints, FHIR goldens, canonical fixtures, shell DOM), import-cycle AST test, 27 sync-bridge/client tests, a11y, keyboard-nav, i18n, engine, sprint suites. Playwright: 15 scenarios (chart layout, clinical workflows, languages, theme) against production build via `vite preview`.
- **Absent:** routing (no react-router), server-state library (no TanStack Query), form libraries, any patient/auth/scheduling/billing UI. The API client + sync bridge are complete and tested but **wired to no UI** (dead code from the app's perspective).

### Backend (`backend/`, 4 src + 6 test projects)
- **Domain:** `User`, `Clinic`, `ClinicMembership`, `Patient`, `DentalEncounter`, `OdontogramRecord` (optimistic concurrency + finalize seal), `OdontogramRevision` (immutable), `ClinicalAuditEvent` (append-only); `FdiToothNumber` VO; domain exceptions.
- **Application:** Features Auth/Patients/Encounters/Odontograms — 7 commands, 9 queries; `ValidationBehavior` + `LoggingBehavior`; heavyweight `SaveOdontogramCommandValidator` (10 MB cap, schema/version/FDI/enum/peri/radix rules) driven by frontend-generated fixtures.
- **Infrastructure:** EF Core + Npgsql (jsonb snapshots, concurrency token, one migration `InitialCreate`), repositories, `JwtTokenService` (HS256, ≥256-bit key), `PasswordHasher` (PBKDF2 100k), `ActiveClinicMembershipHandler` (per-request DB-verified membership/role check, fail-closed).
- **API:** 4 controllers (`auth`, `patients`, `encounters`, `odontograms` + FHIR export), strong-ETag `If-Match` parser (428/412/400 semantics), `ExceptionHandlingMiddleware` (RFC 7807, typed error URIs), startup fail-fast for DB credentials/JWT secret.
- **Tests:** 279 total — Domain 109, Application 95, Infrastructure (real PostgreSQL Testcontainers, `postgres:16-alpine`) 21, API (WebApplicationFactory + Testcontainers) 54. Two-clinic isolation fixtures exist.

### Docs & skills
- 8 agent skills (`.agents/skills/medcanvas-*`) with binding backend conventions; `docs/backend/*` (9 files); `docs/architecture.md`, `clinical-state.md`, `engine-lifecycle.md`, `project-map.md`, `testing.md`; `CLAUDE.md` (frontend-era field reference with stale scope-control rules).
- Canonical MVP spec: `docs/mvp/MedCanvas-MVP-TZ-v1.0.md` (untracked at audit time; read in full; intact).

## 4. Architectural audit (answers to the 18 required questions)

1. **Existing modules:** auth (login/me), patients (CRUD+search), encounters (start/complete/cancel), odontogram persistence (ETag concurrency, revisions, finalize), FHIR export, clinical payload validation, audit (minimal).
2. **Partially implemented:** audit trail (2 write sites, no read API), FHIR export (single-encounter scope), Patient API (no archive/deactivate endpoint despite `IsActive` field), identity (login only — no clinic creation, no membership management, no registration).
3. **Frontend-only functionality:** the whole workspace UI — everything except the odontogram engine itself; also `persistence.ts` LocalStorage mode (standalone fallback, intentionally).
4. **Backend-persisted:** patients, encounters, odontogram records + revisions, audit events, users/clinics/memberships (seed-only, no API).
5. **Patient ownership:** `Patient.ClinicId` FK + explicit ClinicId predicates in every repository/query; cross-clinic → 404.
6. **Active clinic determination:** `clinic_id` JWT claim chosen at login, verified per-request by `ActiveClinicMembershipHandler` against live DB.
7. **Tenant isolation:** claim-based + per-request DB verification + explicit query predicates (no global query filters); tested with two-clinic fixtures.
8. **Snapshot serialization:** canonical payload v2.22 (`{version, globals, teeth, case?, plan?}`) as `jsonb` string — lossless round-trip contract-tested.
9. **Status/Plan separation:** single snapshot with optional `plan` subtree; frontend dual-state gate (DS-1) enforces separation at edit time; backend validator validates both trees.
10. **Clinical sync:** frontend `OdontogramSyncBridge` — serialized save queue, revision-tracked dirty state, generation tokens vs stale responses, two-phase switch, fail-closed recovery lock. **Not wired to UI yet.**
11. **ETag concurrency:** RFC 7232 strong ETags only; 428 missing precondition, 412 mismatch, 400 malformed; EF `IsConcurrencyToken` + DB unique index back the application-level check.
12. **Authorization:** 8 named policies mapping to role sets; membership handler re-verifies per request (revocation is instant).
13. **Audit records:** `ClinicalAuditEvent` rows written inline by Save/Finalize odontogram handlers only.
14. **Error propagation:** domain/application exceptions → RFC 7807 with stable `https://medcanvas.health/errors/*` types; frontend client parses them.
15. **FE↔BE communication:** typed fetch client `/api/v1`, bearer token in memory, ETag propagation; 1:1 match with controllers.
16. **Test coverage:** see §6 baseline; backend well-covered, frontend engine well-covered, frontend API layer has 27 dedicated tests.
17. **Decisions to preserve:** frozen 349-symbol public API; zero import cycles; golden fixtures; canonical payload contract; dual-state semantics; strong-ETag protocol; modular monolith Clean Architecture.
18. **MVP-blocking dependencies:** none external; all missing modules are greenfield within the established architecture.

## 5. Security audit

| Area | Finding | Class |
|---|---|---|
| Authentication | JWT HS256 ≥256-bit enforced at startup; zero clock skew; full issuer/audience/lifetime validation; adversarial token tests | Confirmed OK |
| Password hashing | PBKDF2-HMAC-SHA256, 100k iterations, fixed-time compare | Confirmed OK |
| Tenant isolation | Claim + DB-verified membership; explicit predicates; 404 anti-enumeration; two-clinic tests | Confirmed OK |
| IDOR | All resource fetches clinic-scoped; no client-supplied ClinicId trusted post-login | Confirmed OK |
| PHI in logs | 5xx logs category only, no payload; audit stores hashes/counts, not data | Confirmed OK |
| Login brute force | **No rate limiting, no lockout, no HSTS/security headers** | Confirmed gap (M01 hardening candidate) |
| Token lifetime | Hardcoded 480 min (config key dead); no refresh tokens; `clinic_id` fixed per token | Confirmed gap (M01: clinic switching needs re-login or token refresh design) |
| Secrets | appsettings empty; dev creds in Development config/UserSecrets; startup fail-fast outside Dev/Testing | Confirmed OK |
| Frontend token | Memory-only (reload = logout); no XSS-persistent storage | Known limitation (M01 decision: keep memory-only + re-login, acceptable for MVP) |
| CSP | Build-time CSP meta (`connect-src 'self'`) — fits same-origin `/api/v1` | Confirmed OK; must revisit if API host splits |
| Concurrency | Clinical record concurrency solid; **Patient/Encounter updates are last-writer-wins (no ETag)** | Confirmed gap (M02/M04 scope) |

## 6. Test baseline (pre-MVP, actual results)

| Gate | Command | Result |
|---|---|---|
| TS typecheck | `npx tsc -b --noEmit` | ✅ PASS |
| ESLint | `npm run lint` | ✅ PASS (0 errors, 248 warnings — pre-existing `no-explicit-any` policy) |
| Frontend build | `npm run build` | ✅ PASS (12.3 s; measured chunk 3.56 MB lazy; index 1.15 MB) |
| .NET restore/build | `dotnet build -c Release` | ✅ PASS (0 warnings, 0 errors) |
| `dotnet format --verify-no-changes` | ✅ PASS |
| Backend tests | `dotnet test -c Release` + coverage | ✅ **279/279 passed, 0 skipped** (Domain 109, App 95, Infra 21, API 54) |
| Architectural invariants | import-cycles + api-surface | ✅ PASS (part of vitest run) |
| Vitest full suite | `vitest run` | ⏳ running at audit time — filled in below |
| Playwright | `npx playwright test --workers=2` | ⏳ running at audit time — filled in below |

> **Post-audit update (verified run outputs):** Vitest full suite ✅ **2 638 passed / 2 skipped (intentional: parity capture, env-gated)** across 263 files, 505.6 s; Playwright ✅ **14 passed / 0 failed**, 1.8 m. Backend ✅ **279/279** (see §6). **All baseline gates GREEN.**

## 7. Confirmed defects & risks (classified)

### Confirmed (code evidence)
| # | Finding | Module fit |
|---|---|---|
| C1 | `Patients.Gender`: validator allows 50 chars, DB column `varchar(20)` → 21–50 chars pass validation then 500 | M02 |
| C2 | `Jwt:ExpiryMinutes` config dead; expiry hardcoded 480 min | M01 |
| C3 | Sync bridge ETag fallback fabricates `"<concurrencyVersion>"` when header missing → possible permanent 412 loop | M00 |
| C4 | No `beforeunload`/`pagehide` flush: debounced/in-flight edits lost on tab close once bridge is wired | M00 |
| C5 | Autosave listener active during `switchEncounter` phase-B fetch (`isHydrating` set only at commit) → mid-switch edits can schedule a post-switch save against the new chart | M00 |
| C6 | Audit trail minimal (2 write sites, `ClientIpAddress` always null, `DetailsHash` not a hash, no read API despite documented contract) | module-by-module |
| C7 | No rate limiting/HSTS/security headers | M01 |
| C8 | Patient/Encounter mutations lack concurrency control | M02/M04 |
| C9 | Doc-vs-code conflicts: deciduous 51–85 key handling (validator accepts, docs forbid — validator+fixtures+tests are authoritative), payload min-version claims, role taxonomies, audit endpoint documented but absent | docs fixes per module |

### Strongly suspected
| # | Finding |
|---|---|
| S1 | Backend FHIR `FhirBundleBuilder` plan/ServiceRequest derivation may not match frontend `toFhirPlan` divergence-only semantics (M00 acceptance criterion targets exactly this) |
| S2 | `MedCanvasApiFactory` mutates process-wide env vars — parallel test assemblies could race (currently safe: projects run sequentially in CI) |
| S3 | No-op save detection heuristic may emit spurious revisions on rapid hydrate→edit sequences |

### Not reproduced / no evidence found
- Zero TODO/FIXME markers in `src/api`, `src/features`, backend `src` (grep clean).
- No import cycles (AST-verified).
- No mocked/fake API responses in production code paths.

### Known limitations (documented, accepted)
- FHIR export scope (perio deep pockets, restoration history) per `docs/backend/operations-guide.md`.
- Memory-only frontend token (no refresh) — MVP decision pending in M01.
- Single-node Testcontainers.

### Requires external verification
- GitHub-hosted CI parity with local results (verified green on `main` HEAD at audit time).

## 8. Reuse opportunities (MVP acceleration)

- `OdontogramSyncBridge` + `MedCanvasApiClient` are production-grade and fully tested — M01/M04 only need to *wire* them to UI.
- Two-clinic isolation test fixtures + `MedCanvasApiFactory`/`PostgreSqlFixture` patterns bootstrap all new modules' integration tests.
- Canonical payload fixture pipeline (`npm run fixtures:generate` → backend drift tests) extends to any new clinical JSON contracts.
- Role/policy/membership machinery extends to new resources with one policy line + predicate discipline.
- i18n pipeline (en static, uk lazy, parity tests) ready for workspace strings.

## 9. Blockers

**None.** The repository is a healthy baseline; all MVP modules are greenfield extensions within established architecture. The only process-level conflict (TZ §5.3/§8/§13 forbid auto-merge vs program §6/§12 authorizing it) is resolved as follows: the TZ governs *functional scope*; the program governs *execution process* (later, explicit owner instruction). Merges will happen only after every gate is green, CI verified on the exact HEAD, self-review complete, and no P0/P1 unresolved — and never against branch protections (currently none exist; if protections are added later, the program stops and defers to them).
