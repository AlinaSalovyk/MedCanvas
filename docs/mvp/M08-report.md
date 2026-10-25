# MEDCANVAS — MODULE M08 IMPLEMENTATION & QUALITY REPORT

**Module:** M08 — Follow-up Appointments & Minimal Dashboard
**Branch:** `feat/mvp-follow-up-dashboard` · **Base:** `bc9a13c` (M07 merge).

## 1. Implemented requirements (TZ §M08)

| Requirement | Implementation |
|---|---|
| **FR-701 Next visit from a completed encounter / patient** | «Записати на прийом» on the active patient card → calendar with the patient prefilled in the booking dialog (fetches and preselects; works from any visit context). |
| **FR-702 Link to treatment phase** | Booking dialog carries the internal note slot (phase references live in plan items); deep plan-phase↔appointment FK is documented as post-MVP refinement (TZ allows clarifying DTOs). |
| **FR-703 Visit history** | Patient card already renders encounter history (M02) + performed procedures (M06) + plans (M05). |
| **FR-704 Dashboard metrics** | `GET /dashboard`: today's appointments, waiting (Confirmed/Arrived), in-progress encounters, completed today, next-7-days, invoices issued today, simulated paid today — **all computed by the database over real tenant rows**; finance figures labeled DEMO (INV-008). DST-correct day windows in the clinic IANA zone. |
| **FR-705 Role-based views** | Clinician sees own schedule/encounters/invoices (server-side scoping); admin sees the clinic overview. UI dashboard is the workspace index. |

## 2. Test evidence (actual runs)
| Suite | Result |
|---|---|
| Backend full | **477/477** (+1 dashboard integration: real counters incl. waiting/completed/upcoming/in-progress, cross-clinic zeros, financeIsDemo=true) |
| dotnet format | PASS |
| Frontend gates | recorded at PR (tsc/lint/vitest/playwright) |

Defect caught during development: dashboard `OccupiesSlot` (C# computed property) broke EF SQL translation (500) — replaced with explicit status translation; integration test covers the query path end-to-end.

## 3. Security & isolation
Counters tenant-scoped with role-based narrowing at the DB level; foreign clinic sees zeros (tested, no disclosure); finance sums only over the caller's tenant.

## 4. Known limitations
- Dashboard is count-based (no charts) per TZ «мінімальна робоча панель».
- Plan-phase↔appointment FK refinement post-MVP.

## 5. Verdict
`READY FOR INDEPENDENT REVIEW`
