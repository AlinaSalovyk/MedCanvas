| M01 | **MERGED** | PR #4 squash-merged as `c07182a` after CI green on HEAD `981db68` (`CI` 7m37s ✓, `Backend CI` 1m26s ✓) + self-review. Report: `M01-report.md` |# MedCanvas MVP — Progress Checkpoint

Owner-facing live state of the autonomous MVP program. Updated per module.
Rules: statuses below are only set from verified evidence; never claim `MERGED` without GitHub confirmation; no secrets/PHI here.

## Phase status

| Phase | State | Notes |
|---|---|---|
| Phase Zero — audit | **COMPLETE** | Spec read in full (canonical copy `MedCanvas-MVP-TZ-v1.0.md`); 3 deep-audit agents; deliverables 01–05 written; baseline all green (see below) |
| M00 | **MERGED** | PR #3 squash-merged as `2b59f50` after CI green on HEAD `ac3be8f` (`CI` 5m57s ✓, `Backend CI` 1m16s ✓) + self-review. Report: `M00-report.md` |
| M01 | TESTING | Implementation complete (31 commits): auth rework, onboarding, membership mgmt, settings, rate limiting, workspace UI; all gates green locally; see `M01-report.md` |
| M02 | TESTING | Backend (390/390) + frontend gates green locally; PR follows; see `M02-report.md` |
| M03–M09 | NOT_STARTED | — |

## Verified baseline (2026-10-24, `main` @ `f970f28`)

| Gate | Result |
|---|---|
| `npx tsc -b --noEmit` | PASS |
| `npm run lint` | PASS (0 errors / 248 pre-existing warnings) |
| `npm run build` | PASS |
| Vitest | PASS — 2 638 / 2 skipped (env-gated) |
| Playwright (chromium, 2 workers) | PASS — 14/14 |
| `dotnet build -c Release` | PASS 0w/0e |
| `dotnet format --verify-no-changes` | PASS |
| `dotnet test` (+coverage) | PASS — 279/279, 0 skipped |
| GitHub Actions on `main` HEAD | `CI` + `Backend CI` green |

## Module ledger

| Module | Branch | Base SHA | Final SHA | PR | Merge SHA | Status | Report |
|---|---|---|---|---|---|---|---|
| M00 | `fix/mvp-clinical-safety-gate` | `f970f28` | `ac3be8f` | [#3](https://github.com/AlinaSalovyk/MedCanvas/pull/3) | `2b59f50` | **MERGED** | `M00-report.md` |
| M01 | `feat/mvp-workspace-identity` | `2b59f50` | `981db68` | [#4](https://github.com/AlinaSalovyk/MedCanvas/pull/4) | `c07182a` | **MERGED** | `M01-report.md` |
| M02 | `feat/mvp-patients` | `c07182a` | see PR | — | — | TESTING | `M02-report.md` |
| M03 | `feat/mvp-scheduling` | — | — | — | — | NOT_STARTED | — |
| M04 | `feat/mvp-clinical-workspace` | — | — | — | — | NOT_STARTED | — |
| M05 | `feat/mvp-treatment-planning` | — | — | — | — | NOT_STARTED | — |
| M06 | `feat/mvp-procedure-execution` | — | — | — | — | NOT_STARTED | — |
| M07 | `feat/mvp-demo-billing` | — | — | — | — | NOT_STARTED | — |
| M08 | `feat/mvp-follow-up-dashboard` | — | — | — | — | NOT_STARTED | — |
| M09 | `test/mvp-end-to-end-hardening` | — | — | — | — | NOT_STARTED | — |

## Decisions log

| # | Decision | Rationale |
|---|---|---|
| D1 | Merge policy conflict (TZ forbids auto-merge vs program authorizes) resolved in favor of the program's explicit process instruction, with every gate mandatory first; branch protections always win | TZ = functional scope authority; program = execution process authority (later, explicit). Recorded in `05-quality-and-release-gates.md` §4 and every PR description |
| D2 | M00 fixes target `src/api/odontogramSync.ts` + backend `FhirBundleBuilder` only; no engine rewrite | TZ M00 scope |
| D3 | Audit deliverables + canonical TZ committed via the M00 PR (no direct commits to `main`) | TZ §5.3 no direct main commits |

## Last verified action

M02 implementation complete on `feat/mvp-patients`: backend 390/390 (+10), Vitest 2669/2-skip (+6), Playwright 16/16 (+1), tsc/lint/build/dotnet format green. Pushing for PR.

## Known blockers

None active. Process note: the `gh` CLI account (Hyptofon) is not a repository collaborator — PR create/merge go through the already-configured repository credential via REST API (push via git works normally).
