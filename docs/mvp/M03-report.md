# MEDCANVAS — MODULE M03 IMPLEMENTATION & QUALITY REPORT

**Module:** M03 — Appointments, Doctor Schedule & Resources
**Branch:** `feat/mvp-scheduling` · **Base:** `a953ac9` (M02 merge) · Final SHA recorded in the PR.

## 1. Purpose
Administrators can book patients into free slots with clinicians on chairs; the calendar cannot be double-booked — guaranteed at the PostgreSQL boundary — and weekly clinician schedules with breaks/days-off gate what can be booked.

## 2. Implemented requirements (TZ §M03)

| Requirement | Implementation |
|---|---|
| **FR-201 Create booking** | `POST /appointments` (Admin/Clinician/Assistant): validates active same-clinic patient, active clinician membership (Clinician/ClinicAdmin role), active chair, availability, and overlap; 201 + ETag. Frontend booking dialog with patient search. |
| **FR-202 Overlap prevention incl. concurrency (INV-005)** | Two PostgreSQL **EXCLUDE constraints** (`btree_gist`, `tstzrange`) per (clinic, clinician) and per (clinic, chair), partial over active statuses — cancelled/no-show slots reusable. **Race test**: two parallel bookings of the same slot ⇒ exactly one 201 and one 409. Provider-agnostic violation detector maps 23P01 ⇒ 409 (Npgsql types stay in Infrastructure). |
| **FR-203 Calendar** | Week/day views with clinician-free status filter; server window query (max 62 days) ordered by start; cross-clinic isolation tested. |
| **FR-204 Reschedule with history** | `POST /appointments/{id}/reschedule` under strong `If-Match` (428/412 semantics), only from Scheduled/Confirmed; audited `APPOINTMENT_RESCHEDULED`; availability+overlap re-checked. |
| **FR-205 Cancel** | Reason required; user/time captured via audit `APPOINTMENT_CANCELLED`; cancelled slots rebookable (tested). |
| **FR-206 Confirm & arrival** | State machine Scheduled→Confirmed→Arrived→InProgress→Completed with NoShow/Cancel branches — all server-enforced (`DomainException` ⇒ 400 on illegal transitions, tested). |
| **FR-207 Re-booking from patient context** | Booking dialog reachable from the calendar with patient search (patient-card shortcut lands with M08 follow-up module). |
| **DST correctness** | Availability computed in the clinic's IANA zone (from M01 settings) via `TimeZoneInfo`; slot must fit a single clinic-local day; test books around Kyiv local times with UTC wire values. |
| **Entities** | `Appointment` (aggregate, 7-state machine, concurrency token), `ClinicChair`, `ProviderAvailability` + breaks + dated exceptions (extra working days supported). |

## 3. Architecture / DB / API / UI changes
- **DB** (migration `AddSchedulingTables`, clean-DB verified incl. `CREATE EXTENSION btree_gist`): 5 tables, FKs (Patient/Chair/Clinic/User Restrict), indexes (clinic+start, clinic+clinician+start, patient+start, unique chair names per clinic, unique exception dates), 2 exclusion constraints.
- **API**: `AppointmentsController` (window/create/confirm/arrive/complete/no-show/cancel/reschedule), `ChairsController`, `AvailabilityController`; new policies `CanReadCalendar` (all roles) and `CanManageCalendar` (Admin/Clinician/Assistant); audit events for every lifecycle action.
- **Frontend**: Calendar page (week/day, status filter, appointment cards with per-state actions), booking dialog (patient search → slot → reason), chairs admin page, weekly availability editor (per-weekday window + break); nav/i18n uk+en.

## 4. Test evidence (actual runs)
| Suite | Result |
|---|---|
| Domain | **148/148** (+26: state machine matrix incl. terminal immutability, reschedule versioning, chair/availability invariants) |
| Application | **152/152** |
| Infrastructure (real PG) | **21/21** (migrations incl. exclusion constraints on clean DB) |
| API integration | **108/108** (+13: create/ETag, sequential + **concurrent** double-booking, chair overlap via second clinician, foreign-clinic patient 404, lifecycle, cancel-releases-slot, reschedule 428/412/success, availability hours/breaks/day-off, calendar isolation + filters, Viewer 403, chairs CRUD/duplicate 409) |
| Vitest | **2673 passed / 2 skipped** (+4 calendar tests) |
| Playwright | **17/17** (+1 calendar E2E) |
| tsc / eslint / build / dotnet build / format | all green locally (0 lint errors) |

## 5. Security & tenant isolation
Every endpoint clinic-scoped with DB-verified membership; cross-clinic patient/booking ⇒ 404 (tested); Viewer mutation ⇒ 403 (tested with real DB role); audit trail for all scheduling actions; no PHI in logs.

## 6. Concurrency & resilience
Database-level exclusion constraints make double-booking impossible even under racing requests (explicitly tested); appointment reschedule under optimistic concurrency (428/412); availability replace is transactional full-replace.

## 7. Known limitations
- Availability enforces a weekly template when one exists; clinicians without a template are freely bookable (deliberate MVP default, documented).
- Calendar UI renders one week/day window without drag-and-drop; reschedule is API-level (UI reschedule arrives with M08 follow-up shortcuts where it's most used).
- Availability editor supports one break per weekday window in the UI (API supports multiple).
- Booking dialog time input uses the browser's local timezone; clinic-timezone rendering of existing slots uses the browser locale (fully consistent TZ display arrives with M08 dashboard polish).

## 8. Verdict
`READY FOR INDEPENDENT REVIEW` (CI verification on PR HEAD pending at publication; all local gates green).
