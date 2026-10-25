# MedCanvas REST API Endpoints & Contract Specification

> **Document Status:** Authoritative API Specification  
> **Base URL:** `/api/v1`  
> **Wire Protocol:** HTTPS / JSON / RFC 7807 ProblemDetails  
> **Security:** JWT Bearer Authentication / Clinic Tenant Scoping

---

## 1. Global API Standards & Conventions

#### 1.1 HTTP Headers & Concurrency Tokens
- `Authorization: Bearer <jwt-token>` (Required on all endpoints except login).
- `Content-Type: application/json`
- `ETag: "\"<concurrency-version>\""` (Strong entity-tag returned on all Odontogram GET, PUT, and Finalize responses).
- `If-Match: "\"<concurrency-version>\""` (Strong entity-tag required on Odontogram updates and finalize).
- Weak ETags (`W/"..."`), wildcards (`*`), multiple tags, and unquoted values are rejected with `400 Bad Request` (`https://medcanvas.health/errors/malformed-etag`).
- If missing on update of an existing record, the API returns `428 Precondition Required`.
- If the version in `If-Match` does not match the database `ConcurrencyVersion`, the API returns `412 Precondition Failed`.

### 1.2 RFC 7807 Standard Error Envelope
All error responses (4xx, 5xx) strictly follow the RFC 7807 ProblemDetails format:

```json
{
  "type": "https://medcanvas.health/errors/validation-failed",
  "title": "Validation Failed",
  "status": 400,
  "detail": "One or more validation errors occurred.",
  "instance": "/api/v1/encounters/a812.../odontogram",
  "errors": {
    "SnapshotJson": ["The active ICDAS depth must be an integer between 1 and 6."]
  }
}
```

---

## 2. API Endpoint Matrix

### 2.1 Authentication & Session
| Method | Route | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Authenticate user (`clinicId` optional: single active membership auto-selected; several memberships return `requiresClinicSelection: true` with a clinic list instead of a token). Rate limited (429). | Anonymous |
| `GET` | `/api/v1/auth/me` | Fetch active user profile and active clinic membership | Bearer |
| `GET` | `/api/v1/auth/clinics` | List the caller's active clinic memberships (login picker / switcher) | Bearer |
| `POST` | `/api/v1/auth/switch-clinic` | Exchange the current token for one scoped to another owned clinic (`{ clinicId }`); foreign clinics return 404 | Bearer |

### 2.1b Clinic Tenancy & Staff (M01)
| Method | Route | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/v1/clinics/onboarding` | Controlled onboarding: creates a brand-new clinic + first ClinicAdmin + membership in one transaction and returns an authenticated session. Existing email or clinic identifier ⇒ 409. Rate limited (429). | Anonymous |
| `GET` | `/api/v1/clinics/members` | List staff memberships of the active clinic (revoked included, with flags) | ClinicAdmin |
| `POST` | `/api/v1/clinics/members` | Create a staff account (brand-new user) with a role ⇒ 201 | ClinicAdmin |
| `PUT` | `/api/v1/clinics/members/{userId}/role` | Change a member's role; self-change ⇒ 409 | ClinicAdmin |
| `DELETE` | `/api/v1/clinics/members/{userId}` | Revoke (deactivate) a membership; self-revoke ⇒ 409 | ClinicAdmin |
| `POST` | `/api/v1/clinics/members/{userId}/activate` | Reactivate a revoked membership | ClinicAdmin |
| `GET` | `/api/v1/clinics/settings` | Read the clinic profile (name, identifier, IANA time zone) | Any active member |
| `PUT` | `/api/v1/clinics/settings` | Update clinic name and time zone (identifier immutable) | ClinicAdmin |

Audited actions: `CLINIC_ONBOARDED`, `MEMBERSHIP_CREATED`, `MEMBERSHIP_ROLE_CHANGED`, `MEMBERSHIP_REVOKED`, `MEMBERSHIP_REACTIVATED`, `CLINIC_SETTINGS_UPDATED`.

---

### 2.2 Patient Management
All patient operations are scoped to the authenticated caller's active `clinicId`.

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/v1/patients` | Search patients with pagination (`search`/`searchTerm`, `page`/`pageNumber`, `pageSize`), server-side sorting (`sortBy` = `lastname`/`firstname`/`birthdate`/`created`, `sortDescending`), and `includeArchived` (default: active only). Responses carry `concurrencyVersion` per item. |
| `GET` | `/api/v1/patients/{id}` | Retrieve detailed patient record; response includes `ETag` |
| `POST` | `/api/v1/patients` | Register a new patient in the active clinic; response carries `ETag` |
| `PUT` | `/api/v1/patients/{id}` | Update patient demographics and medical alerts — **requires strong `If-Match`** (missing ⇒ 428, stale ⇒ 412, same semantics as odontogram saves); body carries matching `expectedVersion`; response carries the new `ETag` |
| `POST` | `/api/v1/patients/{id}/archive` | Archive the patient (soft state; history readable; new encounters blocked with 400) — audited `PATIENT_ARCHIVED` |
| `POST` | `/api/v1/patients/{id}/restore` | Restore an archived patient — audited `PATIENT_RESTORED` |
| `GET` | `/api/v1/patients/duplicates` | Duplicate hint by `externalMedicalRecordNumber` or `firstName`+`lastName`+`dateOfBirth` (advisory only; clinic-scoped) |
| `GET` | `/api/v1/patients/{id}/encounters` | List all encounters for a patient (chronological) |

---

### 2.2b Scheduling (M03)
All scheduling operations are scoped to the caller's active clinic with DB-verified roles.

| Method | Route | Description | Auth |
|---|---|---|---|
| GET | /api/v1/appointments?fromUtc&toUtc&clinicianId&chairId&status | Calendar window (max 62 days, UTC bounds), ordered by start | Any member |
| POST | /api/v1/appointments | Book a slot (validates patient/clinician/chair/availability/overlap); 201 + ETag; slot conflicts 409 | Admin/Clinician/Assistant |
| POST | /api/v1/appointments/{id}/confirm | Scheduled -> Confirmed | Admin/Clinician/Assistant |
| POST | /api/v1/appointments/{id}/arrive | Confirmed -> Arrived | Admin/Clinician/Assistant |
| POST | /api/v1/appointments/{id}/complete | Arrived/InProgress -> Completed | Admin/Clinician/Assistant |
| POST | /api/v1/appointments/{id}/no-show | Scheduled/Confirmed -> NoShow | Admin/Clinician/Assistant |
| POST | /api/v1/appointments/{id}/cancel | Cancel with required reason (slot released) | Admin/Clinician/Assistant |
| POST | /api/v1/appointments/{id}/reschedule | Move time/chair under strong If-Match (428/412); Scheduled/Confirmed only | Admin/Clinician/Assistant |
| GET / POST | /api/v1/chairs | List chairs / create (duplicate name 409) | Read: any member; write: ClinicAdmin |
| PUT | /api/v1/chairs/{id}/name | Rename chair | ClinicAdmin |
| POST | /api/v1/chairs/{id}/deactivate or /activate | Toggle chair availability | ClinicAdmin |
| GET | /api/v1/availability/{clinicianUserId} | Weekly template + dated exceptions | Any member |
| PUT | /api/v1/availability/{clinicianUserId} | Replace weekly template (windows + breaks) | Admin or the clinician themself |
| POST | /api/v1/availability/{clinicianUserId}/exceptions | Add dated exception (day off / extra day; duplicate 409) | Admin or the clinician themself |
| DELETE | /api/v1/availability/exceptions/{id} | Remove a dated exception | Admin or the clinician themself |

Overlap prevention is a database guarantee: PostgreSQL EXCLUDE constraints
(btree_gist on tstzrange) per (clinic, clinician) and per (clinic, chair) over
active statuses — racing bookings fail closed with 409. Audited actions:
APPOINTMENT_CREATED/CONFIRMED/ARRIVED/COMPLETED/CANCELLED/NO_SHOW/RESCHEDULED,
CHAIR_CREATED/ACTIVATED/DEACTIVATED, AVAILABILITY_UPDATED.

---

### 2.3 Dental Encounters
| Method | Route | Description |
|---|---|---|
| `POST` | `/api/v1/encounters` | Start a new clinical encounter (`patientId`, optional `chiefComplaint`) |
| `GET` | `/api/v1/encounters/{id}` | Get single encounter details |
| `GET` | `/api/v1/encounters/by-patient/{patientId}` | List all encounters for a patient |
| `POST` | `/api/v1/encounters/{id}/complete` | Complete encounter (optional `clinicalSummary` body) |
| `POST` | `/api/v1/encounters/{id}/cancel` | Cancel encounter (optional `reason` body) |

---

### 2.4 Canonical Odontogram & Revision Operations
These endpoints handle the lossless canonical JSON odontogram state.

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/v1/encounters/{encounterId}/odontogram` | Get active odontogram snapshot + ETag |
| `GET` | `/api/v1/patients/{patientId}/odontogram/latest` | Get latest active odontogram across all encounters |
| `PUT` | `/api/v1/encounters/{encounterId}/odontogram` | Save/update canonical odontogram payload (optimistic lock with `If-Match`) |
| `POST` | `/api/v1/encounters/{encounterId}/odontogram/finalize` | Finalize record (seal against edits; body optional with `If-Match`) |
| `GET` | `/api/v1/encounters/{encounterId}/odontogram/revisions` | List historical revision numbers and timestamps |
| `GET` | `/api/v1/encounters/{encounterId}/fhir` | Generate on-demand HL7® FHIR® R4 Bundle export |

#### `PUT /api/v1/encounters/{encounterId}/odontogram`
- **Headers**:
  - `If-Match: "2"`
- **Request Body**:
  ```json
  {
    "snapshotJson": "{\"version\":\"2.22\",\"globals\":{...},\"teeth\":{...}}",
    "expectedVersion": 2,
    "changeSummary": "Filled distal on tooth 11"
  }
  ```).
- **Response `200 OK`**:
  ```json
  {
    "id": "e812b189-c454-469b-81f1-3818e3d08892",
    "encounterId": "c711a189-b454-469b-81f1-2718e3d08891",
    "patientId": "b610a189-a454-469b-81f1-1618e3d08890",
    "payloadVersion": "2.22",
    "concurrencyVersion": 3,
    "isFinalized": false,
    "updatedAtUtc": "2026-10-22T16:15:00Z",
    "payload": {
      "version": "2.22",
      "globals": { "wisdomVisible": true, "showBase": true, "occlusalVisible": true, "showHealthyPulp": false, "edentulous": false },
      "teeth": { ... },
      "case": { ... },
      "plan": { ... }
    }
  }
  ```
- **Response Headers**: `ETag: "3"`

#### Error Responses on Concurrency Mismatch:
- If client sends `If-Match: "1"` but current version is `2`, returns `412 Precondition Failed` (or `409 Conflict`).
- Body returns current server `concurrencyVersion` to assist resolution.

---

### 2.5 Medical Audit Trail
| Method | Route | Description | Permissions |
|---|---|---|---|
| `GET` | `/api/v1/audit/patients/{patientId}` | Retrieve clinical audit history for a patient | `Clinician`, `ClinicAdmin` |
