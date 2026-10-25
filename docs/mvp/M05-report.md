# MEDCANVAS — MODULE M05 IMPLEMENTATION & QUALITY REPORT

**Module:** M05 — Treatment Planning, Procedure Catalog & Estimates
**Branch:** `feat/mvp-treatment-planning` · **Base:** `6b365ba` (M04 merge) · Final SHA recorded in the PR.

## 1. Implemented requirements (TZ §M05)

| Requirement | Implementation |
|---|---|
| **FR-401 Catalog** | `ProcedureCatalogItem` aggregate (per-clinic unique code ⇒ 409 on duplicate, foreign clinic may reuse the code — tested); Admin CRUD UI (price list page) with deactivate/activate; prices `decimal`/`numeric(12,2)` UAH. |
| **FR-402 Plan creation** | `TreatmentPlan` created from a source encounter (validated: same clinic, same patient — INV-003 ⇒ 409 cross-patient); items added with tooth (FDI-validated), surface (whitelist), phase, quantity 1–20. UI: plans page per patient + item builder. |
| **FR-404 Estimate** | `ItemTotal = Quantity × UnitPriceSnapshot`, `EstimateTotal = Σ` — computed **server-side** in the domain and surfaced in every DTO/UI display. |
| **FR-405 Price snapshot** | `UnitPriceSnapshot` captured at insertion from the catalog; **later catalog edits never mutate a plan** (domain + integration test proves it through the real API). |
| **FR-406 Phases** | Free-text phase per item, rendered in the plan table. |
| **FR-407 Approval** | Draft → Proposed (submit; empty plan rejected) → Approved (locks terms: item add/remove ⇒ 400 after submission, tested). Cancel from any non-terminal state. Version increments on every mutation. |
| **INV-006/011** | A visual plan is never a procedure: approval locks *planned terms* only; performed procedures (M06) require explicit recording. |

## 2. Architecture / DB / API / UI
- **DB** (migration `AddTreatmentPlanning`): `ProcedureCatalogItems` (unique (clinic, code)), `TreatmentPlans`, `TreatmentPlanItems` (FK Restrict to catalog keeps historical snapshots; Cascade to plan), all money `numeric(12,2)`.
- **Domain**: plan state machine, item validation (FDI/expected surfaces via ISO 3950 regex), price snapshot, computed totals.
- **API**: `CatalogController` (Admin per `CanManageClinic`), `TreatmentPlansController` (read: CanReadPatients; mutations: CanMutateEncounters — Clinician/Admin per TZ §3.2).
- **UI**: price-list admin page (nav), plans page per patient (create from InProgress encounter, item builder with catalog picker + live estimate, submit/approve/cancel), patient-card entry link, uk/en i18n.

## 3. Test evidence (actual runs)
| Suite | Result |
|---|---|
| Domain | **168/168** (+20: catalog invariants incl. price rounding, item FDI/surface/quantity matrix, plan lifecycle incl. sealing, snapshot isolation) |
| Backend full | **460/460** (Application 152 · Infrastructure 21 · API 119, +6 integration: duplicate code 409 + foreign reuse, full lifecycle with server estimate 5001.00, snapshot isolation through catalog edit, foreign-catalog injection 404, cross-patient encounter 409, per-clinic plan listing) |
| Vitest | +2 catalog page tests (create/list, duplicate 409 surfaced) |
| tsc / lint / build / Playwright | recorded at PR (all green locally) |
| dotnet build / format | PASS / PASS |

**Defect caught by tests during development:** the plan-create handler initially returned 201 without persisting (missing DbSet.Add) — caught by the lifecycle integration test asserting items actually round-trip; fixed and regression-covered.

## 4. Security & tenant isolation
Cross-clinic catalog injection ⇒ 404 (no existence disclosure, tested); plans clinic-scoped (foreign patient/encounter ⇒ 404/409, tested); role enforcement server-side (Clinician can plan, only Admin manages prices); no PHI in logs.

## 5. Known limitations
- Catalog item code is immutable after creation (rename via new code) — documented.
- Plan amendment after approval = cancel + new plan (full versioning tree is post-MVP).
- Item execution status joins in M06 (plan items carry no per-item execution state yet).

## 6. Verdict
`READY FOR INDEPENDENT REVIEW` (CI verification on PR HEAD pending at publication).
