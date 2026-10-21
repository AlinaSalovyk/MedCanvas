# Project Map — Subsystems and Source Inventory

This document provides a developer-friendly structural guide to the entire **Advanced Odontogram** codebase. When looking for a specific responsibility, clinical rule, or UI component, consult the directory mapping below.

---

## 1. Top-Level Directory Layout

```
React-Advanced-Odontogram/
├── .github/workflows/      # CI pipelines (GitHub Actions: test, lint, build, e2e)
├── design/                 # High-level UX and architectural design specifications
├── docs/                   # Authoritative technical documentation
├── e2e/                    # Playwright browser end-to-end tests
├── fhir/                   # Published HL7® FHIR® R4 terminology conformance package
├── notes/                  # [EXCLUDED/GITIGNORED] Independent local workspace files
├── src/                    # TypeScript / React application source code
└── tools/toothgen/         # Python toolchain for generating measured anatomy SVG assets
```

---

## 2. Source Code Architecture (`src/`)

### 2.1 Engine Lifecycle & Public API
- **`src/odontogram.ts`**: Central facade coordinating the imperative SVG DOM grid and React UI. Exports all 349 public engine symbols (`initOdontogram`, `destroyOdontogram`, `exportFhir`, `setPerioSite`, etc.).
- **`src/main.tsx`**: Application entry point mounting the root `<App />` component.
- **`src/App.tsx`**: Top-level React shell layout (`OdontogramShell`), composable surface layout, and host modal containers.
- **`src/OdontogramContext.tsx`**: React context provider (`OdontogramProvider`) managing reactive session state.
- **`src/theme.ts`**: CSS variable theme switching logic (light/dark mode).
- **`src/tour.ts`**: Guided step-by-step interactive application tour for first-time users.
- **`src/plugin.ts` & `src/pluginSanitize.ts`**: Third-party plugin interface contracts and SVG sanitization.
- **`src/persistence.ts`**: LocalStorage session and preference caching.

---

### 2.2 State Management Tier (`src/state/`)
The lower-tier state modules are strictly decoupled from DOM manipulation and React components:
- **`chart.ts`**: Holds dual-state maps (`charts.status` and `charts.plan`), the active alias `toothState`, and chart deep-cloning (`cloneChart`).
- **`payload.ts`**: Single source of truth for tooth record schemas. Contains `defaultState()`, `serializeState()`, `hydrateState()`, and validation sets (`VALID_*`).
- **`notify.ts`**: Synchronous event bus (`onStateChange`, `notifyStateChange`).
- **`caseMeta.ts`**: Patient case-level metadata (age, smoking status, diabetes, bone loss, teeth lost, patient name, exam date, clinician diagnosis overrides).
- **`perio.ts`**: Six-site periodontal data accessors (`setPerioSite`, `getToothPerio`, `getToothCal`, `getPerioSummary`).
- **`perioSettings.ts`**: User session preferences for periodontal row visibility and index naming conventions.
- **`pulpApical.ts`**: Pulp and periapical status mutations and detail-level switches.
- **`displaySettings.ts`**: Surface notation (simple/full) and clinical finding detail levels.
- **`numbering.ts`**: Numbering system state (FDI, Universal, Palmer).
- **`examCompare.ts`**: Comparative diffing between multiple examination snapshots.

---

### 2.3 Clinical Domain Engine (`src/engine/`)
- **`dualStateGate.ts`**: Safety-critical edit gates (`gateToothEdit`, `gateToothEditBatch`) and deferred confirmation dialog coordinator (`requestDualStateConfirm`).
- **`rendering/toothSvgPainter.ts`**: Functional painter applying active clinical state to tooth SVG elements (classes, inline opacities, and dashed treatment plan strokes).
- **`controls/`**:
  - `selectionControls.ts`: Tooth selection button synchronization.
  - `chartTransferControls.ts`: JSON/FHIR file import/export event binding.
  - `perioGridController.ts`: Perio grid navigation and value input handling.
  - `controlPresentation.ts`: Presentation state helper routines.
- **`overlays/`**:
  - `bridgeOverlayManager.ts`: Multi-tooth fixed prosthetic span calculation and arch-aware SVG connectors.
  - `pluginOverlayRenderer.ts`: Sanitized third-party SVG overlay rendering.
  - `tileOverlays.ts`: Interactive focus rings, selection badges, and active tooth indicators.
- **`gestures/touchGestures.ts`**: Mobile touch pinch-zoom, panning, and long-press context menus.
- **`navigation/tileNavigation.ts`**: WCAG 2.1 AA accessible keyboard navigation across the tooth grid.
- **`popups/surfacePopups.ts`**: Contextual floating popups for caries depths, filling materials, and defects.
- **`presets/clinicalPresetCalculators.ts`**: Whole-mouth dentition presets (primary, mixed, adult, edentulous, fixed bridge).
- **`warnings.ts`**: Real-time clinical safety warnings (e.g. unrestored root remnant, untreated caries).
- **`cards/`**: Connectors between declarative React cards and imperative engine setters (`cariesCardApi.ts`, `fillingsCardApi.ts`, `toothDetailsCardApi.ts`, `orthoCardApi.ts`, `rootPerioCardApi.ts`, `diagnosesCardApi.ts`).
- **`exportSvg.ts` & `exportRasterPdf.ts`**: Canvas rasterization and headless standalone SVG generation.

---

### 2.4 Registries & Diagnostic Coding (`src/registry/`, `src/dx/`)
- **`src/registry/axes.ts`**: Declarative clinical finding definitions, value IDs, value labels, and SVG layer links.
- **`src/registry/restorations.ts`**: Restoration matrix gating allowable combinations of tooth kinds, restoration types, and materials.
- **`src/registry/uiOptions.ts`**: Dynamic builders for dropdown pickers.
- **`src/registry/svgLayers.ts` & `svgActivate.ts`**: Mapping between clinical finding values and SVG `<g id="...">` layers.
- **`src/dx/codes.ts`**: Unified catalog of diagnostic codes (ICD-10, SNOMED CT).
- **`src/dx/derive.ts`**: Pure rules engine deriving dental diagnoses from charted findings.
- **`src/dx/packs.ts`**: National diagnostic code packs (WHO ICD-10, Hungarian BNO-10, US ICD-10-CM).
- **`src/dx/refine.ts`**: Hierarchical diagnostic refinement engine.

---

### 2.5 HL7® FHIR® Interoperability (`src/fhir/` and root `fhir/`)
- **`src/fhir/toFhir.ts`**: Emits complete FHIR R4 Bundle with Patient, Observation, and Condition resources.
- **`src/fhir/toFhirPerio.ts`**: Periodontal panel generator conforming to LOINC `74029-0`.
- **`src/fhir/fromFhir.ts`**: Parses incoming FHIR Bundles and hydrates native odontogram state.
- **`src/fhir/codesystems.ts`**: Terminology URIs (`https://odontogram.app/fhir/CodeSystem/odontogram`).
- **`root fhir/`**: Standard FHIR NPM Conformance Package (`odontogram.fhir`) containing `CodeSystem-odontogram.json` and 32 `ValueSet` definitions.

---

### 2.6 React Presentation Surfaces & Features (`src/surfaces/`, `src/features/`)
- **`src/surfaces/`**:
  - `OdontogramChartSurface.tsx`: Main interactive dental chart container.
  - `OdontogramTopbar.tsx`: Navigation bar, numbering switch, undo/redo, export trigger.
  - `ToothInfoSurface.tsx`: Active tooth summary and warning banner.
  - `ToothControlsSurface.tsx`: Right-side collapsible clinical card deck.
  - `cards/`: Individual clinical cards (`CariesCard`, `FillingsCard`, `ToothDetailsCard`, `StatusesCard`, `OrthodonticsCard`, `RootPeriodontiumCard`, `DiagnosesCard`, `SurfaceCross`).
  - `useEngineState.ts`: Custom hook syncing React component renders with engine mutations.
- **`src/features/perio/`**:
  - `PerioChart.tsx`: Full-mouth 6-site graphical periodontal examination grid.
  - `PerioSidebar.tsx`: Dedicated periodontal sidebar (patient info, 2017 staging, clinical summary).
  - `perioGraphic.ts`: Pure geometric calculation of CEJ curves, probing depths, and millimeter grids.
  - `perioExport.ts`: Standalone vector SVG export for periodontal charts.
  - `perioPdf.ts`: Pure jsPDF vector report generator.
- **`src/features/settings/`**: Modular tabs for the settings modal (`CariesTab`, `FillingsTab`, `OdontogramTab`, `PeriodontalTab`, `ToothDetailsTab`, `ExportTab`).

---

### 2.7 Anatomy Profiles (`src/anatomy/`, `src/assets/teeth-svgs/`)
- **`src/anatomy/profiles.ts`**: Contract for tooth anatomy shapes and registration points. Default `classic` profile.
- **`src/anatomy/measured.ts`**: Measured anatomy profile artwork chunk (~3.6 MB), dynamically loaded on demand via `ensureMeasuredProfile()`.
- **`src/assets/teeth-svgs/`**: 32 standalone SVG templates for teeth 11 to 48.

---

### 2.8 Internationalization & Accessibility (`src/i18n/`, `src/hooks/`)
- **`src/i18n/locales/en.ts`**: English master dictionary. Bundled statically.
- **`src/i18n/locales/uk.ts`**: Ukrainian dictionary. Code-split and loaded asynchronously on demand via `loader.ts`.
- **`src/i18n/useI18n.ts`**: React hook exposing synchronous translator function `t()`.
- **`src/hooks/useDialogFocus.ts`**: Traps keyboard focus within active modal dialogs (WCAG 2.1 requirement).

---

## 3. Quick Subsystem Lookup ("Where do I find...?")

| To inspect or change... | Look in this directory / file |
|---|---|
| Tooth selection logic | `src/engine/selection.ts` & `src/engine/controls/selectionControls.ts` |
| Status vs Plan gating | `src/engine/dualStateGate.ts` & `src/DualStateConfirm.tsx` |
| Caries ICDAS/CARS rules | `src/state/payload.ts` & `src/engine/cariesMutations.ts` |
| Periodontal 2017 Staging | `src/perioClassification.ts` & `src/features/perio/sidebar/` |
| FHIR export/import | `src/fhir/toFhir.ts`, `fromFhir.ts`, `toFhirPerio.ts` |
| PDF report layout | `src/features/perio/pdf/assemblePdf.ts` & `src/perioPdf.ts` |
| Multi-tooth bridge drawing | `src/bridgeOverlay.ts` & `src/features/bridge/` |
| Clinical card UI rendering | `src/surfaces/cards/` |
| Keyboard navigation rules | `src/engine/navigation/tileNavigation.ts` |
| Adding a new clinical finding | `src/registry/axes.ts` & `src/state/payload.ts` |
| Public API re-exports | `src/odontogram.ts` |
| End-to-end user tests | `e2e/clinical-workflows.spec.ts` |
