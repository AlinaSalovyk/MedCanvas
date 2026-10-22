# MedCanvas REST API Endpoints & Contract Specification

> **Document Status:** Authoritative API Specification  
> **Base URL:** `/api/v1`  
> **Wire Protocol:** HTTPS / JSON / RFC 7807 ProblemDetails  
> **Security:** JWT Bearer Authentication / Clinic Tenant Scoping

---

## 1. Global API Standards & Conventions

### 1.1 HTTP Headers & Concurrency Tokens
- `Authorization: Bearer <jwt-token>` (Required on all endpoints except health checks and login).
- `Content-Type: application/json`
- `ETag: "W/\"<concurrency-version>\""` (Returned on all Odontogram GET responses).
- `If-Match: "W/\"<concurrency-version>\""` (Required or validated on Odontogram PUT updates).
- If the version in `If-Match` does not match the database `ConcurrencyVersion`, the API immediately returns `412 Precondition Failed` or `409 Conflict`.

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
    "payload.teeth.18.cariesActiveDepth": ["The active ICDAS depth must be an integer between 1 and 6."]
  }
}
```

---

## 2. API Endpoint Matrix

### 2.1 Authentication & Session
| Method | Route | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Authenticate clinician; returns JWT and accessible clinics | Anonymous |
| `POST` | `/api/v1/auth/refresh` | Refresh an active JWT session | Bearer |
| `GET` | `/api/v1/auth/me` | Fetch active user profile and active clinic membership | Bearer |

#### `POST /api/v1/auth/login`
- **Request Body**:
  ```json
  {
    "email": "dr.smith@dentalcare.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "token": "eyJhbGciOi...",
    "expiresAtUtc": "2026-10-23T16:00:00Z",
    "user": {
      "id": "7fa85f64-5717-4562-b3fc-2c963f66afa6",
      "email": "dr.smith@dentalcare.com",
      "fullName": "Dr. Sarah Smith"
    },
    "memberships": [
      {
        "clinicId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "clinicName": "Metropolitan Dental Clinic",
        "role": "Clinician"
      }
    ]
  }
  ```

---

### 2.2 Patient Management
All patient operations are scoped to the authenticated caller's active `clinicId`.

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/v1/patients` | Search patients with pagination (`searchTerm`, `page`, `pageSize`) |
| `GET` | `/api/v1/patients/{patientId}` | Retrieve detailed patient record |
| `POST` | `/api/v1/patients` | Register a new patient in the active clinic |
| `PUT` | `/api/v1/patients/{patientId}` | Update patient demographics and medical alerts |

#### `POST /api/v1/patients`
- **Request Body**:
  ```json
  {
    "externalMedicalRecordNumber": "MRN-2026-089",
    "firstName": "Alexander",
    "lastName": "Petrenko",
    "dateOfBirth": "1985-06-20",
    "gender": "Male",
    "phone": "+380501234567",
    "email": "alex.petrenko@example.com",
    "medicalAlerts": "Penicillin allergy; Mild hypertension."
  }
  ```
- **Response `201 Created`**: Returns created Patient DTO with `Location` header.

---

### 2.3 Dental Encounters
| Method | Route | Description |
|---|---|---|
| `GET` | `/api/v1/patients/{patientId}/encounters` | List all encounters for a patient (chronological) |
| `GET` | `/api/v1/encounters/{encounterId}` | Get single encounter details |
| `POST` | `/api/v1/patients/{patientId}/encounters` | Create a new clinical examination encounter |
| `PUT` | `/api/v1/encounters/{encounterId}/status` | Update encounter status (`InProgress`, `Completed`) |

---

### 2.4 Canonical Odontogram & Revision Operations
These endpoints handle the lossless canonical JSON odontogram state.

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/v1/encounters/{encounterId}/odontogram` | Get active odontogram snapshot + ETag |
| `GET` | `/api/v1/patients/{patientId}/odontogram/latest` | Get latest active odontogram across all encounters |
| `PUT` | `/api/v1/encounters/{encounterId}/odontogram` | Save/update canonical odontogram payload (optimistic lock) |
| `POST` | `/api/v1/encounters/{encounterId}/odontogram/finalize` | Finalize record (seal against edits, create immutable revision) |
| `GET` | `/api/v1/encounters/{encounterId}/odontogram/revisions` | List historical revision numbers and timestamps |
| `GET` | `/api/v1/encounters/{encounterId}/odontogram/revisions/{revNumber}` | Fetch specific historical snapshot |
| `GET` | `/api/v1/encounters/{encounterId}/odontogram/fhir` | Generate on-demand HL7® FHIR® R4 Bundle export |

#### `PUT /api/v1/encounters/{encounterId}/odontogram`
- **Headers**:
  - `If-Match: "2"`
- **Request Body**: Complete canonical frontend payload (`version`, `globals`, `teeth`, optional `case`, optional `plan`).
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
