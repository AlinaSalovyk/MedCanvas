# AGENTS.md — Developer and AI Agent Onboarding Guide

> **Project:** React Advanced Odontogram (MedCanvas)  
> **Repository:** `https://github.com/AlinaSalovyk/MedCanvas.git`  
> **Tech Stack:** React 18.3, TypeScript 5.5, Vite 7.3, Vanilla CSS, Vitest, Playwright, HL7® FHIR® R4

---

## 1. Project Purpose & Scope

**React Advanced Odontogram** is a standalone, client-side, interactive dental odontogram and periodontal charting application. It provides dental practitioners with an intuitive SVG-based graphical chart for recording tooth findings, multi-surface caries/fillings, endodontics, prosthetics, and periodontal measurements across adult (permanent) and deciduous (milk) dentitions.

### Core Capabilities
- **Dual-State Charting**: Strict segregation between current clinical state (**Status**) and planned interventions (**Plan**), protected by a confirmation gate.
- **Interactive Anatomy**: Vector SVG rendering supporting two anatomy profiles: **Classic** (compact, 16-column grid) and **Measured** (anatomically accurate roots and bridges, code-split ~3.6 MB).
- **Multi-Surface Tooth State**: 5-surface caries/filling tracking with ICDAS depth grading (0–6), CARS secondary caries, and filling defect classifications.
- **Periodontal Charting**: Full-mouth 6-site probing depths (PD), gingival margin (GM), clinical attachment level (CAL), bleeding on probing (BOP), suppuration, furcation (Glickman I–IV), plaque (O'Leary), Miller mobility, Cairo recession, and automated 2017 AAP/EFP staging & grading.
- **Standards & Interoperability**: Bi-directional HL7® FHIR® R4 export/import, SNOMED CT and ICD-10/BNO-10 diagnostic coding packs, and high-resolution vector PDF/SVG export via jsPDF.

---

## 2. Architecture Map & Layer Responsibilities

```
                               ┌────────────────────────────────────────────────────────┐
                               │                    React UI Layer                      │
                               │  App.tsx, OdontogramProvider, Composable UI Surfaces    │
                               └───────────────────────────┬────────────────────────────┘
                                                           │ (calls facade & hooks)
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │           Central Engine Coordinator Facade            │
                               │                   src/odontogram.ts                    │
                               └─────────────┬────────────────────────────┬─────────────┘
                                             │                            │
                     ┌───────────────────────┴──────────────┐             │
                     ▼                                      ▼             ▼
       ┌───────────────────────────┐          ┌───────────────────────────┐
       │   Lower-Tier State Tier   │          │    Clinical Domain Engine │
       │  src/state/chart.ts       │◄─────────┤  src/engine/dualStateGate │
       │  src/state/payload.ts     │          │  src/engine/rendering/    │
       │  src/state/notify.ts      │          │  src/engine/controls/     │
       │  src/state/caseMeta.ts    │          │  src/engine/popups/       │
       │  src/state/perio.ts       │          │  src/engine/navigation/   │
       └─────────────┬─────────────┘          └─────────────┬─────────────┘
                     │                                      │
                     ▼                                      ▼
       ┌───────────────────────────┐          ┌───────────────────────────┐
       │    Clinical Registries    │          │   Interoperability / I/O  │
       │  src/registry/axes.ts     │          │  src/fhir/ (FHIR R4)      │
       │  src/registry/restorations│          │  src/perioPdf.ts (jsPDF)  │
       │  src/dx/ (ICD-10, SNOMED) │          │  src/persistence.ts       │
       └───────────────────────────┘          └───────────────────────────┘
```

### Layer Rules
1. **Unidirectional Dependencies**: State modules (`src/state/`) must NEVER import from `src/odontogram.ts` or React components.
2. **Zero Runtime Circular Imports**: Maintained and verified by `src/__tests__/core/import-cycles.test.ts`.
3. **Public API Freeze**: `src/odontogram.ts` exports 349 public symbols, frozen and verified by `src/__tests__/parity/api-surface.test.ts`.

---

## 3. Important Source Directories & Primary Entry Points

| Directory / File | Description & Primary Entry Points |
|---|---|
| `src/main.tsx` | Web application DOM bootstrap. Mounts `<App enableNotes />`. |
| `src/App.tsx` | Main application shell (`OdontogramShell`) and layout composer. |
| `src/odontogram.ts` | Central engine facade; initializes/destroys SVG grid, registers handlers, exports public API. |
| `src/OdontogramContext.tsx` | Context provider exposing active selection, language, settings, and display modes. |
| `src/state/chart.ts` | Dual-state storage (`charts.status`, `charts.plan`), active alias `toothState`, `setActiveChartMode`. |
| `src/state/payload.ts` | Canonical per-tooth payload serialization (`serializeState`), hydration (`hydrateState`), and `defaultState`. |
| `src/state/notify.ts` | State change listener bus (`onStateChange`, `notifyStateChange`). Synchronous after every mutation. |
| `src/engine/dualStateGate.ts` | Safety-critical DS-1 edit gate (`gateToothEdit`, `gateToothEditBatch`, `requestDualStateConfirm`). |
| `src/engine/rendering/` | `toothSvgPainter.ts`: Pure functional SVG layer styling and opacity assignment. |
| `src/registry/axes.ts` | Canonical registry of all clinical axes, values, SVG layer associations, and UI options. |
| `src/dx/` | Diagnostic derivation (`derive.ts`), catalog (`codes.ts`), and national coding packs (`packs.ts`). |
| `src/fhir/` | HL7 FHIR R4 Bundle adapters (`toFhir.ts`, `fromFhir.ts`, `toFhirPerio.ts`). |
| `src/surfaces/` | Modular React cards (`ToothDetailsCard`, `CariesCard`, `FillingsCard`, `RootPeriodontiumCard`, etc.). |
| `src/anatomy/` | `profiles.ts`: Classic profile and dynamic loader `ensureMeasuredProfile()` for `measured.ts` (~3.6 MB). |

---

## 4. Safety-Critical Clinical Invariants

1. **Dual-State Separation**:
   - `charts.status` represents current examination findings; `charts.plan` represents planned treatment.
   - Plan mode edits never modify Status.
   - Status mode edits on a tooth with existing Plan edits **MUST** trigger the confirmation modal (`DualStateConfirm`). Overwriting without confirmation is strictly forbidden.
2. **Tooth Identity & Milk Teeth**:
   - Internal keys use **FDI notation (ISO 3950)**: `18`–`11`, `21`–`28`, `31`–`38`, `48`–`41`.
   - Deciduous (milk) teeth are charted as finding `toothSelection: "milktooth"` on the occupied permanent FDI tooth position. They are **NEVER** stored as separate 51–85 keys in internal maps.
3. **Caries vs. Fillings State Machine**:
   - A tooth surface cannot simultaneously render primary caries and recurrent caries.
   - An unfilled surface in `caries` renders primary caries (`caries-{surface}`).
   - A filled surface in `caries` renders recurrent caries (`subcaries-{surface}`).
4. **Periodontal Absence Semantics**:
   - Absence of a periodontal reading means "not charted", **NOT** zero mm.
   - Probing Depth (PD) `null` or `< 1` clears the site entirely (no orphan GM/BOP/suppuration readings).
   - Clinical Attachment Level (CAL) is purely derived: `CAL = PD + (GM ?? 0)`. It is **never** stored directly.
5. **Radix & Restoration Row Gating**:
   - A tooth with `toothSubstrate: "radix"` (root remnant) cannot carry a coronal restoration (`restorationType` must remain `"none"`).

---

## 5. Public API Constraints & Backward Compatibility

- The public API exported from `src/odontogram.ts` is strictly frozen.
- Any change to existing function signatures, return types, or exported constants will fail `src/__tests__/parity/api-surface.test.ts`.
- If an internal refactoring moves logic out of `odontogram.ts`, re-export the original symbols from `odontogram.ts` to preserve backwards compatibility.
- Payload version bumps: When payload schema changes, update payload version constants in `src/state/payload.ts` and ensure hydration backward-compatibility with older payloads.

---

## 6. Testing Requirements & Quality Gates

Before opening a pull request or declaring a change complete, all six verification gates must pass:

```bash
# 1. Strict TypeScript type check
npx tsc -b --noEmit

# 2. ESLint check
npm run lint

# 3. Fast architectural invariants (cycles + API surface)
npx vitest run src/__tests__/core/import-cycles.test.ts src/__tests__/parity/api-surface.test.ts

# 4. Production web application build
npm run build

# 5. Full unit & integration test suite (260+ files)
node --max-old-space-size=4096 ./node_modules/vitest/vitest.mjs run

# 6. Playwright browser E2E workflows (Chromium)
npx playwright test --workers=2
```

---

## 7. Known Nuances & Behavioral Notes

- **Measured Anatomy Profile Size**: `src/anatomy/measured.ts` contains dense SVG vectors and is ~3.6 MB. It must always be dynamically imported on demand (`ensureMeasuredProfile()`), never statically bundled in the main entry point.
- **i18n Lazy Loading**: `en.ts` is bundled statically. `uk.ts` is fetched asynchronously on demand via `src/i18n/loader.ts`. Test helper `src/i18n/translations.ts` imports both locales and is restricted to test files only.
- **Parity Golden Fixtures**: Golden fixtures exist under `src/__tests__/parity/` (FHIR bundle, SVG fingerprints, API surface). Do not modify golden fixtures to mask unintended regressions.

---

## 8. Rules for ASP.NET Core Backend Integration

1. **Frontend Remains Standalone**: The frontend must continue to function offline in local/demonstration mode using `src/persistence.ts` LocalStorage fallback.
2. **Canonical Contract**: All network serialization must use the canonical schema defined in `src/state/payload.ts` (`serializeState` / `hydrateState`) or standardized HL7® FHIR® R4 Bundles (`src/fhir/toFhir.ts`).
3. **No Direct DOM or React State Binding in API Adapters**: API client adapters must communicate exclusively with `src/odontogram.ts` via state change subscriptions (`onStateChange`) and exported setters/getters.
4. **Optimistic Locking & Concurrency Preconditions**: The backend database enforces concurrency tokens (`ConcurrencyVersion` / ETag) matching the odontogram payload version. Updates to existing clinical records MUST supply an `If-Match: "\"<version>\""` strong entity-tag matching the body `expectedVersion`. Weak ETags (`W/"..."`), wildcards (`*`), multiple tags, and unquoted numbers return `400 Bad Request` (`https://medcanvas.health/errors/malformed-etag`). Missing preconditions return `428 Precondition Required`, and version mismatches return `412 Precondition Failed`.
5. **Membership Authorization & Revocation**: Endpoints enforce role-based authorization policies backed by live database verification (`ActiveClinicMembershipHandler`). Revoked or deactivated memberships fail closed immediately, preventing unauthorized clinical mutations even with previously issued JWTs.
6. **Autosave Race-Condition Safety & Atomic Encounter Switching**: `OdontogramSyncBridge` uses a serialized queue and state machine ensuring at most one write in-flight, revision-tracked save status (preventing premature "saved" reports while local edits remain pending), clean conflict handling on 412, zero silent data overwrites, generation token isolation, and an atomic two-phase encounter switching protocol (Prepare -> Commit). If target encounter fetch fails (HTTP error, 404, 500, invalid JSON, or encounter mismatch), active encounter identity and chart are strictly preserved, preventing cross-patient chart corruption.
7. **Full Reference**: Read [`docs/backend-integration-readiness.md`](./docs/backend-integration-readiness.md) and [`docs/backend/reference-audit.md`](./docs/backend/reference-audit.md).

---

## 9. Backend Agent Skills Catalog

Whenever modifying or implementing backend code, agents must invoke and adhere to the specialized skills located in `.agents/skills/`:

| Skill Name | Path | Primary Responsibility |
|---|---|---|
| `medcanvas-backend-architecture` | `.agents/skills/medcanvas-backend-architecture/` | Clean Architecture layer boundaries, dependency rules, DI registration, modularity. |
| `medcanvas-domain-modeling` | `.agents/skills/medcanvas-domain-modeling/` | Aggregate roots, entity encapsulation, factories, domain invariants, UTC time. |
| `medcanvas-cqrs-mediatr` | `.agents/skills/medcanvas-cqrs-mediatr/` | CQRS commands/queries, MediatR handlers, transaction boundaries, cancellation. |
| `medcanvas-validation` | `.agents/skills/medcanvas-validation/` | FluentValidation rules, pipeline behavior, RFC 7807 ProblemDetails responses. |
| `medcanvas-postgresql-efcore` | `.agents/skills/medcanvas-postgresql-efcore/` | EF Core mapping, Npgsql PostgreSQL, JSONB snapshots, migrations, foreign keys. |
| `medcanvas-api-security` | `.agents/skills/medcanvas-api-security/` | JWT auth, role authorization, tenant clinic isolation (anti-IDOR), audit logging. |
| `medcanvas-clinical-payload` | `.agents/skills/medcanvas-clinical-payload/` | Native JSON schema, Status/Plan invariants, 32 FDI teeth, 100% round-trip fidelity. |
| `medcanvas-backend-testing` | `.agents/skills/medcanvas-backend-testing/` | Mandatory test gates: Unit, Domain, Handler, Real PostgreSQL Testcontainers, API tests. |

### Backend Verification Commands
```powershell
# Restore and Build
dotnet restore backend/MedCanvas.sln
dotnet build backend/MedCanvas.sln --configuration Release

# Code Formatting Verification
dotnet format backend/MedCanvas.sln --verify-no-changes

# Full Automated Test Suite with Code Coverage (268 tests passing, 0 failed)
dotnet test backend/MedCanvas.sln --configuration Release --collect:"XPlat Code Coverage"
```

For full backend architecture, database schema, and API documentation, refer to [`docs/backend/`](./docs/backend/).


