# MedCanvas Frontend Contract & Wire Payload Audit

> **Document Status:** Authoritative Verified Contract  
> **Source Evidence:** `src/engine/exportPayload.ts`, `src/state/payload.ts`, `src/state/chart.ts`, `src/state/caseMeta.ts`, `src/persistence.ts`, `src/fhir/`  
> **Version Tag:** `2.22` (Active implementation precedence over outdated documentation)

---

## 1. Executive Summary & Architectural Precedence

Earlier project documentation (`docs/backend-integration-readiness.md`) referenced an older payload version `2.19` and a nested `{ charts: { status: ..., plan: ... } }` object model. 

In accordance with strict system rules:
**CURRENT ACTIVE CODE (`src/engine/exportPayload.ts`) AND PASSING TESTS TAKE ABSOLUTE PRECEDENCE OVER LEGACY DOCUMENTATION.**

The active frontend serializes the complete odontogram using `collectExportPayload()`:
```typescript
return {
  version: "2.22",
  globals: collectGlobals(),
  teeth: statusTeeth,
  ...(caseMetaIsEmpty(caseMeta) ? {} : { case: serializeCaseMeta(caseMeta) }),
  ...(planDiffers ? { plan: planTeeth } : {}),
};
```

This document establishes the verified schema, clinical invariants, serialization rules, and synthetic test fixtures that the ASP.NET Core backend must accept, store in PostgreSQL `jsonb`, validate, and return with 100% round-trip fidelity.

---

## 2. Canonical Payload Schema Overview

### 2.1 Top-Level Wire Envelope

| Field | Type | Mandatory? | Description |
|---|---|---|---|
| `version` | `string` | **Yes** | Payload schema version. Current is `"2.22"`. Backend accepts versions `<= "2.22"`, rejecting future unsupported versions (e.g. `"3.0"`), while supporting legacy migrations down to `"1.4"`. |
| `globals` | `object` | **Yes** | Global UI and chart display toggles (`wisdomVisible`, `showBase`, `occlusalVisible`, `showHealthyPulp`, `edentulous`). |
| `teeth` | `Record<string, ToothRecord>` | **Yes** | Map of permanent FDI tooth keys (`"18"` to `"48"`) or primary teeth (`"51"` to `"85"`). Represents current clinical examination findings (**Status**). |
| `case` | `CaseMetaRecord` | No | Omitted when all case metadata is at defaults (`caseMetaIsEmpty(caseMeta) == true`). Present when demographics, periodontal risk factors, or case conditions are charted. |
| `plan` | `Record<string, ToothRecord>` | No | Omitted when treatment planning is uninitialized or identical to Status. Present when planned interventions differ from Status findings. |

---

## 3. Tooth Coordinate System & FDI Identifiers

- Internal keys are **strictly permanent FDI notation (ISO 3950)**:
  - **Upper Right (Quadrant 1)**: `"18"`, `"17"`, `"16"`, `"15"`, `"14"`, `"13"`, `"12"`, `"11"`
  - **Upper Left (Quadrant 2)**: `"21"`, `"22"`, `"23"`, `"24"`, `"25"`, `"26"`, `"27"`, `"28"`
  - **Lower Left (Quadrant 3)**: `"31"`, `"32"`, `"33"`, `"34"`, `"35"`, `"36"`, `"37"`, `"38"`
  - **Lower Right (Quadrant 4)**: `"48"`, `"47"`, `"46"`, `"45"`, `"44"`, `"43"`, `"42"`, `"41"`
- **Deciduous (Milk) Teeth Invariant**:
  - Deciduous teeth are charted with `toothSelection: "milktooth"` on the occupied permanent FDI coordinate (e.g. deciduous upper right central incisor is charted at key `"11"`, NOT `"51"`).
  - The backend validator MUST reject payloads containing 51–85 top-level keys.

---

## 4. Per-Tooth Finding Schema (`ToothRecord`)

### 4.1 Restorative, Anatomy & Endodontic Fields

| Field | Type | Allowed Values / Constraints | Default |
|---|---|---|---|
| `toothSelection` | `string` | `"tooth-base"`, `"none"`, `"milktooth"`, `"implant"`, and anatomical variants | `"tooth-base"` |
| `toothSubstrate` | `string` | `"natural"`, `"radix"`, `"broken"`, `"crownprep"` | `"natural"` |
| `restorationType` | `string` | `"none"`, `"crown"`, `"inlay"`, `"onlay"`, `"veneer"`, `"bridge"` | `"none"` |
| `restorationMaterial` | `string` | `"none"`, `"emax"`, `"gold"`, `"gradia"`, `"zircon"`, `"metal"`, `"metal-ceramic"`, `"telescope"`, `"temporary"` | `"none"` |
| `crownLeakage` | `boolean` | `true`, `false` | `false` |
| `caries` | `string[]` | Array of surfaces: subset of `["buccal", "mesial", "distal", "occlusal", "lingual"]` | `[]` |
| `cariesActiveDepth` | `number` | Integer `1` to `6` (canonical ICDAS depth) | `2` |
| `cariesSeverity` | `Record<string, number>` | Surface -> severity integer `0` to `6` (ICDAS on unfilled; CARS on filled) | `{}` |
| `fillingMaterial` | `string` | Active UI dropdown selection (`"none"`, `"composite"`, `"amalgam"`, `"gic"`, `"temporary"`) | `"none"` |
| `fillingSurfaces` | `string[]` | Array of filled surfaces: subset of 5 canonical surfaces | `[]` |
| `fillingSurfaceMaterials` | `Record<string, string>` | Surface -> `"amalgam"`, `"composite"`, `"gic"`, `"temporary"` | `{}` |
| `fillingDefect` | `Record<string, string>` | Surface -> `"none"`, `"marginal"`, `"fracture"`, `"wear"` | `{}` |
| `fissureSealing` | `boolean` | `true`, `false` | `false` |
| `calculus` | `boolean` | `true`, `false` | `false` |
| `contactMesial` | `boolean` | `true`, `false` | `false` |
| `contactDistal` | `boolean` | `true`, `false` | `false` |
| `wearEdge` | `string` | `"none"`, `"attrition"`, `"erosion"` | `"none"` |
| `wearCervical` | `string` | `"none"`, `"abrasion"`, `"abfraction"`, `"erosion"` | `"none"` |
| `discoloration` | `string` | `"none"`, `"tetracycline"`, `"fluorosis"`, `"nonvital"`, `"extrinsic"`, `"other"` | `"none"` |
| `endo` | `string` | `"none"`, `"endo-medical-filling"`, `"endo-filling"`, `"endo-glass-pin"`, `"endo-metal-pin"` | `"none"` |
| `endoResection` | `boolean` | `true`, `false` | `false` |
| `periapicalType` | `string` | `"none"`, `"granuloma"`, `"cyst"`, `"abscess"` | `"none"` |
| `pulpDx` | `string` | `"normal"`, `"reversible-pulpitis"`, `"irreversible-pulpitis"`, `"necrosis"` | `"normal"` |
| `pulpLatin` | `string` | Practical Latin diagnosis enum (`"none"`, `"pulpa-sana"`, ...) | `"none"` |
| `apicalDx` | `string` | Apical diagnosis (`"normal"`, `"symptomatic-apical-periodontitis"`, ...) | `"normal"` |
| `resorptionType` | `string` | `"none"`, `"internal"`, `"external-cervical"` | `"none"` |
| `rootCaries` | `string` | `"none"`, `"active"`, `"arrested"`, `"active-cavitated"` | `"none"` |
| `radiographicDepth` | `Record<string, string>` | Surface -> `"none"`, `"E1"`, `"E2"`, `"D1"`, `"D2"`, `"D3"` | `{}` |
| `mobility` | `string` | `"none"`, `"m1"`, `"m2"`, `"m3"` | `"none"` |
| `prosthesis` | `string` | `"none"`, `"healing-abutment"`, `"locator"`, `"bar"`, ... | `"none"` |
| `periImplant` | `string` | `"none"`, `"mucositis"`, `"peri-implantitis-mild"`, ... | `"none"` |

### 4.2 Orthodontic & Structural Integrity Fields

| Field | Type | Allowed Values |
|---|---|---|
| `orthoAppliance` | `string` | `"none"`, `"bracket"`, `"band"` |
| `orthoDrift` | `string` | `"none"`, `"mesial"`, `"distal"` |
| `orthoVertical` | `string` | `"none"`, `"extrusion"`, `"intrusion"` |
| `orthoRotation` | `boolean` | `true`, `false` |
| `brokenMesial`, `brokenIncisal`, `brokenDistal` | `boolean` | `true`, `false` |
| `extractionWound`, `extractionPlan` | `boolean` | `true`, `false` |
| `parapulpalPin`, `crownReplace`, `crownNeeded` | `boolean` | `true`, `false` |
| `missingClosed`, `bridgePillar` | `boolean` | `true`, `false` |

### 4.3 Periodontal Multi-Site Sub-Records (Omit-When-Empty Convention)

1. **`perio` (6 Probing Sites: `MB`, `B`, `DB`, `ML`, `L`, `DL`)**:
   - Emitted ONLY if at least one site has a probing depth (`pd.size > 0`).
   - Structure:
     ```json
     "perio": {
       "pd": { "MB": 4, "B": 3, "DB": 5, "ML": 3, "L": 3, "DL": 4 },
       "gm": { "MB": 1, "B": 0, "DB": 2, "ML": 0, "L": 0, "DL": 1 },
       "bop": ["DB", "MB"],
       "sup": ["DB"]
     }
     ```
   - Absence means "not charted", never zero.
   - CAL is derived: `CAL = PD + (GM ?? 0)`.

2. **`furcation` (Glickman I–IV, 1–4)**:
   - Emitted ONLY when at least one entrance is graded: `"furcation": { "buccal": 2 }`.
3. **`plaque` (O'Leary 4 Surfaces)**:
   - Emitted ONLY when plaque is present: `"plaque": ["mesial", "buccal"]`.
4. **`pi`, `gi` (Silness-Löe & Löe-Silness Graded 1–3)**:
   - Emitted ONLY when at least one surface is graded: `"pi": { "buccal": 2 }`.
5. **`kg` (Keratinized Gingiva Width)**:
   - Emitted ONLY when charted: integer `0` to `15` (`"kg": 4`).
6. **`dxOverrides`**:
   - Per-tooth ICD-10 diagnosis add/suppress overrides: `"dxOverrides": { "caries": "suppress" }`.
7. **`customStates` & `note`**:
   - Dynamic plugin key-value map and clinician free-text note.

---

## 5. Case Metadata Schema (`case`)

Serialized only when non-empty (`caseMetaIsEmpty == false`):

```json
{
  "age": 46,
  "smokingStatus": "current",
  "cigarettesPerDay": 15,
  "diabetesStatus": "present",
  "hba1c": 7.4,
  "toothLossPerio": 2,
  "maxRblPercent": 40,
  "diagnosisOverride": "periodontitis",
  "stageOverride": "III",
  "gradeOverride": "C",
  "extentOverride": "generalized",
  "patientName": "Alexandre Dupont",
  "patientDob": "1980-04-12",
  "examDate": "2026-10-22",
  "caseConditions": {
    "tmjDisorder": "right",
    "oralAphthae": "unspecified"
  }
}
```

---

## 6. Status vs. Plan Dual-State Semantics

1. **State Independence**:
   - `teeth` records current clinical examination findings.
   - `plan` records planned treatments.
   - If `plan` is absent on the wire, the UI considers Plan uninitialized (or identical to Status).
2. **Persistence Boundary**:
   - Both `teeth` and `plan` reside inside the single canonical JSON snapshot stored in the PostgreSQL `jsonb` column.
   - Saving a treatment plan never overwrites current status teeth.
   - Concurrency version (`ConcurrencyVersion` or ETag) protects the entire snapshot aggregate from concurrent overwrite.

---

## 7. Machine-Readable Synthetic Contract Fixtures

All valid canonical fixtures are generated directly by frontend `serializeState()` and `defaultState()` via `npm run fixtures:generate` (`src/__tests__/parity/canonical-fixtures.ts`).
The output is stored in `backend/tests/MedCanvas.Tests.Data/Fixtures/generated/` and consumed by C# tests via `ClinicalPayloadFixtures.cs`.
Automated drift detection in `src/__tests__/parity/canonical-fixtures.test.ts` guarantees byte-for-byte fidelity with frontend serialization.

### Fixture 1: Minimal Sound 32-Tooth Chart (Default Initialization)

```json
{
  "version": "2.22",
  "globals": {
    "wisdomVisible": true,
    "showBase": true,
    "occlusalVisible": true,
    "showHealthyPulp": false,
    "edentulous": false
  },
  "teeth": {
    "18": {
      "toothSelection": "tooth-base",
      "pulpDx": "normal",
      "pulpLatin": "none",
      "apicalDx": "normal",
      "endoResection": false,
      "resorptionType": "none",
      "periImplant": "none",
      "mods": [],
      "periapicalType": "none",
      "endo": "none",
      "caries": [],
      "cariesActiveDepth": 2,
      "cariesSeverity": {},
      "fillingMaterial": "none",
      "fillingSurfaces": [],
      "fillingSurfaceMaterials": {},
      "fissureSealing": false,
      "calculus": false,
      "contactMesial": false,
      "contactDistal": false,
      "wearEdge": "none",
      "wearCervical": "none",
      "discoloration": "none",
      "orthoAppliance": "none",
      "orthoDrift": "none",
      "orthoVertical": "none",
      "orthoRotation": false,
      "brokenMesial": false,
      "brokenIncisal": false,
      "brokenDistal": false,
      "extractionWound": false,
      "extractionPlan": false,
      "parapulpalPin": false,
      "crownReplace": false,
      "crownNeeded": false,
      "missingClosed": false,
      "bridgePillar": false,
      "prosthesis": "none",
      "mobility": "none",
      "toothSubstrate": "natural",
      "restorationType": "none",
      "restorationMaterial": "none",
      "crownLeakage": false,
      "rootCaries": "none",
      "radiographicDepth": {},
      "fillingDefect": {}
    }
  }
}
```

### Fixture 2: Comprehensive Multi-Surface Caries, Restorations, Perio & Plan

```json
{
  "version": "2.22",
  "globals": {
    "wisdomVisible": true,
    "showBase": true,
    "occlusalVisible": true,
    "showHealthyPulp": true,
    "edentulous": false
  },
  "case": {
    "age": 52,
    "smokingStatus": "former",
    "diabetesStatus": "present",
    "hba1c": 6.9,
    "toothLossPerio": 1,
    "maxRblPercent": 35,
    "patientName": "Jane Clinical Patient",
    "patientDob": "1974-08-15",
    "examDate": "2026-10-22",
    "caseConditions": {
      "tmjDisorder": "left"
    }
  },
  "teeth": {
    "16": {
      "toothSelection": "tooth-base",
      "toothSubstrate": "natural",
      "restorationType": "none",
      "restorationMaterial": "none",
      "crownLeakage": false,
      "caries": ["mesial", "occlusal"],
      "cariesActiveDepth": 4,
      "cariesSeverity": { "mesial": 4, "occlusal": 3 },
      "fillingMaterial": "none",
      "fillingSurfaces": [],
      "fillingSurfaceMaterials": {},
      "fillingDefect": {},
      "fissureSealing": false,
      "calculus": true,
      "contactMesial": false,
      "contactDistal": false,
      "endo": "none",
      "endoResection": false,
      "pulpDx": "reversible-pulpitis",
      "pulpLatin": "hyperaemia-pulpae",
      "apicalDx": "normal",
      "resorptionType": "none",
      "periImplant": "none",
      "periapicalType": "none",
      "wearEdge": "none",
      "wearCervical": "none",
      "discoloration": "none",
      "orthoAppliance": "none",
      "orthoDrift": "none",
      "orthoVertical": "none",
      "orthoRotation": false,
      "brokenMesial": false,
      "brokenIncisal": false,
      "brokenDistal": false,
      "extractionWound": false,
      "extractionPlan": false,
      "parapulpalPin": false,
      "crownReplace": false,
      "crownNeeded": false,
      "missingClosed": false,
      "bridgePillar": false,
      "prosthesis": "none",
      "mobility": "none",
      "rootCaries": "none",
      "radiographicDepth": { "mesial": "D2" },
      "perio": {
        "pd": { "MB": 5, "B": 3, "DB": 6, "ML": 4, "L": 3, "DL": 5 },
        "gm": { "MB": 1, "B": 0, "DB": 2, "ML": 0, "L": 0, "DL": 1 },
        "bop": ["MB", "DB", "DL"],
        "sup": ["DB"]
      },
      "furcation": { "buccal": 2, "mesial": 1 },
      "plaque": ["mesial", "buccal"],
      "pi": { "mesial": 2, "buccal": 1 },
      "gi": { "mesial": 2, "buccal": 2 },
      "kg": 3,
      "mods": []
    },
    "11": {
      "toothSelection": "tooth-base",
      "toothSubstrate": "crownprep",
      "restorationType": "crown",
      "restorationMaterial": "zircon",
      "crownLeakage": false,
      "caries": [],
      "cariesActiveDepth": 2,
      "cariesSeverity": {},
      "fillingMaterial": "none",
      "fillingSurfaces": [],
      "fillingSurfaceMaterials": {},
      "fillingDefect": {},
      "fissureSealing": false,
      "calculus": false,
      "contactMesial": false,
      "contactDistal": false,
      "endo": "endo-filling",
      "endoResection": false,
      "pulpDx": "normal",
      "pulpLatin": "none",
      "apicalDx": "normal",
      "resorptionType": "none",
      "periImplant": "none",
      "periapicalType": "none",
      "wearEdge": "none",
      "wearCervical": "none",
      "discoloration": "none",
      "orthoAppliance": "none",
      "orthoDrift": "none",
      "orthoVertical": "none",
      "orthoRotation": false,
      "brokenMesial": false,
      "brokenIncisal": false,
      "brokenDistal": false,
      "extractionWound": false,
      "extractionPlan": false,
      "parapulpalPin": false,
      "crownReplace": false,
      "crownNeeded": false,
      "missingClosed": false,
      "bridgePillar": false,
      "prosthesis": "none",
      "mobility": "none",
      "rootCaries": "none",
      "radiographicDepth": {},
      "mods": []
    }
  },
  "plan": {
    "16": {
      "toothSelection": "tooth-base",
      "toothSubstrate": "natural",
      "restorationType": "none",
      "restorationMaterial": "none",
      "crownLeakage": false,
      "caries": [],
      "cariesActiveDepth": 2,
      "cariesSeverity": {},
      "fillingMaterial": "composite",
      "fillingSurfaces": ["mesial", "occlusal"],
      "fillingSurfaceMaterials": { "mesial": "composite", "occlusal": "composite" },
      "fillingDefect": {},
      "fissureSealing": false,
      "calculus": false,
      "contactMesial": false,
      "contactDistal": false,
      "endo": "none",
      "endoResection": false,
      "pulpDx": "normal",
      "pulpLatin": "none",
      "apicalDx": "normal",
      "resorptionType": "none",
      "periImplant": "none",
      "periapicalType": "none",
      "wearEdge": "none",
      "wearCervical": "none",
      "discoloration": "none",
      "orthoAppliance": "none",
      "orthoDrift": "none",
      "orthoVertical": "none",
      "orthoRotation": false,
      "brokenMesial": false,
      "brokenIncisal": false,
      "brokenDistal": false,
      "extractionWound": false,
      "extractionPlan": false,
      "parapulpalPin": false,
      "crownReplace": false,
      "crownNeeded": false,
      "missingClosed": false,
      "bridgePillar": false,
      "prosthesis": "none",
      "mobility": "none",
      "rootCaries": "none",
      "radiographicDepth": {},
      "mods": []
    }
  }
}
```

---

## 8. Integration Points & Future API Client Design

1. **Autosave Pipeline**:
   - `src/persistence.ts` debounces state changes (`SAVE_DEBOUNCE_MS = 400ms`).
   - The future typed API adapter `MedCanvasApiClient` will hook into `onStateChange()` and dispatch debounced `PUT /api/v1/patients/{patientId}/encounters/{encounterId}/odontogram` with an `If-Match: "{etag}"` header.
2. **Conflict Recovery**:
   - On `412 Precondition Failed` or `409 Conflict`, the frontend will alert the clinician and present a merge/override prompt without silent overwriting.
3. **FHIR R4 Adapter**:
   - Native JSON remains the primary database persistence mechanism.
   - FHIR bundles are generated on demand via `exportFhir()` or server-side FHIR serialization endpoints.
