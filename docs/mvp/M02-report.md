# MEDCANVAS — MODULE M02 IMPLEMENTATION & QUALITY REPORT

**Module:** M02 — Patient 360
**Branch:** `feat/mvp-patients` · **Base:** `c07182a` (M01 merge) · Final SHA recorded in the PR.

## 1. Purpose
Full patient management over the existing Patient API: searchable/sortable list, creation with duplicate warnings, editing under optimistic concurrency, patient 360 card, and archive/restore without physical deletion.

## 2. Implemented requirements (TZ §M02)

| Requirement | Implementation |
|---|---|
| **FR-101 Create** | Patients page form (all fields, client+server validation mirrored); server unchanged shape + `ETag`/`concurrencyVersion` on responses. Only names are required, per business rules. |
| **FR-102 List** | Server pagination + search + **server-side sorting** (`lastname`/`firstname`/`birthdate`/`created` × asc/desc, whitelisted in the handler) + `includeArchived` filter; empty/error/loading states; retry control. |
| **FR-103 Card** | Patient detail page: basic info, contacts, medical alerts, visit history (`/patients/{id}/encounters`), latest odontogram **metadata** (updated/version/finalized) — the chart editor itself is deliberately deferred to M04 with an honest note (no fake functionality). |
| **FR-104 Edit** | Edit form carrying `concurrencyVersion`; `PUT` now requires strong `If-Match` (**428** missing, **412** stale — same semantics as odontogram saves, parser reused); domain `UpdateDemographics(expectedVersion)` throws on stale versions and increments the token; EF `IsConcurrencyToken` backs it at the DB level. |
| **FR-105 Archive** | `POST /patients/{id}/archive|restore` (soft state, audited `PATIENT_ARCHIVED`/`PATIENT_RESTORED`); archived patients: excluded from the default list, readable directly and via `includeArchived`, history intact, **new encounters blocked (400 DomainException)**. No physical delete anywhere. |
| **FR-106 Duplicates** | `GET /patients/duplicates` by MRN or name+DOB (clinic-scoped, advisory); the create/edit form surfaces probable duplicates on blur without ever blocking or merging. |
| **Defect fixes** | C1: gender validator 50→20 chars (aligned with `varchar(20)` column — was 500-on-DB-error). C8: patient concurrency token + ETag protocol. |

## 3. Architecture / DB / API / UI changes
- **DB:** migration `AddPatientConcurrencyVersion` (`Patients.ConcurrencyVersion integer NOT NULL DEFAULT 1`, concurrency token) — additive, verified on clean Testcontainers.
- **Domain:** `Patient.ConcurrencyVersion`, version-checked `UpdateDemographics`, `Archive`/`Restore` (renamed from Deactivate/Activate to match clinical semantics).
- **API:** 3 new endpoints + list parameters + If-Match/ETag on reads/writes (see `docs/backend/api-contracts.md` §2.2). Encounters: archived-patient guard in `StartEncounter`.
- **Frontend:** `PatientsPage` (filters/search/sort/pagination/create-edit with duplicate warnings/archive/restore), `PatientDetailPage` (360 card), nav+routes for all roles with Viewer read-only gating, i18n uk/en (+50 keys), styles.

## 4. Validation matrix & test evidence (actual runs)
| Suite | Result |
|---|---|
| Domain | **122/122** (+2: stale-version conflict, archive/restore lifecycle) |
| Application | **152/152** (gender length aligned; no new validators needed beyond matrix covered by handler tests) |
| Infrastructure (real PG) | **21/21** (both M01+M02 migrations on clean DB) |
| API integration | **95/95** (+9: 428/412 preconditions, ETag on reads, archive lifecycle incl. default-list exclusion/history readability/encounter-block, restore, foreign-clinic 404, DB-verified Viewer 403, duplicates two-clinic isolation, sorting, no-criteria no-scan) |
| Vitest | **2669 passed / 2 skipped** (+6 workspace patients tests) |
| Playwright | **16/16** (+1 patients list/card E2E) |
| tsc / eslint / build / dotnet build / format | recorded at PR (all green locally; lint 0 errors) |

## 5. Security & tenant isolation
All new endpoints clinic-scoped (foreign-clinic archive/id ⇒ 404 without existence disclosure — tested); role matrix enforced server-side and DB-verified (Viewer 403 with a real Viewer membership — the test proves the DB role wins over token claims); audit events for archive/restore; duplicate hints never cross clinics; no PHI in logs.

## 6. Concurrency & resilience
Strong-ETag protocol identical to odontogram saves: missing If-Match ⇒ 428, stale header/body ⇒ 412 (header/body mismatch ⇒ 400 via parser); EF concurrency token catches races at SaveChanges (`DbUpdateConcurrencyException` ⇒ 412 by middleware); edit form carries the version it read.

## 7. Known limitations
- Duplicate detection is exact-match on MRN or name+DOB (no fuzzy matching in MVP).
- Patient card shows latest-chart metadata only; the interactive chart arrives with M04's encounter workspace.
- List search is `ToLower().Contains` server-side (index-friendly improvement deferred with functional indexes if profiling demands).

## 8. Verdict
`READY FOR INDEPENDENT REVIEW` (CI verification on PR HEAD pending at publication; all local gates green).
