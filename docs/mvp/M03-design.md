# M03 — Appointments, Doctor Schedule & Resources · Design Decisions

Branch `feat/mvp-scheduling` from `a953ac9`. Locked decisions; deviations recorded here.

## D1 — Overlap prevention is a database guarantee (INV-005)
Two PostgreSQL **EXCLUDE constraints** (gist on `tstzrange(start_at_utc, end_at_utc)`):
- per (clinic_id, clinician_user_id) with `&&`,
- per (clinic_id, chair_id) with `&&`,
- **partial**: only statuses Scheduled/Confirmed/Arrived/InProgress (cancelled/no-show slots are reusable).

Requires `CREATE EXTENSION IF NOT EXISTS btree_gist` (migration SQL). Concurrent double-booking attempts race-safely fail with `exclusion_violation` (SQLSTATE 23P01), mapped by the handler to `ConflictException` (409). Application-level pre-checks remain for friendly errors; the constraint is the invariant.

## D2 — Entities
- `ClinicChair` (Id, ClinicId, Name 1–100, IsActive) — aggregate; rename/deactivate/activate.
- `ProviderAvailability` (ClinicId, ClinicianUserId, DayOfWeek 1–7 ISO, **Start/EndTime as TimeOnly in clinic-local time**) + `ProviderAvailabilityBreak` (AvailabilityId, Start/EndTime) — a clinician's weekly template.
- `ProviderAvailabilityException` (ClinicId, ClinicianUserId, DateOnly, IsWorkingDay) — date off / extra working day.
- `Appointment` (ClinicId, PatientId, ClinicianUserId, ChairId, StartAtUtc/EndAtUtc UTC, Status, ReasonForVisit ≤500, InternalNote ≤1000, CancellationReason ≤500 nullable, ConcurrencyVersion token, timestamps) — aggregate with a server-side state machine.

## D3 — Appointment state machine (domain-enforced)
Scheduled → Confirmed | Cancelled | NoShow · Confirmed → Arrived | Cancelled | NoShow · Arrived → InProgress | Cancelled · InProgress → Completed · terminal: Completed / Cancelled / NoShow (immutable afterwards). Reschedule (time/chair) allowed only from Scheduled/Confirmed; bumps ConcurrencyVersion and writes an audit event (history, FR-204). Illegal transitions throw `DomainException` (400).

## D4 — Availability validation
On create/reschedule the handler converts Start/End from UTC to the clinic's `TimeZoneId` (from M01), finds the weekday template, subtracts breaks, honors exceptions, and requires the slot to fit one working window. Conversion uses `TimeZoneInfo` (DST-correct); validator boundary tests cover the Kyiv DST transitions.

## D5 — API surface (all clinic-scoped, DB-verified roles)
- `POST /appointments` (CanManageCalendar: Admin/Clinician/Assistant) — validates patient active + same clinic, clinician active membership with Clinician/ClinicAdmin role, chair active, availability, and overlaps; 201 + ETag.
- `GET /appointments?from&to&clinicianId&chairId&status` — calendar window (max range 62 days), ordered by start.
- `GET /appointments/{id}`.
- `POST /appointments/{id}/reschedule` (If-Match; 428/412 semantics).
- `POST /appointments/{id}/confirm | arrive | no-show | complete` (state machine).
- `POST /appointments/{id}/cancel` (reason required; captures user+time via audit).
- Chairs: `GET/POST /chairs`, `POST /chairs/{id}/deactivate | activate`, `PUT /chairs/{id}` rename (CanManageClinic).
- Availability: `GET /availability/{clinicianUserId}`, `PUT /availability/{clinicianUserId}` (full weekly template replace; Admin or the clinician themself), exceptions `POST /availability/{clinicianUserId}/exceptions`, `DELETE /availability/exceptions/{id}`.
- Audit events for every appointment lifecycle action and chair/availability change.

## D6 — Frontend
Workspace additions: **Calendar page** (day/week switch, clinician/status filters, clinic-timezone rendering), **booking dialog** (patient picker via search, clinician, chair, date/time, reason), appointment actions per state, **chairs** and **availability** admin pages under Settings. Route guards by role (Viewer read-only by policy at API level). i18n uk/en.

## D7 — Testing
Domain: state machine matrix (legal/illegal), chair/availability invariants. Validators: full field matrix + DST boundaries. Handlers: success/conflict/404/403/428/412. **Concurrency**: two parallel double-bookings ⇒ exactly one 201 and one 409 (real PG). Integration: isolation (cross-clinic 404), cancel→rebook same slot OK, reschedule audit, availability windows. FE: calendar render/filter/book flow (mocked contract). E2E: calendar booking happy path with route mocks.
