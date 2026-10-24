# 03 — Requirements Traceability Matrix

Source: `docs/mvp/MedCanvas-MVP-TZ-v1.0.md` (authoritative). Columns group the program's required fields:
**Existing** (code today) · **Gap** (work required, split BE/FE) · **Rules/Auth** (validation + roles) · **Tests** (unit / integration / E2E) · **Evidence** (completion proof) · **Status** (Planned / In Progress / Verified / Blocked).

Legend: ✅ exists · ◐ partial · ✗ missing.

---

## M00 — Clinical Safety Foundation (`fix/mvp-clinical-safety-gate`)

| Req | Existing | Gap | Rules/Auth | Tests | Evidence | Status |
|---|---|---|---|---|---|---|
| Strict snapshot validation before `recoverChart()` | ◐ `recoverChart` runs `importStatus` from verified arg or rollback copy | BE/FE: validate structure (version, teeth, FDI keys) **and** encounter/patient identity before unlock; invalid snapshot keeps lock | Invalid JSON/version/identity ⇒ reject + stay `recovery-required` | Unit: malformed snapshot, wrong encounterId, wrong patientId, version drift; regression for MC-P0-01 | Vitest suite green; lock stays on every negative case | Planned |
| State belongs to correct encounter | ◐ cross-patient check in `switchEncounter`/`load` | FE: extend identity checks to `recoverChart` + save path; BE: server rejects snapshot→encounter mismatch via existing encounter scoping (verify) | INV-003 | Unit + API integration (wrong-encounter PUT) | Tests prove patient-A chart can never persist under patient-B encounter | Planned |
| Protect edits during encounter switch | ◐ two-phase switch; ✗ autosave listener active during phase-B fetch (C5) | FE: switching guard — defer/queue autosave scheduling until commit; edits during switch are either flushed to source or explicitly preserved | INV-010 | Unit: edit-during-switch does not vanish nor write to target chart | Deterministic vitest regression | Planned |
| Autosave after safe recovery | ✗ no explicit policy | FE: explicit re-enable policy (opt-in via options; default stays disabled until caller acts) | Policy documented in bridge API | Unit: recovery → autosave off by default; on by explicit flag | Tests + API doc | Planned |
| Truthful `dirty/saving/saved/error/conflict/recovery-required` | ◐ mostly present | FE: `saved` only after server ack (verify savedRevision logic); fix ETag fallback fabrication (C3) | INV-010 | Unit: no-op save doesn't show saved-without-ack; missing ETag header ⇒ error not fabricated tag | Bridge test suite extension | Planned |
| Stale async response protection | ◐ generation tokens on save/switch | FE: verify/extend to load/recover paths | — | Unit: late responses after switch/load/recover ignored | Tests | Planned |
| Status/Plan coordination in server FHIR export | ◐ backend `FhirBundleBuilder`; frontend `toFhirPlan` divergence-only | BE: align ServiceRequest derivation to plan-divergence semantics; unchanged Status must not produce new ServiceRequests (S1 — verify first) | FHIR R4 | Unit (FhirBundleBuilder) + API integration golden | FHIR bundle regression tests | Planned |
| *(AC) unload flush* | ✗ (C4) | FE: `pagehide`/`visibilitychange` flush of pending save | INV-010 | Unit: pending debounce flushed synchronously | Test | Planned |

## M01 — SaaS Workspace, Identity & Clinic Context (`feat/mvp-workspace-identity`)

| Req | Existing | Gap | Rules/Auth | Tests | Evidence | Status |
|---|---|---|---|---|---|---|
| FR-001 Auth: login/logout/profile/active clinic | ◐ backend login/me done; client token memory-only; ✗ UI, logout endpoint is client-side | FE: login page, guard, session context; BE: wire expiry config (C2), logout = client discard (MVP) | Roles verified server-side | API tests exist; add FE tests + E2E login/logout | E2E: login → workspace → logout → protected route blocked | Planned |
| FR-002 Clinic creation + first admin (controlled onboarding) | ✗ (users/clinics seed-only) | BE: `POST /clinics/onboarding`-style controlled create (first user becomes ClinicAdmin of new tenant; cannot self-assign to existing clinic); FE: onboarding screen | Anti-self-escalation: existing clinic ids rejected for new user self-assignment | Unit + API (negative: join existing clinic as admin without membership ⇒ 403/404) | Tests + UI flow | Planned |
| FR-003 Staff membership management | ✗ | BE: invite/assign role/revoke/list members commands + endpoints (ClinicAdmin only); FE: staff screen | ClinicAdmin-only policy; revocation instant via membership handler | API tests incl. revoked member 403 | Tests + UI | Planned |
| FR-004 Clinic switching | ✗ (clinic pinned in token) | BE: token exchange endpoint (`POST /auth/switch-clinic` → new token for membership) or short-lived tokens; FE: clinic switcher clearing ALL caches (TanStack Query cache reset) | Membership re-verified; caches tenant-scoped | Unit (cache isolation) + API + E2E switch | E2E: switch clinic shows no stale data | Planned |
| FR-005 Workspace shell & navigation | ✗ (no routing) | FE: React Router layout: dashboard/patients/calendar/encounters/plans/invoices/settings/profile; unbuilt modules hidden (no fake UI); i18n uk/en | Route guards by role | FE tests (guards, empty states); E2E nav | E2E + a11y checks | Planned |
| Engine & public API keep working | ✅ | Regression-only | — | Existing parity goldens | All existing suites green | Planned |

## M02 — Patient 360 (`feat/mvp-patients`)

| Req | Existing | Gap | Rules/Auth | Tests | Evidence | Status |
|---|---|---|---|---|---|---|
| FR-101 Create patient | ◐ BE done; ✗ FE | FE: form with per-field validation; BE: fix gender length mismatch (C1: 50→20 or column widen) | Only business-justified required fields (names); MRN unique per clinic | Validator tests (§7.2 matrix); FE form tests | UI→PG round trip | Planned |
| FR-102 List: pagination/search/sort/filter | ◐ BE paging+search; ✗ sort, archived filter, FE | BE: sort + `isActive` filter params; FE: list screen | Tenant-scoped; server-side everything | API tests (paging bounds, filter, sort); FE tests | UI list with real data | Planned |
| FR-103 Patient card (sections) | ✗ | FE: card layout — demographics, contacts, alerts, visit history, latest odontogram (read-only), placeholders for future modules (no fake data) | CanReadPatients | FE tests + E2E | E2E open card | Planned |
| FR-104 Edit | ◐ BE done; ✗ FE | FE: edit form; BE: C1 fix; optional concurrency for patients (C8 — decide: ETag like odontogram or accept LWW; TZ requires "конкурентні оновлення" testing ⇒ add concurrency token) | Forbidden-field mutations rejected | Validator + API tests | Edit persists after reopen | Planned |
| FR-105 Archive (no physical delete) | ◐ `IsActive` field exists; ✗ endpoint/UI | BE: archive/restore command; FE: archive action with confirmation | Archive hides from default list, keeps history | API tests (archived not in default list, history intact) | Tests + UI | Planned |
| FR-106 Duplicate detection | ✗ | BE: duplicate hint query (same MRN / same name+DOB) — suggest, never auto-merge | Read-only hint | API tests | UI warning on create | Planned |
| Tenant isolation | ✗ tested | Regression per new endpoint | 404 anti-enumeration | Two-clinic tests | CI green | Planned |

## M03 — Appointments, Doctor Schedule & Resources (`feat/mvp-scheduling`)

| Req | Existing | Gap | Rules/Auth | Tests | Evidence | Status |
|---|---|---|---|---|---|---|
| Appointment aggregate + statuses `Scheduled/Confirmed/Arrived/InProgress/Completed/Cancelled/NoShow` | ✗ | BE: aggregate + server state machine + validator + migration | Transitions enforced server-side | Domain transition tests (legal+illegal) | Tests | Planned |
| FR-201 Create booking | ✗ | BE command/endpoint; FE booking dialog (patient, clinician, date/time, chair) | CanManageCalendar roles | API + FE tests | UI booking persists | Planned |
| FR-202 Overlap prevention (clinician + chair) incl. concurrency | ✗ | BE: DB-level exclusion (unique index on overlap via `tsrange` EXCLUDE or serializable check) — must survive two simultaneous requests; FE: availability feedback | INV-005 | Concurrency integration test (parallel double-book ⇒ exactly one 409) | Testcontainers proof | Planned |
| ProviderAvailability (weekday schedule + breaks + exceptions) | ✗ | BE entity + endpoints; FE editor (ClinicAdmin) | Admin manages; others read | CRUD tests | UI + tests | Planned |
| ClinicResource/Chair | ✗ | BE entity + CRUD; FE management screen | Admin-only mutations | API tests | UI + tests | Planned |
| FR-203 Calendar (day/week, filter by clinician/status) | ✗ | FE calendar view | Read per membership | FE tests + E2E | E2E calendar | Planned |
| FR-204 Reschedule (history kept) | ✗ | BE command + audit; FE action | Status rules | API tests | Tests | Planned |
| FR-205 Cancel (user/time/reason kept, no delete) | ✗ | BE + FE | INV-012 audit | API tests | Tests | Planned |
| FR-206 Confirm / Arrived | ✗ | BE transitions + FE actions | State machine | Transition tests | Tests | Planned |
| FR-207 Re-booking from patient card / completed visit | ✗ | FE shortcut (M08 deepens) | — | E2E | E2E | Planned |
| Clinic timezone (Europe/Kyiv) + DST correctness | ✗ | BE stores UTC; FE renders clinic TZ; boundary tests | — | Validator boundary tests (DST transitions) | Tests | Planned |

## M04 — Clinical Encounter Workspace & Odontogram (`feat/mvp-clinical-workspace`)

| Req | Existing | Gap | Rules/Auth | Tests | Evidence | Status |
|---|---|---|---|---|---|---|
| FR-301 Appointment ≠ Encounter linkage | ◐ encounter standalone | BE: optional `AppointmentId` on encounter (+ completeness invariant: encounter's patient = appointment's patient) | INV-002/003 | Domain + API tests (cross-patient appointment link rejected) | Tests | Planned |
| Clinician sees own schedule → opens patient | ✗ (after M03) | FE: clinician calendar → patient card → start encounter | Role: Clinician (+Admin w/ clinical permission per TZ §3.2 note) | E2E | E2E flow | Planned |
| FR-302 Clinical notes until completion | ◐ `UpdateNotes` exists; completed blocks | Verify + FE notes UI | CanMutateEncounters | API tests (edit after complete ⇒ 4xx) | Tests | Planned |
| FR-303 Reuse engine — no alternative odontogram | ✅ | Wiring only | — | Engine regression suites stay green | Green suites | Planned |
| FR-304 Autosave with ETag/concurrency | ◐ bridge complete, unwired | FE: wire bridge into encounter screen (status chip, conflict modal, recovery screen) after M00 fixes | INV-010 | Bridge tests (existing 27) + new UI tests | E2E clinical editing persists | Planned |
| FR-305 Revision history viewable (authorized) | ◐ revisions API exists | FE: history viewer; BE: verify authorization scope | CanReadOdontogram | API tests (cross-clinic 404) | UI + tests | Planned |
| FR-306 Completion protects clinical data | ◐ encounter complete blocks notes; odontogram finalize seals | Verify encounter completion blocks odontogram edits (or requires explicit amendment process); FE finalization UX | Finalize ⇒ immutable + audited | API tests (write after complete ⇒ 4xx/422) | Tests | Planned |
| No PHI in logs | ✅ pattern exists | Regression per new endpoints | — | PHI sentinel tests | CI green | Planned |

## M05 — Treatment Planning, Procedure Catalog & Estimates (`feat/mvp-treatment-planning`)

| Req | Existing | Gap | Rules/Auth | Tests | Evidence | Status |
|---|---|---|---|---|---|---|
| ProcedureCatalogItem (clinic price list) | ✗ | BE aggregate + CRUD (Admin); FE catalog manager | Per-clinic unique code; Admin manages | CRUD + validator + isolation tests | UI + tests | Planned |
| TreatmentPlan/Item entities, statuses `Draft/Proposed/Approved/InProgress/Completed/Cancelled` | ✗ | BE aggregates + state machine + versioning | Transitions server-enforced | Domain tests | Tests | Planned |
| FR-402 Plan creation (procedures, teeth, qty, phases) | ✗ | BE commands; FE plan builder in encounter context | Clinician (or Admin w/ clinical permission) | API + FE tests | UI plan persists | Planned |
| FR-403 Visual Plan → proposed procedures (doctor confirms; visual state ≠ ordered procedure) | ◐ plan payload exists | BE/FE: proposal derivation from plan divergences (reuse FHIR plan-axis semantics), explicit confirmation required | INV-011 | Unit: unconfirmed plan state never becomes billable/procedure | Tests | Planned |
| FR-404 Estimate math (`ItemTotal = qty × UnitPriceSnapshot`; `EstimateTotal = Σ`) | ✗ | BE server-side decimal calc | INV-007 | Unit: decimal precision/rounding/zero/negative/max | Tests | Planned |
| FR-405 Price snapshot isolation | ✗ | BE `UnitPriceSnapshot` on items; catalog edits never mutate plans | — | Test: change catalog ⇒ estimate unchanged | Tests | Planned |
| FR-406 Phases | ✗ | BE field + FE grouping | — | Tests | UI | Planned |
| FR-407 Approval versioning | ✗ | BE approve command locks terms; later changes ⇒ new version/amendment | Empty/invalid plan cannot approve | Transition tests | Tests | Planned |
| Cross-clinic procedure injection impossible | ✗ | Validator: catalog item must belong to plan's clinic | INV-001 | API test (foreign catalog id ⇒ 400/404) | Tests | Planned |

## M06 — Performed Procedures & Treatment Execution (`feat/mvp-procedure-execution`)

| Req | Existing | Gap | Rules/Auth | Tests | Evidence | Status |
|---|---|---|---|---|---|---|
| PerformedProcedure aggregate (encounter link, tooth, qty, performer, price snapshot, status) | ✗ | BE aggregate + endpoints; FE recording UI in encounter | Clinician-role mutation; encounter must be open & same clinic | Domain + API tests | Tests + UI | Planned |
| FR-501 Mark planned item performed | ✗ | BE command linking `TreatmentPlanItemId`; plan-item status update per rules | INV-006 explicit confirmation | Unit: plan item transitions | Tests | Planned |
| FR-502 Unplanned procedure with explanation | ✗ | BE command requires note | — | Validator tests | Tests | Planned |
| FR-503 Partial completion across visits | ✗ | FE multi-visit support | — | E2E partial execution | E2E | Planned |
| FR-504 Treatment history in patient card | ✗ | FE history section | Read scope | FE tests | UI | Planned |
| FR-505 Idempotent recording (network retry safe) | ✗ | BE idempotency key on command | Duplicate request ⇒ same record, no double | API test: double submit ⇒ one record | Tests | Planned |
| FR-506 Controlled correction (audit, no silent delete) | ✗ | BE void/correct with reason + audit | INV-012/004 | API tests (correction keeps original visible) | Tests | Planned |
| Wrong-encounter execution impossible | ✗ | Validator: encounter open + same patient + same clinic | INV-003 | API negative tests | Tests | Planned |

## M07 — Invoices & Simulated Payments (`feat/mvp-demo-billing`)

| Req | Existing | Gap | Rules/Auth | Tests | Evidence | Status |
|---|---|---|---|---|---|---|
| Invoice/InvoiceItem from performed procedures | ✗ | BE aggregates + generation (server-computed totals, procedure price snapshots, no double-billing of already-invoiced procedures) | INV-007/008 | Unit: totals math; API: generation from encounter | Tests | Planned |
| Statuses `Draft/Issued/PartiallySimulated/FullySimulated/Voided` | ✗ | BE state machine | Void ≠ delete | Transition tests | Tests | Planned |
| SimulatedPayment (`IsSimulation=true`, idempotency key, method label) | ✗ | BE + FE payment registration | INV-008 — DEMO/SIMULATED labeling everywhere | Unit + API | Tests + UI labels | Planned |
| FR-603/604 Partial + multiple payments | ✗ | BE commands; FE payment dialog | — | API tests (multiple partials) | Tests | Planned |
| FR-605 Full-payment detection (status flip) | ✗ | BE on remaining balance = 0 | — | Unit boundary tests | Tests | Planned |
| FR-606 Overpayment forbidden | ✗ | BE validation: amount ≤ remaining | Negative tests (overpay ⇒ 409/400) | Tests | Planned |
| FR-607 Payment history, compensating corrections only | ✗ | BE void/adjust with audit | INV-004 | API tests | Tests | Planned |
| Concurrent payments race-safe | ✗ | BE transaction/locking so Σ payments ≤ total under parallel requests | INV-007 | Concurrency integration test (two racing payments) | Testcontainers proof | Planned |
| Duplicate request protection | ✗ | Idempotency key | — | API test (retry ⇒ one payment) | Tests | Planned |
| Roles: invoice create (Admin/Assistant, Clinician optional); payment simulate (Admin/Assistant) | ✗ | Policies per TZ §3.2 | Forbidden for Viewer/Clinician-default | API role matrix tests | Tests | Planned |
| Cross-clinic invisibility | ✗ | Predicates | — | Two-clinic tests | Tests | Planned |

## M08 — Follow-up & Minimal Dashboard (`feat/mvp-follow-up-dashboard`)

| Req | Existing | Gap | Rules/Auth | Tests | Evidence | Status |
|---|---|---|---|---|---|---|
| FR-701 Follow-up booking from completed encounter | ✗ (after M03) | FE shortcut prefilling patient/clinician | — | E2E | E2E step 10 | Planned |
| FR-702 Link next appointment to next treatment phase | ✗ | BE optional link appointment↔plan phase | Consistency: phase belongs to patient's plan | API tests | Tests | Planned |
| FR-703 Visit history (chronological, past+future) | ✗ | FE timeline in patient card | Read scope | FE tests | UI | Planned |
| FR-704 Dashboard metrics (today's appointments, waiting, in-progress, completed today, upcoming, demo finance) | ✗ | BE aggregate queries (real data only); FE dashboard | Role-filtered; tenant-scoped; DEMO labels on finance | API tests (isolation, counts), FE tests | UI with real numbers | Planned |
| FR-705 Role-based dashboard (admin operational / clinician personal) | ✗ | FE routing by role | Server enforces data scope | API role tests | E2E | Planned |

## M09 — End-to-End Verification & Release Hardening (`test/mvp-end-to-end-hardening`)

| Req | Gap | Evidence |
|---|---|---|
| E2E-MVP-001 full workflow (12 steps, two clinics, real UI→API→PG) | Playwright spec executing TZ §11 exactly | Green E2E run + artifacts |
| Clinic switching, permissions matrix, concurrent booking, network loss mid-edit, version conflict, retry idempotency, partial/full payments, error recovery, backup verification, a11y critical paths, production-like config check | Dedicated specs/config validation | Test reports |
| Release readiness report | `docs/mvp/final-report.md` per program §16 | Report |

## Global invariants INV-001…INV-012

Each module's test plan above cites its invariants; M09 runs a final cross-check matrix (invariant × negative test × module).

## E2E-MVP-001 step mapping

Steps 1–2 (patient, appointment) → M02/M03 E2E · 3–5 (card, encounter, odontogram) → M04 · 5–7 (plan, procedures) → M05/M06 · 7–8 (invoice, payments) → M07 · 9 (complete) → M04 · 10 (follow-up) → M08 · 11 (isolation) → every module + M09 · 12 (reload persistence) → M04/M09.
