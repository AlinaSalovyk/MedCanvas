# MEDCANVAS — MODULE M00 IMPLEMENTATION & QUALITY REPORT

**Module:** M00 — Clinical Safety Foundation
**Branch:** `fix/mvp-clinical-safety-gate` · **Base:** `f970f28` · **Final:** `<set at PR time>`
**Scope:** close the known high-risk sync/recovery and clinical-consistency gaps before the Workspace modules build on them. No engine rewrite; no odontogram public-API changes.

---

## 1. Implemented requirements (TZ §M00)

| TZ requirement | Implementation |
|---|---|
| Строга перевірка snapshot перед `recoverChart()` | New exported `assertValidOdontogramSnapshotStructure()` (plain-object root, semantic `version`, `teeth` object whose keys are valid FDI 11–48/51–85, optional `plan` validated the same). `recoverChart` runs it **before** any hydration; an invalid snapshot throws and the fail-closed lock stays engaged. `load()` and `switchEncounter()` validate server snapshots after `JSON.parse` and before touching the live chart. |
| Перевірка приналежності стану до правильного encounter | Encounter-identity checks on every server response (existing) now backed by the switch-window edit protection: the pre-commit re-check aborts a switch if any edit arrived, so a source-encounter edit can never be committed or written under the target encounter. Save-path stale-response guards (`generation` + `saveEncounterId !== encounterId`) retained and covered by tests. |
| Захист нових редагувань під час перемикання encounter | `switchDepth` counter marks the whole switch window. The autosave listener still counts revisions arriving in the window but defers scheduling; the switch's pre-commit check sees the dirty state, aborts, preserves encounter/chart/edits, and deferred autosave resumes (`resumeDeferredAutoSave`) once the window closes. Manual `save()`/`load()` are rejected while a switch is in flight. Concurrent switch-override (click another patient while a fetch hangs) remains supported via generation tokens. |
| Відновлення autosave після безпечного recovery | Explicit policy: `recoverChart(chart, { resumeAutoSync?: boolean })` — autosave stays disabled unless explicitly re-enabled (and only if `autoSave` was configured). |
| Правдиві статуси | `recoverChart` reports `saved` **only** when the host supplies `serverETag` + `serverVersion` for the verified chart; chart-only recovery reports `idle` (no server acknowledgement exists). Missing ETag headers at load/switch/save are hard errors — the previous `etag || \`"<concurrencyVersion>"\`` fallback that fabricated a potentially mismatched tag (permanent-412 risk) is removed. |
| Захист від застарілих асинхронних відповідей | Existing generation-token guards retained; new regression tests cover stale/aborted paths through the new validation and switch-abort branches. |
| Узгодження Status/Plan у серверному FHIR-експорті | `FhirBundleBuilder` plan section rewritten to **divergence-only** semantics mirroring `src/fhir/toFhirPlan.ts`: endo / restorationType / fillingSurfaces / extractionPlan emit a ServiceRequest only when the planned value genuinely differs from the status value (booleans only when raised in plan and not already true in status). Unchanged Status states mirrored into the plan clone no longer produce phantom planned procedures. |

## 2. Files changed

| File | Change |
|---|---|
| `src/api/odontogramSync.ts` | Snapshot validator (+export), `RecoverChartOptions`, strict ETag resolution, switch-depth edit protection, unload guard |
| `src/__tests__/api/odontogram-sync-safety.test.ts` | NEW — 16 M00 regression tests |
| `src/__tests__/api/medcanvas-client.test.ts` | Recovery expectation corrected to `idle`; two placeholder `{}` target fixtures replaced with canonical minimal payloads |
| `backend/src/MedCanvas.Application/Features/Fhir/FhirBundleBuilder.cs` | Divergence-only plan ServiceRequests + axis accessors |
| `backend/tests/MedCanvas.Application.Tests/Features/Fhir/FhirBundleBuilderTests.cs` | +2 regression facts (mirrored-plan ⇒ none; divergences ⇒ per-axis requests) |

## 3. Validation matrix (new tests)

Frontend (`odontogram-sync-safety.test.ts`): validator accept/reject cases · invalid recovery snapshots keep the lock with zero hydration attempts · failed verified hydration keeps the lock · recovery → `idle` without metadata, autosave off by default · recovery → `saved` with server metadata + explicit `resumeAutoSync` · missing ETag at load/save/switch ⇒ error, no fabricated tag · structurally invalid server snapshots rejected pre-hydration at load and switch · switch abort preserves encounter/chart/edits and resumes autosave under the SOURCE encounter (zero writes to the target) · manual save rejected mid-switch · beforeunload warns only when dirty · pagehide flushes pending debounced edits · destroyed bridge neither warns nor flushes.

Backend (`FhirBundleBuilderTests.cs`): mirrored plan (identical status/plan tooth with endo+filling+restoration+extractionPlan) emits **zero** phantom ServiceRequests while a genuine crown divergence on another tooth still emits exactly one · per-axis divergence combinations (value change, surface-set change, boolean raise, absent→planned endo) each emit their single expected request.

## 4. Verification results (actual runs)

| Gate | Result |
|---|---|
| `npx vitest run src/__tests__/api/` | **45/45 PASS** (29 updated legacy + 16 new) |
| `dotnet build -c Release` | PASS 0 warnings / 0 errors |
| `dotnet test` full suite | **281/281 PASS** (Domain 109, Application 97, Infrastructure 21, API 54), 0 skipped |
| `dotnet format --verify-no-changes` | PASS |
| Full frontend gates (tsc/lint/vitest/build/playwright) | recorded at PR time (see PR description) |

## 5. Security & clinical-safety evidence

- Fail-closed principle extended: invalid data now fails **earlier** (pre-hydration) across recovery, load, and switch paths.
- No new network surface; no public API changes (`src/api` additions are new exports only; frozen `odontogram.ts`/`App.tsx` surfaces untouched — parity suites confirm).
- No PHI introduced into logs; error messages carry no clinical data.
- M00 acceptance criteria mapping: invalid snapshot never unlocks ✓ (test) · post-failed-recovery writes forbidden ✓ (test) · switch-window edits preserved ✓ (test) · cross-encounter save impossible ✓ (abort + existing P0 tests) · autosave explicit policy ✓ (test) · `saved` requires acknowledgement ✓ (tests) · FHIR Plan derives nothing from unchanged Status ✓ (tests).

## 6. Known limitations

- Unload flush is best-effort (`fetch` may not complete during teardown; snapshots can exceed the `keepalive` 64 KB budget). The interactive `beforeunload` warning is the primary protection; a durable queue is a documented M04+ candidate if field use shows losses.
- Backend FHIR plan export covers the four axes the builder historically exported; full `PLAN_SERVICE_AXES` parity with the frontend exporter remains future interop work (M05 procedural planning touches this area).
- `recoverChart` without server metadata leaves the bridge unable to save without a fresh ETag (next save surfaces a server 428/412, which the host must resolve) — deliberate fail-closed behavior, documented.
- Existing `recoveryRollbackChart` fallback (no verified chart supplied) now also passes strict validation — a corrupt rollback snapshot keeps the lock rather than half-recovering.

## 7. Verdict

`READY FOR INDEPENDENT REVIEW` (pending full frontend gate run recorded in the PR).
