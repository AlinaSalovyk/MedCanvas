# MEDCANVAS — POST-M09 INDEPENDENT AUDIT & FINAL RELEASE HARDENING REPORT

Date: 2026-10-28. Branch: `fix/mvp-final-release-hardening`.
Starting/fetched main: `d1d67daa75a6b818730c56638a529b4aad52326f`.

## Initial state and method

The working tree was clean on `docs/mvp-program-complete` at
`849d3892857a66013c1876f9e545c55d2ede40d3`. The stabilization branch starts at
fetched `origin/main`; unrelated work was preserved. GitHub confirms #12 merged,
#13 closed without merging, and #14 open. Main has no branch protection or rulesets;
this does not waive release gates. Historical main runs
[40240011367](https://github.com/AlinaSalovyk/MedCanvas/actions/runs/40240011367) and
[40240011234](https://github.com/AlinaSalovyk/MedCanvas/actions/runs/40240011234)
passed; they do not verify this branch.

The specification, repository instructions, eight backend skills, MVP supporting
documents/reports, source inventory, focused source reads, real HTTP/PostgreSQL
tests and production-build browser workflow informed this audit. Historical
reports were claims to verify. This report does not assert that every source line
has received a security review.

## Architecture reconstructed from source

Standalone `index.html` remains independent of Workspace `app.html`. Workspace
uses memory-only authentication, tenant-aware query cleanup, and hash data routing
for reliable static-host reloads. The singleton chart retains its frozen facade,
native JSON v2.22, Status/Plan gate, dynamic measured anatomy and sync bridge.

Thin controllers dispatch validated MediatR commands. Application depends on
database/repository ports; Infrastructure owns EF/Npgsql and the new transaction
lock. Domain entities retain encapsulation and no persistence dependencies.

Persisted ownership chain: Patient → Appointment → DentalEncounter → JSONB chart
and revisions → TreatmentPlan/Items → PerformedProcedure → Invoice/InvoiceItems →
SimulatedPayments. Follow-up is a new appointment for the same patient. A
relational appointment-to-plan-phase link remains absent; free text does not
establish complete FR-702 coverage.

## Independent findings matrix

| ID | Severity / evidence | Source and unsafe scenario | Correction / regression |
|---|---|---|---|
| FIN-01 | P1, reproduced rejection failures | `BillingHandlers.CreateInvoiceFromEncounterCommandHandler`: payment query ignored | One active invoice per clinic/encounter; PostgreSQL filtered unique index; transactional check; UUID numbering. Unpaid/partial/full duplicates, six racing requests, void/reissue and foreign ownership tested. |
| FIN-02 | P1, deterministically reproduced on historical main | `RegisterSimulatedPaymentCommandHandler`: independently read balances | Baseline PostgreSQL test forced both requests past balance validation: both returned 200 and persisted **1400 UAH against 1000 UAH**. Fix takes PostgreSQL clinic-row lock before all reads; payment/status/audit commit atomically. Real 700+700/1000, exact-balance, duplicate-key and payment/void races pass on the fix. |
| FIN-03 | P1, reproduced | `BillingMapping.ProjectAsync`: historical lines rebuilt from mutable procedures/catalog | Immutable owned `InvoiceItems` capture procedure ID, code/name, tooth, quantity, unit price and total. Catalog changes/source voids followed by fresh reads preserve history. |
| FIN-04 | P1, confirmed; browser retry verified | `InvoiceBillingSection`: fresh UUID per invocation | Scoped intent/key survives uncertain outcome and reload. New payments blocked until confirmation. Browser loses a committed payment response, retries identical key, and verifies no duplicate. |
| FIN-05 | P1, reproduced | Payment key reused with different payload returned unrelated success | Invoice, amount and normalized method must match; conflicts return 409. Foreign-clinic writes return 404. |
| SCH-01 | P1, reproduced | `SchedulingGuards`: missing schedule and working exceptions bypassed hours | Fail closed; weekly hours/breaks still apply to boolean working markers. Missing-window, break/day-off, DST, reschedule and concurrency tests; EXCLUDE constraints preserved. |
| SCH-02 | P1, reproduced | `AvailabilityHandlers`: foreign-target exception persisted before a 404; clinicians could edit others | Membership/editor checks precede add/remove. Rejected requests have no persisted side effects. |
| EXEC-01 | P1, pricing reproduced | `RecordPerformedProcedureCommandHandler`: approved items used current price; duplicate active execution possible | Preserve approved price/tooth/quantity/catalog; reject conflicting key reuse; transaction lock, filtered unique plan-item index and FK. |
| WIRE-01 | P1, source-confirmed | Enum DTOs emitted numbers; React expected names | Explicit DTO string-enum converters and five Web-default wire-contract tests. Domain enums unchanged. |
| UI-01 | P1, source-confirmed; real browser verified | New encounter only loaded a nonexistent chart | Explicit initialization uses canonical serializers for 32 permanent FDI positions, without prior case/Plan state; then bridge load. |
| UI-02 | P1, source-confirmed; browser verified | Reload reached standalone entry; visit history lacked encounter link | Hash data routing and history links support reopening/reload. |
| UI-03 | P1, failed-save browser verified | Route leave could destroy a dirty chart before debounce | Route/back-forward blocker and shared flush for logout/clinic switch. Failed saves retain route/edits; confirmed retry permits leaving. Finished charts read-only, autosave stopped. |
| SCH-03 | P1, source-confirmed | Calendar used browser zone/UTC dates; day queries started Monday | Clinic-zone conversion, local day boundaries/grouping/display, explicit DST ambiguity rejection; timezone unit tests and two browser zones. |
| AUTH-01 | P1 risk, regression verified | Late old-session 401 could clear current session; expiry missed cache cleanup | Compare captured request token; current expiry discards token/cache; identity changes clear QueryClient. |
| SEC-01 | Release blocker, confirmed | Local Git remote contained a credential exposed in preflight output | URL sanitized; credential never copied into repository artifacts. Owner revocation/rotation and exposure review remain unverified; automatic merge stopped. |
| BUILD-01 | P2, confirmed | `AuthControllerTests`: CS8604 | Explicit non-null assertion/runtime guard; no warning suppression. |

## Financial and migration policy

All payments remain DEMO/SIMULATED. Server totals derive from performed price
snapshots. One active invoice fixes the encounter's billable set. Extra procedures
require voiding an unpaid invoice or a new encounter. Invoices with recorded
simulated payments cannot be voided/reissued; no refund process is invented.
Unpaid void preserves snapshots; reissue creates new snapshots from currently
recorded procedures. Voids never silently rewrite history.

The database clinic-row lock deliberately serializes same-clinic billing and
procedure issuance across API instances, including clinic-wide operation keys.
It is not process-local. Dispose without commit rolls back. Financial/procedure
uniqueness violations map to controlled 409 responses.

Legacy descriptions cannot be honestly reconstructed. The snapshot flag defaults
false; original totals/payments survive, missing lines are explicit, and further
payments require review. Real migration tests start from `AddBilling`. Duplicate
active invoices cause transactional upgrade rollback preserving both rows.
Duplicate planned executions/orphan plan references likewise require review;
migrations do not delete or fabricate history.

## Scheduling policy

Empty schedule means unavailable. Existing dated exceptions have no interval;
working markers cannot expand weekly hours/breaks. Date-specific extra intervals
remain unsupported. Repeated/ambiguous DST times and intervals crossing an offset
change are rejected; ordinary slots on transition dates remain valid. UTC storage
and database clinician/chair exclusion constraints are preserved.

## Reproducible real-browser environment

Run `npm run test:e2e:fullstack` with .NET 10, Docker and Chromium installed.
Test-only `backend/tools/MedCanvas.E2EHost` reuses the existing factory, migrates a
disposable `postgres:16-alpine` database before listening at `127.0.0.1:5188`,
and disposes its host/container. Production UI runs at `127.0.0.1:4175` through
a same-origin API proxy, preserving CSP. The workflow runs in Kyiv and New York
browser zones. Existing mocked Playwright and real-HTTP M09 tests remain.

Setup uses normal onboarding/staff/catalog/chair/availability APIs; business
workflow uses the UI and real endpoints. Fault injection aborts actual requests
or committed responses, never fabricates successful business responses. Only
synthetic data is used. `fullstack-e2e.yml` adds the command to Ubuntu/Docker CI;
no production seed endpoints or real payments were introduced.

## Verification ledger

| Gate | Current direct evidence |
|---|---|
| Full Vitest | **2693 passed, 0 failed, 2 existing env-gated skips**, 2695 total; JSON report inspected |
| Existing Chromium workflows | **17/17 passed**, two workers |
| Real full-stack Chromium | **2/2 passed**, Kyiv/New York; committed-payment-response loss, unavailable slot, failed-save route retention, reload and cross-tenant access |
| TypeScript | PASS |
| ESLint | PASS, 0 errors / 248 existing warnings |
| Production build | PASS (used by both browser suites); existing large-chunk/Browserslist-data notices |
| .NET Release build | PASS, 0 warnings / 0 errors |
| .NET format | PASS after correcting changed test-file whitespace |
| Full backend/coverage | **525/525 passed**, 0 failed/skipped: Domain 175, Application 157, Infrastructure 23, API 170. Includes real PostgreSQL migration/concurrency/tenant tests. |
| Architectural parity | **13/13 passed** in explicit API-surface/import-cycle run; full suite also includes canonical native/FHIR regressions |
| Hosted CI | **BLOCKED: maintainer approval required** on upstream draft [PR #15](https://github.com/AlinaSalovyk/MedCanvas/pull/15). Backend CI, CI and Full-stack browser E2E report `action_required` before jobs run. The fork's Backend CI passed on implementation checkpoint `bc74913`; this does not replace upstream checks on final HEAD. |

Baseline race reproduction is retained in the isolated local worktree
`coverage/audit-baseline` at `d1d67da`, with its dedicated
`PaymentRaceReproductionTests`. A SaveChanges interceptor releases both requests
only after each independently validated its stale balance. This fixture is for
historical reproduction; the fixed implementation intentionally serializes
before that barrier. Output is in local `baseline-race.log` (no real data).

Coverage combines source-file/line hit unions from the four final Cobertura
reports, rather than averaging repeated assemblies. Excluding compiler-generated
`obj/` and generated migrations: Domain **95.65%** (1034/1081), Application
**88.27%** (3221/3649), Infrastructure **97.06%** (726/748), API **88.04%**
(692/786). Raw assemblies including generated code are Infrastructure 99.13%
(11805/11909) and API 69.29% (695/1003). Both views are disclosed because generated
migrations inflate coverage and generated OpenAPI code depresses it. Application
remains below the backend skill's 95% target. This is an explicit unmet quality
target; older module reports did not establish compliance.

## Git delivery and self-review

Draft [PR #15](https://github.com/AlinaSalovyk/MedCanvas/pull/15) is based on
`d1d67daa75a6b818730c56638a529b4aad52326f`. Initial published implementation
checkpoint: `bc749130486d10275aad04bc079bf6bdf701fd53` (61 atomic commits).
Subsequent commits update delivery evidence only; the complete ordered list is
available in the PR's Commits tab. Migration/configuration/designer/snapshot
files and the executable project's Program/csproj are grouped because they are
inseparable. All other implementation commits change one file.

Both CLI and connector identify `Hyptofon`; upstream permissions report
`push:false`, and direct push failed with HTTP 403. Standard fork publication
preserves the same commits at `Hyptofon:fix/mvp-final-release-hardening`.
The connector's cross-repository PR-create call also returned 403; normal CLI
fork contribution successfully opened #15. Main was not changed or merged.
PR #14 was inspected and remains open: this account cannot close/update it.
The report and progress correction in #15 supersede its completion claim.

Upstream approval-gated evidence on delivery checkpoint
`49a67679847c34854c8d2a97a1a5e4f200fc8c05`:
[Backend CI](https://github.com/AlinaSalovyk/MedCanvas/actions/runs/40694816264),
[CI](https://github.com/AlinaSalovyk/MedCanvas/actions/runs/40694816275),
[Full-stack browser E2E](https://github.com/AlinaSalovyk/MedCanvas/actions/runs/40694816300).
All concluded `action_required`; none is claimed green. The final PR body and
delivery message identify the latest HEAD/checks after documentation-only updates.
The fork's implementation
[Backend CI](https://github.com/Hyptofon/MedCanvas/actions/runs/40694466308)
passed, separately from the upstream approval gate.

Self-review checked the final diff, no golden-fixture or engine API changes,
transaction/lock ordering before balance reads, snapshot read paths, legacy
rollback behavior, tenant/role predicates, same-key payload matching, synthetic
data, loopback-only hosting and the absence of fabricated test success. Both raw
and generated-code-excluded coverage are reported. This is a self-review, not an
independent human clinical/security acceptance.

## Remaining release prerequisites

Credential revocation/rotation is unverified and blocks automatic merging under
the owner's hard-stop rule. Hosted CI on final PR HEAD, final coverage accounting
and complete release gates must be verified. PR #14 must not merge its current
unconditional completion claim; reconciliation belongs in the progress ledger.

Authentication expiry with dirty clinical data, backup/restore operations,
approved-plan amendments and FR-702 relational follow-up linkage still require
explicit acceptance review. These are not certified by the successful main-flow
browser test. Legal basis, encryption, verified restores, incident response and an
independent security/privacy gate are prerequisites for a real clinical pilot.
No real patient data was used or deployed.

**INCONCLUSIVE — REQUIRED VERIFICATION INCOMPLETE**
