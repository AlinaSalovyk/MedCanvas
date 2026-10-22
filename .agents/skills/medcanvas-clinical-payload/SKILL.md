---
name: medcanvas-clinical-payload
description: Manage, serialize, validate, and preserve MedCanvas canonical clinical odontogram JSON payloads (Status/Plan, 32 FDI teeth, globals, case metadata) with 100% lossless round-trip fidelity.
---

# MedCanvas Clinical Payload Skill

## 1. When to Activate
Activate this skill whenever:
- Designing or implementing database schema, EF Core mappings, DTOs, or validators for odontogram payloads.
- Processing, storing, retrieving, or exporting clinical odontogram snapshots.
- Implementing payload versioning, backward compatibility, or schema migrations.
- Working with Status vs. Plan dual-state data segregation.
- Writing integration and contract tests that verify round-trip fidelity between React frontend and ASP.NET Core backend.

---

## 2. Canonical JSON Structure (Frontend Contract)

The native MedCanvas odontogram payload exported by `src/engine/exportPayload.ts` follows this canonical schema:

```json
{
  "version": "2.22",
  "globals": {
    "calculus": { "18": false, "...": false },
    "periodontitis": false,
    "plaque": false,
    "gingivitis": false
  },
  "teeth": {
    "18": {
      "caries": ["mesial"],
      "restorationType": "none",
      "toothSelection": "sound",
      "perio": { ... }
    }
  },
  "case": {
    "patientName": "John Doe",
    "notes": "Routine checkup"
  },
  "plan": {
    "18": {
      "caries": [],
      "restorationType": "composite",
      "restorationSurfaces": ["mesial"]
    }
  }
}
```

### Critical Field Invariants:
1. **`version` (string, required)**: Identifies the payload schema version (current is `"2.22"`). The backend must accept valid versions `>= "2.19"` and store them losslessly.
2. **`globals` (object, required)**: Global clinical chart indicators (calculus map, periodontitis, plaque, gingivitis).
3. **`teeth` (object, required)**: Map of 32 FDI permanent tooth keys (`"18"` to `"48"`). Represents current clinical examination findings (**Status**).
4. **`case` (object, optional)**: Present only if case metadata (notes, patient demographics) is non-empty.
5. **`plan` (object, optional)**: Present only if the planned treatment differs from current status findings (**Plan**). If omitted, Plan is identical to Status.

---

## 3. Clinical Domain Invariants

The backend validator and domain logic must enforce and respect these fundamental clinical rules:

1. **Tooth Identity & Milk Teeth**:
   - Internal keys are ALWAYS permanent FDI numbers: `18`–`11`, `21`–`28`, `31`–`38`, `48`–`41`.
   - Milk (deciduous) teeth are represented as finding `toothSelection: "milktooth"` on the occupied permanent FDI coordinate. They are **NEVER** stored as separate 51–85 top-level keys.

2. **Dual-State Segregation (Status vs. Plan)**:
   - `teeth` records what the clinician observed in the mouth today.
   - `plan` records what interventions are proposed.
   - Storing an update to `plan` must never overwrite or mutate `teeth`.
   - Storing an update to `teeth` when `plan` exists must follow the dual-state confirmation rules.

3. **Caries vs. Fillings Semantics**:
   - Unfilled surface in `caries`: primary caries (`caries-{surface}`).
   - Filled surface in `caries`: recurrent/secondary caries (`subcaries-{surface}`).

4. **Periodontal Absence Semantics**:
   - Absence of a periodontal reading means "not charted", **NOT** zero mm.
   - Probing Depth (`pd`) `< 1` or `null` clears the site entirely.
   - Clinical Attachment Level (`CAL`) is derived: `CAL = PD + (GM ?? 0)` and is never stored as an independent ground truth.

5. **Radix & Restoration Gating**:
   - If `toothSubstrate == "radix"`, coronal restorations cannot exist (`restorationType == "none"`).

---

## 4. Persistence Architecture: JSONB with Relational Envelopes

- **PostgreSQL `jsonb` Column**:
  - The complete snapshot (`version`, `globals`, `teeth`, `case`, `plan`) MUST be stored in a `jsonb` column in PostgreSQL (`SnapshotData` or `PayloadJson`).
  - This guarantees 100% lossless fidelity: custom plugin states, future tooth attributes, and precise periodontal numbers are never truncated or lost by relational impedance mismatch.
- **Relational Envelopes**:
  - Relational columns on the `OdontogramRecord` aggregate:
    - `Id` (Guid, PK)
    - `PatientId` (Guid, FK)
    - `EncounterId` (Guid, FK)
    - `ClinicId` (Guid, FK)
    - `PayloadVersion` (varchar)
    - `ConcurrencyVersion` / `RowVersion` (int / byte[])
    - `IsFinalized` (bool)
    - `CreatedAtUtc`, `UpdatedAtUtc` (timestamp with time zone)
    - `FinalizedAtUtc`, `FinalizedByUserId` (optional)

---

## 5. FHIR R4 Interoperability Boundary

- MedCanvas uses HL7® FHIR® R4 Bundles (`Condition`, `Procedure`, `Observation`) exclusively for external interoperability and export/import.
- FHIR R4 is **NOT** the primary backend persistence model, because standard FHIR cannot losslessly capture custom SVG coordinate states, detailed multi-surface ICDAS grades, and MedCanvas-specific plugins.
- Native JSONB is the single source of truth; FHIR is an on-demand translation layer.

---

## 6. Required Tests

Every feature interacting with clinical payloads must execute:
1. **Round-Trip Test**: Serialize frontend JSON fixture -> save to backend -> retrieve from backend -> assert deep structural equality.
2. **Version Compatibility Test**: Verify hydration of legacy payloads (v2.19, v2.20) into v2.22+.
3. **Invalid Tooth Key Test**: Reject payloads containing invalid tooth coordinates (e.g. `"99"`, `"0"`, `"55"` as top-level keys).
4. **Immutability Test**: Verify that finalized odontogram snapshots cannot have their payload updated.
