# 02 — Current Architecture (As-Is, Verified Against Source)

**Base revision:** `f970f28` · Companion to `01-repository-audit.md`

---

## 1. System shape today

```
┌────────────────────────────────────────────────────────────────────┐
│ Browser (single page, no routing)                                  │
│  main.tsx → App → OdontogramProvider → ShellLayout                 │
│   ├─ Odontogram engine (src/odontogram.ts facade, 349 exports)     │
│   │   ├─ state/    module-scope Maps + live-binding toothState     │
│   │   ├─ engine/   rendering, controls, dualStateGate, navigation  │
│   │   ├─ registry/ clinical axes catalog → SVG layers + FHIR       │
│   │   ├─ fhir/     toFhir / toFhirPlan / toFhirPerio / fromFhir    │
│   │   ├─ surfaces/ React control cards (composable UI tier)        │
│   │   └─ anatomy/  classic profile + lazy measured (~3.6 MB)       │
│   ├─ src/api/  MedCanvasApiClient + OdontogramSyncBridge  ←────────┼──┐
│   └─ src/persistence.ts  LocalStorage standalone fallback          │  │
│                                                            NOT WIRED│  │
└────────────────────────────────────────────────────────────────────────┘
                                                                         │ HTTPS /api/v1,
                                                                         │ JWT bearer,
                                                                         │ strong ETags
┌────────────────────────────────────────────────────────────────────┐   │
│ ASP.NET Core modular monolith (backend/)                            │◄──┘
│  Api: 4 controllers, If-Match parser, RFC 7807 middleware           │
│  Application: MediatR CQRS (ValidationBehavior → LoggingBehavior)   │
│  Domain: 8 aggregates, invariants, finalize seals                   │
│  Infrastructure: EF Core/Npgsql (jsonb), JWT, PBKDF2,               │
│                  ActiveClinicMembershipHandler (DB-verified RBAC)   │
└────────────────────────────────────────────────────────────────────┘
                    │
              PostgreSQL 16 (Docker; 1 migration: InitialCreate)
```

## 2. Frontend engine (frozen core)

- **Public API freeze:** `src/odontogram.ts` re-exports 349 symbols; parity goldens (`api-surface-golden.json`, SVG fingerprints, FHIR goldens, canonical fixtures, shell DOM) fail on any unintended drift. `App.tsx` adds 184 exports.
- **State:** `charts.status` / `charts.plan` Maps with a live `toothState` alias rebound by `setActiveChartMode()`; plan lazily cloned from status on first Plan entry (serialize→hydrate clone to avoid inventing recurrent caries). Payload v2.22 `{version, globals, teeth, case?, plan?}`, omit-when-empty sub-records, legacy <2.3 hydration.
- **Edit gate (DS-1):** Plan edits apply directly; Status edits mirror to plan for un-plan-edited teeth; Status edits on plan-edited teeth raise the blocking `DualStateConfirm` modal.
- **Notification bus:** synchronous `onStateChange()` listeners + injected post-notify hook — the intended autosave tap.
- **Lifecycle:** `initOdontogram`/`destroyOdontogram`/`rebuildGrid`/`rewireControls` with `initToken` cancellation; module-scope singleton ⇒ **one engine instance per JS context**; every host mount must own a full init/destroy cycle and re-hydrate (SaaS multi-page constraint, see `docs/engine-lifecycle.md`).
- **Zero import cycles** enforced by AST test; state tier may never import the facade.

## 3. Sync bridge (`src/api/odontogramSync.ts` — the M00 subject)

- Statuses: `idle | loading | saving | saved | conflict | error | recovery-required`.
- Save path: serialized queue (one in-flight PUT; concurrent callers coalesce into a pending batch), snapshot captured at execution time, `generation` token + encounter-identity check disarm stale responses, truthful revision accounting (`localRevision` vs `savedRevision`, no-op saves skip network and don't inflate revisions).
- Conflict (412): autosave stops, fresh server copy fetched, `onConflict` callback; save/switch rejected until external resolution.
- Encounter switch: two-phase — prepare (flush pending edits, fetch target, cross-patient check, parse-before-hydrate) then commit (hydrate with rollback snapshot; hydration+rollback failure ⇒ fail-closed `recovery-required` lock stopping all writes/loads/switches; only `recoverChart(verifiedSnapshot)` re-opens).
- Known defects C3–C5 (ETag fallback fabrication, no unload flush, mid-switch autosave listener) — M00 scope.

## 4. Backend conventions (binding for all MVP modules)

- Clean Architecture: Domain (no deps) ← Application (Domain only) ← Infrastructure (App) ← Api (composition root). NetArch-equivalent discipline via review + tests.
- CQRS: one record + one handler + one validator per command/query under `Features/<Aggregate>/`; `CancellationToken` forwarded everywhere; single `SaveChangesAsync` per handler (atomic); audit events written in the same save.
- Validation: FluentValidation at command boundary → RFC 7807 `ValidationProblemDetails` (400) with stable `https://medcanvas.health/errors/*` type URIs.
- Persistence: explicit `IEntityTypeConfiguration<T>`, snake_case tables, `timestamptz` UTC, FKs Restrict (Cascade only membership→user, revision→record), unique indexes per aggregate, jsonb for clinical snapshots, `IsConcurrencyToken` where optimistic locking applies, migrations via CLI (never auto-migrate on boot), Testcontainers `postgres:16-alpine` pinned.
- Auth: `[Authorize]` + named policies (`CanRead*/CanMutate*/CanFinalize*/CanExportFhir`) → role sets; `ActiveClinicMembershipHandler` re-verifies membership + user + clinic activeness per request (instant revocation); tenant = `clinic_id` claim only; cross-tenant = 404.
- Clinical payload: backend validates the canonical schema (size/depth/version/FDI/enum/peri/radix) against frontend-generated fixtures — any payload change is contract-tested both sides.

## 5. What each MVP module inherits vs must build

| Module | Inherits | Must build |
|---|---|---|
| M00 | Sync bridge core, ETag protocol, FHIR builders | Fix C3–C5, recoverChart strict validation, autosave policy after recovery, backend FHIR plan semantics alignment + regression tests |
| M01 | JWT auth, membership handler, role model | Routing + workspace shell, login/logout UI, clinic creation/onboarding, membership management API+UI, clinic switching (token/claim design), rate limiting, role-aware nav |
| M02 | Patient API + validators + isolation fixtures | Patient UI (list/create/edit/detail), pagination/search UI, archive endpoint+UI, duplicate detection, gender-length fix (C1), patient concurrency (C8 decision) |
| M03 | Clean-architecture + concurrency patterns | Appointment aggregate + state machine, availability, chairs/resources, overlap prevention at DB level, calendar UI, reschedule/cancel/confirm flows, DST-safe clinic timezone |
| M04 | Encounters, sync bridge, engine | Encounter↔appointment linkage, clinician calendar view, encounter workspace UI wiring the bridge, save-status/conflict/recovery UI, revision history view, finalization guard UI |
| M05 | Payload `plan` semantics, procedure-less billing = none | Procedure catalog, treatment plans/items/phases, price snapshots, estimate math, approval/versioning, UI |
| M06 | M05 aggregates | PerformedProcedure aggregate, idempotency keys, plan-item status sync, corrections with audit, UI |
| M07 | M06 | Invoice/InvoiceItem/SimulatedPayment aggregates, decimal money, partial payments, overpay guard, idempotency, DEMO labeling, UI |
| M08 | M03–M07 | Follow-up booking shortcuts, role dashboards (real data only) |
| M09 | All | Cross-module E2E, concurrency/failure drills, release report |

## 6. Key risks when extending

1. **Engine singleton vs multi-page routing:** each route hosting the chart must run a full init/destroy cycle; StrictMode double-mounts already supported via `bindOnce`.
2. **Frozen API + goldens:** every module must keep `api-surface` parity green; UI additions go in new modules, not by mutating frozen exports.
3. **Token/clinic model:** current JWT pins one `clinic_id` for 8 h; FR-004 (clinic switching) needs either short-lived tokens + re-login switch, a switch endpoint issuing a new token, or refresh design — decision in M01.
4. **No transaction behavior yet:** fine while handlers save once; M05–M07 handlers touching multiple aggregates must use explicit transactions (EF execution strategy).
5. **Audit breadth:** each new module must write `ClinicalAuditEvent`s for its critical actions (C6 pattern).
6. **Money:** PostgreSQL `numeric` + .NET `decimal` only; never float. UAH formatting client-side.
