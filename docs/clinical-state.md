# Clinical State Model — Advanced Odontogram

## 1. The Dual-State Architecture (Status vs. Plan)

A core requirement of clinical dental charting is the strict separation between:
1. **Status (Current Findings)**: The patient's actual oral condition at the time of examination (existing caries, fractured teeth, existing fillings, missing teeth).
2. **Plan (Proposed Treatment)**: The proposed clinical interventions (planned restorations, planned extractions, planned endodontics).

### 1.1 In-Memory Representation
The engine maintains two parallel state containers in `src/state/chart.ts`:
```typescript
const charts: Record<"status" | "plan", Map<number, ToothState>> = {
  status: new Map<number, ToothState>(),
  plan: new Map<number, ToothState>(),
};
```
- `toothState`: A module-scoped, reassignable alias (`let toothState = charts.status`) that always points to the active chart. All domain reads and writes operate on `toothState`, making the active mode transparent to callers.
- `chartMode`: Tracks whether the user is viewing `"status"` or `"plan"`.
- `setChartMode(mode)`: Switches the active chart, re-points `toothState`, and triggers a full repaint of the dental grid.

### 1.2 Lazy Plan Initialization
The treatment plan chart is lazily initialized:
- When entering Plan mode for the first time, `charts.plan` is deep-copied from `charts.status` via `cloneChart(charts.status, charts.plan)` (a full serialization-to-hydration round-trip).
- Once initialized (`planInitialized === true`), subsequent switches between Status and Plan leave the contents of `charts.plan` completely untouched.

---

## 2. The Deferred Dual-State Edit Gate (DS-1)

To prevent clinical inconsistencies and accidental data loss, all interactive edits pass through the centralized safety gate in `src/engine/dualStateGate.ts`:
- Single-tooth edits: `gateToothEdit(toothNo, applyFn)`
- Batch edits (e.g., dentition presets, edentulous, multi-select): `gateToothEditBatch(toothNos, applyFn)`

### 2.1 Gate Decision Matrix

| Active Mode | Tooth State in Plan | Action Taken |
|---|---|---|
| **Plan** | Any | Edits apply directly to `charts.plan`. The tooth is marked in `planEditedTeeth`. |
| **Status** | Unmodified in Plan (`!planEditedTeeth.has(toothNo)`) | Edit applies to `charts.status` and is automatically mirrored into `charts.plan` via `mirrorStatusToPlan()`. Status and Plan remain aligned (no spurious diff). |
| **Status** | Already edited in Plan (`planEditedTeeth.has(toothNo)`) | **Blocking Clinical Confirmation Modal (`DualStateConfirm`)** is displayed before applying the change. |

### 2.2 Accept vs. Cancel Semantics
When the `DualStateConfirm` dialog appears:
- **Accept**: The edit is committed to `charts.status` only. `charts.plan` retains its planned state. Status and Plan intentionally diverge, and the discrepancy appears in the "What changes" review protocol.
- **Cancel**: The edit is discarded entirely. `charts.status` is untouched, and UI input controls are reverted to match current state (`revertActiveControls()`).

---

## 3. Clinical Invariants & Domain Rules

### 3.1 Tooth Identification and Numbering
- **FDI World Dental Federation Notation (ISO 3950)** is the internal key for all teeth:
  - Upper Right: `18`–`11`
  - Upper Left: `21`–`28`
  - Lower Left: `31`–`38`
  - Lower Right: `48`–`41`
- **Deciduous (Milk) Teeth**:
  - Milk teeth are charted as a finding (`toothSelection: "milktooth"`) on the occupied permanent FDI tooth key (e.g. tooth 16 or 24).
  - They are **never** stored as separate 51–85 FDI keys in internal maps.
  - In the Measured anatomy profile, both permanent and primary SVG variants exist inside the same tile; `applyStateToSvg` activates the primary SVG when `toothSelection === "milktooth"`.

### 3.2 Substrate and Restoration Rules
- **Radix (Root Remnant)**:
  - If `toothSubstrate === "radix"`, the restoration control row is completely hidden (`restorationRowHidden(state)`).
  - No crown, bridge, inlay, or veneer can be authored on a root remnant until endodontic/post-core buildup is performed.
- **Implant Teeth**:
  - `toothSelection === "implant"` restricts restorations to crowns, bridges, and implant prosthetics (`healing-abutment`, `locator`, `bar`).
  - Implants do **not** have pulp diagnoses or periodontal mobility; mobility controls and pulp pickers are disabled/hidden.
  - Implants carry peri-implant staging (`mucositis`, `peri-implantitis-mild`, `peri-implantitis-moderate`, `peri-implantitis-severe`).
- **Missing / Gap Teeth**:
  - `toothSelection === "none"` restricts restorations to bridge pontics or removable dentures.

### 3.3 Caries vs. Filling State Machine
Caries is tracked per surface (`mesial`, `occlusal`, `distal`, `buccal`, `lingual`):
- **Unfilled Surface**: A surface in `caries` without an existing filling renders as **primary caries** (`caries-{surface}`), with opacity driven by ICDAS/CARS severity (scores 1–6).
- **Filled Surface**: A surface in `caries` that also has an existing filling in `fillingSurfaces` renders as **recurrent/secondary caries** (`subcaries-{surface}`).
- A surface is never both primary and recurrent at the same time.
- **Filling Defect**: Direct restorations may have physical defects (`marginal`, `fracture`, `wear`) independent of recurrent caries.

### 3.4 Endodontic and Pulpal Exclusivity
- Treated endodontic status (`endo`: `endo-filling`, `endo-glass-pin`, etc.) is mutually exclusive with active pulp diseases.
- Setting `endo` to a treated value automatically normalizes `pulpDx` to `normal`, suppressing diseased-pulp visual glyphs.
- Periapical diagnoses (`apicalDx`: periodontitis, abscess, osteitis) and lesion types (`periapicalType`: granuloma, cyst) remain orthogonal to endodontic obturation.

---

## 4. Periodontal Sub-Record & Derivations

Periodontal measurements are stored in a dedicated `perio` sub-record on each tooth:
- **6 Sites per tooth**: `PERIO_SITES = ["MB", "B", "DB", "ML", "L", "DL"]` (mesio-buccal, mid-buccal, disto-buccal, mesio-lingual, mid-lingual, disto-lingual).
- **Absence = Not Charted**: Missing keys signify that a site has not been probed. Setting Probing Depth (PD) to `null` or `< 1` completely un-charts the site.
- **Gingival Margin (GM)**: Signed integer representing gingival margin relative to the CEJ (+ = recession, − = pseudopocket). Defaults to 0 when PD is entered without GM.
- **Clinical Attachment Level (CAL)**: Derived, never stored:
  $$\text{CAL} = \text{PD} + (\text{GM} \ge 0 ? \text{GM} : 0)$$
- **Bleeding on Probing (%BOP)**: Whole-mouth ratio:
  $$\% \text{BOP} = \frac{\text{Charted Sites with Bleeding}}{\text{Total Charted Sites}} \times 100$$
- **2017 World Workshop Classification**:
  Derived deterministically in `src/perioClassification.ts` based on interdental CAL, max PD, radiographic bone loss, and tooth loss:
  - **Stage**: Stage I (mild), Stage II (moderate), Stage III (severe), Stage IV (very severe).
  - **Grade**: Grade A (slow progression), Grade B (moderate), Grade C (rapid).
  - **Extent**: Localized (< 30% teeth), Generalized (≥ 30% teeth), Molar-Incisor pattern.

---

## 5. Serialization and Schema Versioning

### 5.1 Payload Schema (Current: Version 2.19)
The native JSON payload format:
```json
{
  "version": "2.19",
  "globals": {
    "numberingSystem": "fdi",
    "notesEnabled": true,
    "edentulous": false
  },
  "case": {
    "patientName": "John Doe",
    "patientDob": "1980-05-15",
    "examDate": "2026-10-21",
    "smokingStatus": "never",
    "diabetesStatus": "none"
  },
  "teeth": {
    "16": {
      "toothSelection": "tooth-base",
      "toothSubstrate": "natural",
      "restorationType": "crown",
      "restorationMaterial": "zircon",
      "perio": {
        "pd": { "MB": 4, "B": 3, "DB": 4, "ML": 3, "L": 3, "DL": 3 },
        "bop": ["MB", "DB"]
      }
    }
  },
  "plan": {
    "version": "2.19",
    "teeth": { ... }
  }
}
```

### 5.2 Backward Compatibility
`src/state/payload.ts` provides automatic migration for earlier schema payloads:
- Legacy versions 1.4 through 2.18 are parsed and migrated to current schema on import.
- Omit-when-empty policy: Default and uncharted properties are omitted from JSON output to ensure minimal payload sizes.
