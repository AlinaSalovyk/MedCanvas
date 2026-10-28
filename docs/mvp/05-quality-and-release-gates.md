# 05 — Quality and Release Gates

## 1. Mandatory verification gates (per module, before PR)

### Backend (all must pass)
```powershell
dotnet restore backend/MedCanvas.sln
dotnet build backend/MedCanvas.sln -c Release          # 0 warnings, 0 errors
dotnet format backend/MedCanvas.sln --verify-no-changes
dotnet test backend/MedCanvas.sln -c Release --collect:"XPlat Code Coverage"
```
- Real PostgreSQL via Testcontainers everywhere; EF InMemory never sufficient alone.
- New Domain/Application business code: ≥90% line coverage (aim higher on clinical/financial branches); report gaps honestly.

### Frontend (all must pass)
```powershell
npx tsc -b --noEmit
npm run lint                                            # 0 errors; no new unjustified warnings
npm run build
node --max-old-space-size=4096 ./node_modules/vitest/vitest.mjs run
npx playwright test --workers=2
npm run test:e2e:fullstack                                # real API + disposable PostgreSQL, two browser zones
```
- Architectural invariants stay green: `import-cycles`, `api-surface` parity (349 frozen exports), canonical fixture drift, FHIR goldens.

### Test categories per module (TZ §7 — all applicable ones)
CRUD/lifecycle · validators (full negative matrix §7.2) · domain invariants/state machines · application handlers (success/validation/401/403/404/409/412/cancel/idempotency/no-side-effects-after-failure) · PostgreSQL integration (constraints, isolation, concurrency, atomicity, decimal precision) · real-HTTP API tests (status-code matrix incl. 412/428 where applicable, ProblemDetails, ETags) · security & tenant isolation (two clinics, IDOR, role matrix) · frontend (loading/empty/error/unauthorized/retry/stale-response/a11y/responsive) · E2E (`UI → API → DB → API → UI`, synthetic data) · concurrency & resilience (§7.10).

## 2. CI verification (hosted)

- Workflows: `CI` (frontend incl. Playwright) and `Backend CI` (build/format/test+coverage) — both must be green **on the exact PR HEAD** after the final push.
- `Full-stack browser E2E` is also mandatory for the stabilization PR. Its test-only host must migrate the isolated database before listening; no mocked successful business responses fulfill this gate.
- Monitoring: identify run IDs once, then `gh run watch <id> --interval 180 --exit-status` (or equivalent); poll at 3–5-minute intervals at most; never re-fetch logs of a running job.
- A failed run: read the failing job logs, fix the actual cause, push, re-verify the NEW HEAD.

## 3. Definition of Done checklist (per module, from TZ §8)

Functionality: all requirements implemented; UI+API work together; data in PostgreSQL; domain-equivalent CRUD complete; validators verify valid+invalid; status transitions correct; no fake UI operations.
Security: role checks verified; clinic isolation verified; no PHI in logs; no hardcoded secrets; server never trusts client tenant IDs; audit trail for critical operations.
Testing: unit/validator/application/PG-integration/API-integration/frontend/E2E/negative-path/concurrency + regressions of previous modules — ALL PASS.
Code quality: tsc, ESLint, production build, .NET Release build, `dotnet format --verify-no-changes`, no new import cycles, odontogram API unbroken, migrations verified on clean DB, no unrelated refactors.
GitHub: correct branch; atomic logical commits; PR with full description (module id, requirements, architecture/DB/API/UI changes, validation matrix, test evidence, security evidence, known limitations); CI green on HEAD; docs updated.

## 4. Merge policy (documented conflict resolution)

- TZ §5.3/§8/§13: no automatic merging; owner confirms merges.
- Program §6/§12 (later, explicit owner instruction): merge automatically once ALL gates pass, CI green on exact HEAD, self-review complete, no unresolved P0/P1, no blocking protection/review.
- **Resolution applied:** the TZ governs functional scope; the program governs execution process. Squash-merge is executed autonomously only when every §3 gate is verifiably green. Branch protections are never bypassed — if protections/required reviews are later added to `main`, the program stops deferring to them. This deviation from TZ §5.3 is recorded here and in every PR description.

## 5. Regression protection

- Existing suites never weakened/skipped to make progress (TZ §9.11); golden fixtures never edited to mask drift.
- Every clinical-safety fix ships with a negative-path regression test (RED→GREEN).
- Module N's PR must include a regression run of modules < N (full suites are mandatory anyway per §1).

## 6. Release gates (M09 / final)

1. E2E-MVP-001 passes end-to-end on real UI+API+PG with two synthetic clinics.
2. All module reports (§ TZ §9 format) collected under `docs/mvp/`.
3. Coverage report per layer; gaps documented.
4. Security summary: tenant isolation matrix, role matrix, PHI-log audit, secrets scan.
5. Concurrency results: double-booking, racing payments, autosave conflicts, retry idempotency.
6. Deployment instructions for a safe test environment validated (Docker Compose / env vars).
7. Final report `docs/mvp/final-report.md` with one verdict:
   `MVP FUNCTIONALLY COMPLETE — ALL ACCEPTANCE GATES PASSED` ·
   `MVP FUNCTIONALLY COMPLETE WITH DOCUMENTED LIMITATIONS` ·
   `MVP BLOCKED — CRITICAL DEFECTS OR REQUIREMENTS REMAIN` ·
   `MVP INCONCLUSIVE — REQUIRED VERIFICATION INCOMPLETE`.
8. Explicit list of prerequisites for real-clinical use (TZ §12: legal basis, encryption, backups, incident response, etc.) — demo-ready ≠ production-ready.

## 7. Stop conditions

The post-M09 preflight exposed an embedded local Git-remote credential. Sanitizing
the URL does not establish revocation/rotation. Automatic merging remains stopped
until the credential owner completes exposure review. Historical green workflows
and the absence of branch protection do not waive this security gate.

Any of: missing authoritative spec section; unresolvable P0/P1 defect; branch protection blocking verified merge; CI irreparably red due to environment; security regression that cannot be fixed without weakening guarantees; secrets exposure. On stop: preserve branch, record exact blocker in `PROGRESS.md`, report.
