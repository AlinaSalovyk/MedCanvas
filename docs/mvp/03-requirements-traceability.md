# MVP Requirements Traceability — Current Stabilization State

Source: [MVP technical specification](MedCanvas-MVP-TZ-v1.0.md).
This replaces the obsolete Phase Zero plan. MERGED is delivery provenance;
VERIFIED below identifies specific executed evidence, not medical certification.

| Requirements | Current implementation and evidence | Acceptance state |
|---|---|---|
| M00 / INV-003,004,010 | Native Status/Plan and ETag bridge regression suites; failed-save route leave retains chart, real browser save/reload | Regression verified; dirty-chart authentication expiry remains a separate review item |
| FR-001–005 | Workspace login/onboarding/membership/switching; live authorization tests; identity cache cleanup and stale-401 regression | Core workflow verified; no refresh-token flow |
| FR-101–106 | Real browser creates/reopens synthetic patient; patient unit/API/UI regressions | Core workflow verified |
| FR-201–206 | Fail-closed weekly availability, breaks/day-off handling, DST tests, reschedule rejection, PostgreSQL EXCLUDE constraints, real booking/conflict browser flow | Tested paths verified; boolean dated working marker cannot define an extra interval |
| FR-207 / FR-701 | Patient-card follow-up prefill and real persisted follow-up booking | Verified in full-stack browser |
| FR-301–306 | Linked appointment/encounter; explicit new-chart initialization, read-only completion, canonical chart persistence/reload, save-before-leave | Tested paths verified; authentication-expiry recovery and operational history review remain |
| FR-401–407 | Catalog/plan estimate/approval through browser and real API; snapshot prices preserved in execution | Tested paths verified; amendments use cancel/new plan |
| FR-501–506 | Explicit performed procedure; linked plan terms, duplicate active execution index, payload-bound keys, controlled void and history | Execution/API regressions plus real-browser recording |
| FR-601–602 | Server-computed immutable invoice lines; one active invoice per encounter, concurrent duplicate rejection | PostgreSQL and browser verified; legacy invoices flagged rather than fabricated |
| FR-603–608 | DEMO payments, atomic balance/status/audit, role matrix, matching-key retry, conflict rejection | Real PostgreSQL races; browser loses committed response then retries identical operation without duplicate |
| FR-702 | Appointment does not have a relational treatment-plan/phase reference | OPEN acceptance gap; free-text notes do not establish this requirement |
| FR-703–705 | Encounter history links, role-scoped real dashboard, synthetic follow-up browser flow | Existing API/UI regressions; full chronological treatment/financial history still requires acceptance review |
| INV-001,002,009 | Tenant predicates/live membership; foreign patient/encounter/invoice 404; no side effects from foreign scheduling targets | Tested negative paths verified; this is not an exhaustive independent security assessment |
| INV-006,007,008,011,012 | Explicit execution, server decimal totals, permanent simulation labels, atomic audit writes | Relevant domain/API/browser tests; append-only audit database enforcement must not be inferred from older design documents |
| E2E-MVP-001 | `npm run test:e2e:fullstack`: production React, loopback ASP.NET, disposable PostgreSQL; Kyiv and New York browser zones | 2/2 browser workflows passed locally; exact final hosted HEAD still required |
| Engineering gates | See [hardening report](post-m09-hardening-report.md), CI and final coverage | Pending final ledger/signoff; no automatic merge while credential exposure is unresolved |

Historical module PRs and merge SHAs are in [PROGRESS.md](PROGRESS.md).
Current defects, policy decisions, migrations and limitations are in the
[independent report](post-m09-hardening-report.md).
