# Testing Strategy & Quality Assurance — Advanced Odontogram

## 1. Test Architecture Overview

The test infrastructure protects clinical safety, rendering fidelity, standards interoperability, and architectural boundaries across two primary test runners:
- **Vitest (4.1+)**: High-speed in-memory unit, integration, parity, and regression tests.
- **Playwright**: Real-browser end-to-end (E2E) clinical workflow execution (Chromium, Firefox, WebKit).

---

## 2. Test Suite Organization

```text
src/__tests__/
├── core/             # Core engine, selection filters, tile navigation, plugin multi-root rendering
├── caries/           # Caries state machine, ICDAS/CARS severity gradations, surface crosses
├── surfaces/         # Surface notation, restoration layers, defect findings
├── diagnosis/        # Diagnostic classifications (ICD-10, BNO-10, ICD-10-CM, SNOMED CT)
├── perio/            # Periodontal probing grid, indices (PI, GI, KG, GT, Miller), CAL, 2017 staging
├── fhir/             # HL7 FHIR R4 Bundle serialization, LOINC 74029-0 observation panels, Condition mapping
├── plan-review/      # Dual-state gate (DS-1), Status vs Plan diff generation, propagation
├── ui/               # Composable UI surfaces, modal dialogs, accessibility (WCAG), theme
├── i18n/             # Internationalization, on-demand locale chunk loading (en, uk)
├── pdf-export/       # Vector PDF generation, SVG rasterization, standalone perio exports
├── plugin/           # Plugin overlay rendering, HTML/SVG sanitization, custom state isolation
├── persistence/      # LocalStorage session settings persistence
├── tour/             # Interactive user onboarding tour
├── sprint/           # Historical regression tests protecting fixed clinical defects
└── parity/           # Golden fixture verification
    ├── api-surface.test.ts      # Verifies exactly 349 frozen public exports
    ├── import-cycles.test.ts    # Guarantees 0 circular runtime dependencies
    └── parity.test.ts           # Compares SVG rendered fingerprints against golden baseline
e2e/                  # Playwright browser end-to-end clinical workflow suites
```

---

## 3. Parity & Golden Fixture Protection

The repository maintains four authoritative "golden" reference fixtures under `src/__tests__/parity/`:
1. **`api-surface-golden.json`**:
   - Freezes the public API contract at **exactly 349 exports**.
   - Ensures internal refactoring does not accidentally add or drop exported symbols.
2. **`svg-fingerprints.json`**:
   - Contains serialized structural fingerprints of rendered tooth SVGs across test cases.
   - Evaluates element tags, IDs, opacity attributes, and CSS class lists.
   - Prevents unintended SVG regressions during painter or profile refactoring.
3. **`fhir-golden.json`**:
   - Validates generated HL7 FHIR R4 bundles against known clinical reference cases.
4. **`roundtrip-golden.json`**:
   - Verifies that serializing a clinical state to JSON and hydrating it back produces byte-identical domain state.

### Procedure for Intentionally Updating Golden Fixtures
If a new clinical feature intentionally changes SVG rendering, FHIR representation, or public API exports:
1. Obtain clinical approval for the semantic change.
2. Run the affected test with the update flag (e.g. `UPDATE_GOLDEN=1 npx vitest run src/__tests__/parity/parity.test.ts`).
3. Inspect git/file diffs to verify that **only** the intended delta was introduced.
4. Document the rationale in the pull request or task report.

---

## 4. Verification Commands

Run all verification gates locally using these commands:

```bash
# 1. TypeScript Static Typecheck
npx tsc -b --noEmit

# 2. ESLint Static Code Analysis
npm run lint

# 3. Check for Runtime Import Cycles (Must be 0)
npx vitest run src/__tests__/core/import-cycles.test.ts

# 4. Check Public API Surface Parity (Must be exactly 349 exports)
npx vitest run src/__tests__/parity/api-surface.test.ts

# 5. Check SVG Golden Fingerprints
npx vitest run src/__tests__/parity/parity.test.ts

# 6. Run Complete Vitest Suite (with adequate heap memory)
node --max-old-space-size=4096 ./node_modules/vitest/vitest.mjs run

# 7. Run Playwright End-to-End Browser Tests
npx playwright test --workers=2

# 8. Build Production Application Bundle
npm run build
```

---

## 5. Verified Baselines & Metrics

| Verification Gate | Expected Baseline | Verification Status |
|---|---|---|
| **TypeScript Typecheck** | 0 errors | **PASS** |
| **ESLint Analysis** | 0 errors | **PASS** |
| **Public API Surface** | Exactly 349 exports | **PASS** |
| **Circular Dependencies** | 0 cycles | **PASS** |
| **Vitest Tests** | 2,607 passed, 2 skipped | **PASS** |
| **Playwright Tests** | 14 passed (100%) | **PASS** |
| **Production Build** | Clean Vite build (`dist/`) | **PASS** |

> [!NOTE]
> The two skipped Vitest tests are intentional legacy platform mocks skipped under jsdom environments.
