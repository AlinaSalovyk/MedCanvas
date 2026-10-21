# Backend Integration Readiness — Advanced Odontogram

> **Document Status:** Architectural Specification & Integration Boundary Map  
> **Target Future Backend:** C# / ASP.NET Core Web API, PostgreSQL, Entity Framework Core  
> **Current Project Status:** All backend capabilities described herein are **PLANNED, NOT IMPLEMENTED**. No backend source code exists in this repository.

---

## 1. Executive Summary & Integration Strategy

The **React Advanced Odontogram** is currently a fully client-side application. To support enterprise EHR/MIS deployment, multi-device synchronization, and auditable patient history, the frontend will eventually integrate with an ASP.NET Core Web API backend.

This document formalizes the **exact contract boundaries**, canonical data models, concurrency mechanisms, and interoperability endpoints established in the frontend codebase, ensuring future backend architects can design the persistence layer without altering frontend clinical invariants.

---

## 2. Current Frontend Persistence & State Boundary

### 2.1 Current Local Behavior
- **Implementation**: [`src/persistence.ts`](../src/persistence.ts).
- **Mechanism**: Browser `window.localStorage`.
- **Storage Scope**:
  - `odontogram_session_settings`: UI preferences (numbering system, dark/light theme, surface notation, card collapse states, detail levels).
  - `odontogram_chart_state`: Full dental formula snapshot (when persistence is enabled in standalone mode).
- **Limitation**: Unencrypted, device-bound, no multi-user concurrence or audit trail.

### 2.2 Boundary Hand-Off
When the ASP.NET Core API is introduced:
- LocalStorage persistence in `src/persistence.ts` will serve strictly as a local draft cache and offline fallback.
- Authoritative persistence will shift to remote REST/JSON endpoints via a dedicated API client module.

---

## 3. Canonical Odontogram Payload & Versioning

### 3.1 Payload Versioning
- **Current Version**: `2.19` (defined in [`src/state/payload.ts`](../src/state/payload.ts) as `PAYLOAD_VERSION`).
- **Semantic Evolution**:
  - v2.3–v2.6: Unified ICDAS/CARS caries severity state machine.
  - v2.7: Direct filling defect annotations.
  - v2.8–v2.10: Wear types, discoloration causes, and orthodontic axes.
  - v2.12–v2.16: Periodontal probing, furcation, plaque, Mombelli indices.
  - v2.17–v2.19: Case metadata, 2017 AAP/EFP classification overrides, and patient exam identity.
- **Backend Requirement**: The database must persist `payloadVersion: "2.19"` as an explicit property. Incoming older payloads must trigger backend/frontend migration pipelines.

### 3.2 Canonical JSON Structure
The full mouth state exported via `collectExportPayload()` produces:

```json
{
  "version": "2.19",
  "chartMode": "status",
  "charts": {
    "status": {
      "18": { "toothSelection": "tooth-base", "toothSubstrate": "natural", "restorationType": "none", "...": "..." },
      "11": {
        "toothSelection": "tooth-base",
        "toothSubstrate": "natural",
        "caries": ["mesial"],
        "cariesSeverity": { "mesial": 2 },
        "perio": {
          "pd": { "MB": 4, "B": 3, "DB": 5, "ML": 3, "L": 3, "DL": 4 },
          "gm": { "MB": 1, "B": 0, "DB": 2, "ML": 0, "L": 0, "DL": 1 },
          "bop": ["DB", "MB"]
        }
      }
    },
    "plan": {
      "11": {
        "toothSelection": "tooth-base",
        "toothSubstrate": "natural",
        "fillingSurfaces": ["mesial"],
        "fillingSurfaceMaterials": { "mesial": "composite" }
      }
    }
  },
  "case": {
    "patientName": "John Doe",
    "examDate": "2026-10-21",
    "patientAge": 45,
    "smokingStatus": "former",
    "diabetesStatus": "present",
    "hba1c": 6.8,
    "maxRblPercent": 35,
    "teethLostPerio": 2,
    "diagnosisOverride": null,
    "stageOverride": "iii",
    "gradeOverride": "b",
    "extentOverride": "generalized"
  },
  "globals": {
    "numberingSystem": "fdi",
    "surfaceNotation": "full"
  }
}
```

---

## 4. Status vs. Plan Dual-State Storage Representation

### 4.1 In-Memory and Serialization Contract
- **Storage**: `charts.status` and `charts.plan` are independent maps keyed by integer FDI tooth number (`11`–`48`).
- **Plan Independence**: A tooth unmodified in Plan mode may either be omitted or match Status. Once modified in Plan mode, it represents planned treatments (e.g., Status shows caries on mesial; Plan shows composite filling on mesial).
- **Backend Relational Mapping Considerations**:
  - *Option A (Document in Relational)*: Store the entire chart snapshot as a `jsonb` column in PostgreSQL (`dental_chart_snapshots`).
  - *Option B (Normalized Entities)*: `ToothFinding` entity with a `ChartType` enum (`Status = 0`, `Plan = 1`).
  - *Recommendation*: Store the canonical `jsonb` payload for lossless rendering fidelity, augmented by relational projections for clinical querying and reporting.

---

## 5. Serialization & Deserialization Entry Points

Frontend methods available for API client integration:

| Operation | Function | Location | Description |
|---|---|---|---|
| **Serialize** | `collectExportPayload()` | `src/odontogram.ts` | Returns full JavaScript object conforming to canonical schema. |
| **Hydrate** | `importStatus(payload)` | `src/odontogram.ts` | Hydrates full status + plan state, validates all values, triggers repaint. |
| **Export JSON** | `exportStatusJson()` | `src/odontogram.ts` | Serializes state to JSON string. |
| **Subscribe** | `onStateChange(callback)` | `src/state/notify.ts` | Triggers whenever any tooth, perio site, or setting changes. Ideal for auto-save debouncing. |

---

## 6. Clinical Validation Invariants (Frontend vs. Backend)

> [!WARNING]
> While the frontend enforces clinical validity in `src/state/payload.ts` (`VALID_*` sets, clamping, and gates), the future ASP.NET Core backend **MUST NOT** rely solely on client validation.

The backend must validate:
1. **Tooth FDI Identifiers**: Must belong to the valid permanent FDI set (`11-18`, `21-28`, `31-38`, `41-48`).
2. **Restoration Matrix**: Radix teeth cannot carry restorations; implants cannot carry natural inlays/onlays.
3. **Periodontal Bounds**:
   - Probing Depth (PD): Integer `1` to `15` mm (or null/empty).
   - Gingival Margin (GM): Integer `-10` to `+20` mm.
   - Furcation: Integer `1` to `4` (Glickman grades) on anatomically valid entrances.
4. **Caries Severity**: Unified scale integers `0` to `6`.

---

## 7. FHIR Interoperability Boundaries & Limitations

### 7.1 Existing FHIR Capabilities
- **Export**: `exportFhir()` produces a valid **HL7® FHIR® R4 Bundle** (`type: "transaction"` or `"collection"`) containing:
  - `Patient`: Subject reference.
  - `Observation` (Tooth Status): Code `https://odontogram.app/fhir/CodeSystem/odontogram#tooth-status`.
  - `Observation` (Periodontal Panel): LOINC `74029-0` with per-site component extensions.
  - `Condition`: Periodontal diagnoses (ICD-10 / BNO-10) with staging/grading qualifiers.
- **Import**: `importFhirBundle()` parses core observations and restores tooth findings.

### 7.2 FHIR Limitations (Important for Backend Engineers)
- **Round-Trip Asymmetry**: While native JSON payloads guarantee 100% round-trip fidelity, FHIR export maps certain granular engine states to standard LOINC/SNOMED codes that cannot be fully inverted back without data loss.
- **Internal Storage Recommendation**: The backend must treat **native JSON** as the primary source of truth for odontogram persistence, and use **FHIR R4** for external health information exchanges (HIE / EHR integration).

---

## 8. Patient, Encounter, and Concurrency Boundaries

### 8.1 Aggregate Roots & Ownership
In the future ASP.NET Core domain model:
- **`Patient`** (Root): Identity, medical history, allergies.
- **`Encounter` / `DentalVisit`**: A specific appointment with a treating clinician.
- **`OdontogramRecord`**:
  - `Id` (UUID)
  - `PatientId` (UUID, Foreign Key)
  - `EncounterId` (UUID, Foreign Key)
  - `CreatedAt` (UTC DateTime)
  - `CreatedByClinicianId` (UUID)
  - `PayloadVersion` (String: `"2.19"`)
  - `SnapshotData` (JSONB / text)
  - `RowVersion` / `ConcurrencyToken` (byte[] or uint)

### 8.2 Concurrency & Revisioning Requirements
- **Clinical Immutability**: Signed clinical status snapshots from past visits must be immutable. A new examination creates a new version or child encounter.
- **Optimistic Concurrency**: When multiple clinicians or operatories view the same chart, edits must send an `ETag` or `RowVersion`. A conflict (`HTTP 409 Conflict`) must prompt the user rather than silently overwriting another clinician's findings.

---

## 9. Security, Compliance, and Audit Requirements

1. **HIPAA / GDPR / Medical Confidentiality**:
   - All patient identifiers (name, age, exam dates, clinical findings) are Protected Health Information (PHI).
   - In transit: Enforce TLS 1.3.
   - At rest: PostgreSQL Transparent Data Encryption or field-level encryption for sensitive clinical records.
2. **Audit Logging**:
   - Every mutation of tooth status, periodontal index, or treatment plan must generate an immutable audit log entry (Clinician ID, Timestamp, Action, Old Value, New Value).
3. **Authentication & Authorization**:
   - Integration with OAuth 2.0 / OpenID Connect (e.g. Duende IdentityServer, Microsoft Entra, or Keycloak).
   - Role-Based Access Control (RBAC):
     - `Dentist / Clinician`: Full read/write for Status and Plan.
     - `Hygienist`: Full read/write for Periodontal chart and Hygiene indices.
     - `Assistant / Receptionist`: Read-only or appointment linking.

---

## 10. Summary Checklist for Future .NET Architect

- [ ] Maintain `src/state/payload.ts` schema as canonical JSON wire format.
- [ ] Implement EF Core entity mapping for `OdontogramRecord` with PostgreSQL `jsonb`.
- [ ] Provide REST endpoints: `GET /api/patients/{id}/odontogram/latest`, `POST /api/patients/{id}/odontogram`, `GET /api/encounters/{id}/odontogram`.
- [ ] Implement ETag / optimistic concurrency handling.
- [ ] Support HL7® FHIR® R4 Bundle export via ASP.NET Core FHIR sub-controllers using `fhir/CodeSystem-odontogram.json`.
- [ ] Enforce medical audit logging on all chart mutations.
