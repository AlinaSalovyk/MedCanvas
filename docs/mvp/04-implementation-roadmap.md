# 04 — Implementation Roadmap

Delivery order is the TZ dependency order. Each module: fresh branch from verified `main` → atomic commits (one logical change per file where possible, Conventional Commits) → full gates → PR → CI verification on exact HEAD → self-review → squash-merge (per program directive; see `05-quality-and-release-gates.md` § merge policy) → next module.

```
M00 fix/mvp-clinical-safety-gate      (no deps)
M01 feat/mvp-workspace-identity       (M00)
M02 feat/mvp-patients                 (M01)
M03 feat/mvp-scheduling               (M01, M02)
M04 feat/mvp-clinical-workspace       (M02, M03, M00)
M05 feat/mvp-treatment-planning       (M04)
M06 feat/mvp-procedure-execution      (M05)
M07 feat/mvp-demo-billing             (M06)
M08 feat/mvp-follow-up-dashboard      (M03–M07)
M09 test/mvp-end-to-end-hardening     (M00–M08)
```

Integration testing is **not** deferred to M09: every module ships its own API/PG/E2E tests per the TZ §7 universal standard; M09 only adds cross-module drills and the release gate.

## M00 — Clinical Safety Foundation (branch `fix/mvp-clinical-safety-gate`)

Work items (verified against source in `01-repository-audit.md` §7):
1. **FE:** strict snapshot validation in/around `recoverChart()` — structural (version/teeth/FDI) + identity (encounter/patient) checks; invalid snapshot keeps the fail-closed lock. Negative tests.
2. **FE:** encounter-switch edit protection — pause autosave scheduling for the whole switch window (not just commit); edits during switch either flush to source chart pre-commit or are preserved deterministically; regression test for C5.
3. **FE:** autosave policy after recovery — explicit opt-in re-enable (default stays off); documented + tested.
4. **FE:** truthful statuses — `saved` only on server ack; remove fabricated ETag fallback (C3): missing ETag header ⇒ `error` state, never a guessed tag.
5. **FE:** unload flush (C4) — `pagehide`/`visibilitychange` synchronous flush attempt of pending/debounced edits.
6. **BE:** verify + align `FhirBundleBuilder` plan ServiceRequest semantics with frontend divergence-only rules (S1); unchanged Status states produce no new ServiceRequests; regression goldens.
7. Stale-response coverage audit for load/recover paths.
8. All fixes land with deterministic negative-path tests (TZ §8: every clinical safety fix needs regression tests).

Out of scope: rewriting the engine, UI wiring (M04), FHIR scope expansion.

## M01 — SaaS Workspace, Identity & Clinic Context

BE: onboarding endpoint (create clinic + first admin; no self-assignment to existing clinics), membership management (invite/role/revoke/list — ClinicAdmin), clinic-switch token issuance, `Jwt:ExpiryMinutes` honored (C2), rate limiting on auth endpoints + security headers (C7 partial).
FE: React Router workspace shell (guarded routes, role-aware nav, hidden unbuilt modules), login/logout/onboarding/staff screens, auth session context (memory token + 401 interception), TanStack Query introduction with clinic-scoped cache cleared on switch, i18n keys uk/en for all new UI.
Decision needed in-module: clinic switch via token-exchange endpoint (preferred — keeps membership live-verified).

## M02 — Patient 360

BE: patient sort/filter (`isActive`) params, archive/restore command, duplicate-hint query, gender length fix (C1), patient concurrency token (C8: add `ConcurrencyVersion` + ETag on PUT).
FE: patients list (pagination/search/sort/filter + empty/error states), create/edit forms (client validation mirroring server rules), patient card sections, archive flow.
Tests: §7.2 validator matrix, §7.7 two-clinic isolation, E2E create→search→edit→archive.

## M03 — Scheduling

BE: `Appointment` aggregate + state machine (7 statuses), `ProviderAvailability`, `ClinicResource` (chairs), overlap prevention at PostgreSQL level (exclusion constraint on clinician/resource ranges for active statuses — survives concurrent inserts; fallback: serializable transaction + recheck), reschedule/cancel with audit, DST-safe UTC storage.
FE: day/week calendar (filter by clinician/status), booking dialog, reschedule/cancel/confirm/arrive actions, chair management, availability editor (admin).
Tests: state-transition matrix, concurrency double-book (exactly one succeeds), DST boundary validators, E2E admin books → clinician sees.

## M04 — Clinical Encounter Workspace

BE: encounter↔appointment linkage (FK + patient-consistency invariant), verify post-completion write protection across notes + odontogram.
FE: clinician schedule view → patient card → "start encounter" → encounter workspace hosting the odontogram engine (init/destroy lifecycle per route), wiring `OdontogramSyncBridge` + `MedCanvasApiClient` (save-status chip, conflict resolution modal, recovery-required screen), revision history viewer, notes UI, finalize flow.
Tests: bridge E2E (persist across reload), conflict keeps local edits, cross-patient never mixes, completed encounter immutable, revision access authorization, PHI log sentinels.

## M05 — Treatment Planning & Estimates

BE: `ProcedureCatalogItem` (per-clinic price list), `TreatmentPlan` + `TreatmentPlanItem` (phase, tooth/surface, qty, `UnitPriceSnapshot`, server-computed totals, decimal), plan status machine + approval versioning, plan-proposal derivation from visual Plan (explicit clinician confirmation only — INV-011), cross-clinic catalog injection blocked.
FE: catalog manager (admin), plan builder in encounter (procedures × teeth × phases, live estimate), approval flow, price-snapshot demonstration.
Tests: money precision/rounding matrix, catalog-change ⇒ estimate unchanged, empty-plan approval rejected, state transitions, isolation.

## M06 — Performed Procedures

BE: `PerformedProcedure` aggregate (encounter-scoped, performer, price snapshot, clinical note, status), idempotency key on record/complete, plan-item status transitions, correction (void + reason + audit, no deletion), "performed only by explicit action" (INV-006).
FE: performance recording UI in encounter (planned items + unplanned with mandatory note), patient treatment history.
Tests: double-submit ⇒ one record, wrong encounter rejected, partial completion across visits, corrections auditable, billing sums correct.

## M07 — Invoices & Simulated Payments

BE: `Invoice`/`InvoiceItem` generated from performed procedures (server totals, no double-billing), status machine `Draft/Issued/PartiallySimulated/FullySimulated/Voided`, `SimulatedPayment` (`IsSimulation=true`, idempotency key, compensating corrections only), overpayment forbidden, concurrent payments race-safe (row lock/serializable), decimal money.
FE: invoice generation from encounter, invoice view with **DEMO / SIMULATED PAYMENT** labeling everywhere, partial payment dialog, balance/status display, payment history.
Tests: totals, partial/full transitions, overpay negative, race (Σpayments ≤ total), duplicate request, role matrix (Clinician no payment simulation by default), cross-clinic invisibility.

## M08 — Follow-up & Dashboard

BE: appointment↔plan-phase link, dashboard aggregate queries (today's appointments, waiting, in-progress, completed today, upcoming, demo finance sums) — tenant- and role-scoped.
FE: follow-up booking shortcuts (patient card, completed encounter), role-based dashboards (admin operational / clinician personal), visit timeline.
Tests: real-data assertions, isolation (no foreign clinic numbers), DEMO labeling, E2E closed loop.

## M09 — E2E Verification & Release Hardening

Playwright `E2E-MVP-001` (TZ §11, 12 steps, Clinic A/B), clinic switching, permission matrix, concurrent booking, network loss mid-edit, odontogram version conflict, procedure retry idempotency, payment flows, error recovery, backup/restore verification, a11y critical paths, production-like config validation (startup checks), final report `docs/mvp/final-report.md` with verdict.

## Cross-cutting commitments (every module)

- Every new resource: tenant predicates + two-clinic negative tests + role policy + audit events for critical actions.
- Every new endpoint: RFC 7807 contract tests through the real pipeline.
- Every migration: applied + verified on clean Testcontainers PG.
- Frontend: uk+en strings, loading/error/empty states, a11y (WCAG 2.2 AA target), stale-response safety, no fake data.
- Documentation updated in the same PR (api-contracts, data-model, skills where conventions evolve, AGENTS.md when needed).
