// Browser-level End-to-End Regression Suite — Clinical Workflows (Chromium)
//
// Verifies real user clinical workflows through the live UI:
//   Scenario A — Tooth selection and control synchronization
//   Scenario B — Status vs Plan chart mode isolation and preservation
//   Scenario C — Clinical warning presentation lifecycle
//   Scenario D — Deferred dual-state divergence confirmation dialog
//   Scenario E — Dentition presets (Primary, Mixed, and mouth reset)
//   Scenario F — Restorative presets (fixed bridge span workflow)
//   Scenario G — 6-site periodontal pocket depth and probing measurements
//   Scenario H — SVG presentation layer persistence and cleanup

import { test, expect } from "@playwright/test";
import { openChart } from "./helpers";

test.describe("Clinical End-to-End Workflows", () => {
  test.beforeEach(async ({ page }) => {
    await openChart(page);
  });

  // =========================================================================
  // Scenario A — Tooth Selection & Control Synchronization
  // =========================================================================
  test("Scenario A: tooth selection — single switch, multi-select, clear selection, and controls sync", async ({ page }) => {
    const tile11 = page.locator('#toothGrid .tooth-tile.side-view[data-tooth="11"]');
    const tile21 = page.locator('#toothGrid .tooth-tile.side-view[data-tooth="21"]');
    const tile22 = page.locator('#toothGrid .tooth-tile.side-view[data-tooth="22"]');
    const activeLabel = page.locator("#activeToothLabel");
    const toothSelect = page.locator("#toothSelect");

    // 1. Initial unselected state ("—" em-dash represents none in active tooth pill)
    await expect(activeLabel).toHaveText("—");
    await expect(toothSelect).toBeDisabled();

    // 2. Select tooth 11
    await tile11.click();
    await expect(activeLabel).toHaveText("11");
    await expect(tile11).toHaveClass(/active/);
    await expect(tile11).toHaveAttribute("aria-selected", "true");
    await expect(toothSelect).toBeEnabled();
    await expect(toothSelect).toHaveValue("tooth-base");

    // 3. Switch to tooth 21
    await tile21.click();
    await expect(activeLabel).toHaveText("21");
    await expect(tile21).toHaveClass(/active/);
    await expect(tile11).not.toHaveClass(/active/);
    await expect(tile11).toHaveAttribute("aria-selected", "false");
    await expect(toothSelect).toBeEnabled();

    // 4. Modifier multi-selection (Control + Click on tooth 22)
    await tile22.click({ modifiers: ["Control"] });
    await expect(activeLabel).toHaveText(/2 teeth/i);
    await expect(tile21).toHaveClass(/active/);
    await expect(tile22).toHaveClass(/active/);

    // 5. Arch-level multi-selection (Upper arch)
    await page.locator("#btnSelectUpper").click();
    await expect(activeLabel).toHaveText(/16 teeth/i);
    await expect(tile11).toHaveClass(/active/);
    await expect(tile21).toHaveClass(/active/);
    await expect(tile22).toHaveClass(/active/);

    // 6. Clear selection via panel button
    await page.locator("#btnSelectNone").click();
    await expect(activeLabel).toHaveText("—");
    await expect(page.locator("#toothGrid .tooth-tile.side-view.active")).toHaveCount(0);
    await expect(toothSelect).toBeDisabled();
  });

  // =========================================================================
  // Scenario B — Status/Plan Switching & Chart State Isolation
  // =========================================================================
  test("Scenario B: status/plan switching — independent findings, mode badge, and chart restoration", async ({ page }) => {
    const tile11 = page.locator('#toothGrid .tooth-tile.side-view[data-tooth="11"]');
    const tile21 = page.locator('#toothGrid .tooth-tile.side-view[data-tooth="21"]');
    const statusBtn = page.locator("#chartModeStatus");
    const planBtn = page.locator("#chartModePlan");
    const planBadge = page.locator("#chartModePlanBadge");
    const chartCard = page.locator("section.chart");
    const proposedLegend = page.locator("#proposedLegend");
    const toothSelect = page.locator("#toothSelect");
    const crownNeeded = page.locator("#crownNeeded");
    const crownNeededRow = page.locator("#crownNeededRow");

    // 1. Initial Status mode baseline
    await expect(statusBtn).toHaveAttribute("aria-selected", "true");
    await expect(planBtn).toHaveAttribute("aria-selected", "false");
    await expect(planBadge).toHaveClass(/hidden/);
    await expect(chartCard).not.toHaveClass(/plan-mode/);

    // 2. Select tooth 11 in Status mode
    await tile11.click();
    await expect(toothSelect).toHaveValue("tooth-base");
    await expect(crownNeeded).not.toBeChecked();

    // 3. Switch to Plan mode
    await planBtn.click();
    await expect(planBtn).toHaveAttribute("aria-selected", "true");
    await expect(statusBtn).toHaveAttribute("aria-selected", "false");
    await expect(planBadge).not.toHaveClass(/hidden/);
    await expect(chartCard).toHaveClass(/plan-mode/);
    await expect(proposedLegend).toBeVisible();

    // 4. Create Plan-specific additions on tooth 11 and tooth 21
    await crownNeededRow.click();
    await expect(crownNeeded).toBeChecked();

    await tile21.click();
    await toothSelect.selectOption("implant");
    await expect(toothSelect).toHaveValue("implant");

    // 5. Switch back to Status mode — verify Status remains pristine
    await statusBtn.click();
    await expect(chartCard).not.toHaveClass(/plan-mode/);
    await expect(planBadge).toHaveClass(/hidden/);

    // Check tooth 21 in Status mode: must still be natural tooth-base, NOT implant!
    await tile21.click();
    await expect(toothSelect).toHaveValue("tooth-base");

    // Check tooth 11 in Status mode: crownNeeded must be unchecked!
    await tile11.click();
    await expect(crownNeeded).not.toBeChecked();

    // 6. Switch back to Plan mode — verify Plan findings are faithfully restored
    await planBtn.click();
    await expect(chartCard).toHaveClass(/plan-mode/);

    await tile11.click();
    await expect(crownNeeded).toBeChecked();

    await tile21.click();
    await expect(toothSelect).toHaveValue("implant");
  });

  // =========================================================================
  // Scenario C — Clinical Warning Presentation
  // =========================================================================
  test("Scenario C: clinical warnings — active-tooth warning lifecycle, Plan resolution, and selection clearing", async ({ page }) => {
    const tile11 = page.locator('#toothGrid .tooth-tile.side-view[data-tooth="11"]');
    const tile21 = page.locator('#toothGrid .tooth-tile.side-view[data-tooth="21"]');
    const warnings = page.locator("#warnings");
    const warningItems = page.locator("#warnings .warning-item");
    const toothSelect = page.locator("#toothSelect");
    const statusBtn = page.locator("#chartModeStatus");
    const planBtn = page.locator("#chartModePlan");

    // 1. Initial sound tooth: no warnings
    await tile11.click();
    await expect(warningItems).toHaveCount(0);

    // 2. Import clinical record with inconsistency on tooth 11 (root treatment on missing tooth)
    await page.locator("#statusImportInput").setInputFiles({
      name: "clinical-case.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          version: "1.0",
          teeth: {
            "11": { toothSelection: "none", endo: "endo-filling" },
          },
        })
      ),
    });

    // 3. Select tooth 11: warning is presented for active tooth
    await tile11.click();
    await expect(warningItems).toHaveCount(1);
    await expect(warnings).toContainText("Root treatment not possible on missing/implant tooth");

    // 4. Switch to Plan mode and resolve the inconsistency in Plan
    await planBtn.click();
    await expect(warnings).toContainText("Root treatment not possible on missing/implant tooth");

    // Resolve in Plan: restore tooth presence
    await toothSelect.selectOption("tooth-base");
    // Warning disappears in Plan mode!
    await expect(warningItems).toHaveCount(0);

    // 5. Switch back to Status mode — Status warning is restored
    await statusBtn.click();
    await expect(warningItems).toHaveCount(1);
    await expect(warnings).toContainText("Root treatment not possible on missing/implant tooth");

    // 6. Painting/selecting another sound tooth does not carry tooth 11's warning
    await tile21.click();
    await expect(warningItems).toHaveCount(0);

    // Returning to tooth 11 restores tooth 11's warning
    await tile11.click();
    await expect(warningItems).toHaveCount(1);
    await expect(warnings).toContainText("Root treatment not possible on missing/implant tooth");

    // 7. Clearing tooth selection clears the warning panel
    await page.locator("#btnSelectNone").click();
    await expect(warningItems).toHaveCount(0);
    await expect(warnings).toBeEmpty();
  });

  // =========================================================================
  // Scenario D — Deferred Confirmation
  // =========================================================================
  test("Scenario D: dual-state confirmation — modal appearance, cancel preservation, and accept commitment", async ({ page }) => {
    const tile11 = page.locator('#toothGrid .tooth-tile.side-view[data-tooth="11"]');
    const statusBtn = page.locator("#chartModeStatus");
    const planBtn = page.locator("#chartModePlan");
    const extractionPlan = page.locator("#extractionPlan");
    const extractionPlanRow = page.locator("#extractionPlanRow");
    const confirmModal = page.locator("#dualStateConfirm");
    const confirmMessage = page.locator("#dualStateConfirm .odon-confirm-message");
    const btnCancel = page.locator("#dualStateConfirm .odon-confirm-cancel");
    const btnAccept = page.locator("#dualStateConfirm .odon-confirm-accept");

    // 1. Initialize Plan mode and mark tooth 11 as planned
    await planBtn.click();
    await tile11.click();
    await extractionPlanRow.click();
    await expect(extractionPlan).toBeChecked();

    // 2. Switch back to Status mode where extractionPlan is still unchecked
    await statusBtn.click();
    await tile11.click();
    await expect(extractionPlan).not.toBeChecked();
    await expect(confirmModal).not.toBeVisible();

    // 3. Attempt divergent edit on tooth 11 in Status mode
    await extractionPlanRow.click();

    // 4. Modal must be presented before mutation occurs
    await expect(confirmModal).toBeVisible();
    await expect(confirmMessage).toContainText("You have already planned changes for this tooth");

    // 5. Test Cancel path: state remains untouched, modal closes
    await btnCancel.click();
    await expect(confirmModal).not.toBeVisible();
    await expect(extractionPlan).not.toBeChecked();

    // 6. Attempt divergent edit again and Accept
    await extractionPlanRow.click();
    await expect(confirmModal).toBeVisible();

    await btnAccept.click();
    await expect(confirmModal).not.toBeVisible();
    // Change is now committed to Status mode
    await expect(extractionPlan).toBeChecked();
  });

  // =========================================================================
  // Scenario E — Dentition Presets
  // =========================================================================
  test("Scenario E: dentition presets — Primary, Mixed, and Full Reset representative tooth verification", async ({ page }) => {
    const tile11 = page.locator('#toothGrid .tooth-tile.side-view[data-tooth="11"]');
    const tile13 = page.locator('#toothGrid .tooth-tile.side-view[data-tooth="13"]');
    const tile18 = page.locator('#toothGrid .tooth-tile.side-view[data-tooth="18"]');
    const toothSelect = page.locator("#toothSelect");

    // 1. Primary Dentition preset
    await page.locator("#btnPrimaryDentition").click();

    // Tooth 11 (deciduous central incisor in primary dentition) -> milktooth
    await tile11.click();
    await expect(toothSelect).toHaveValue("milktooth");

    // Tooth 18 (wisdom tooth, absent in primary dentition) -> none
    await tile18.click();
    await expect(toothSelect).toHaveValue("none");

    // 2. Mixed Dentition preset
    await page.locator("#btnMixedDentition").click();

    // Tooth 11 (permanent central incisor) -> tooth-base
    await tile11.click();
    await expect(toothSelect).toHaveValue("tooth-base");

    // Tooth 13 (deciduous canine position in mixed dentition) -> milktooth
    await tile13.click();
    await expect(toothSelect).toHaveValue("milktooth");

    // Tooth 18 (third molar, un-erupted in mixed dentition) -> none
    await tile18.click();
    await expect(toothSelect).toHaveValue("none");

    // 3. Full mouth reset
    await page.locator("#btnResetAll").click();

    await tile13.click();
    await expect(toothSelect).toHaveValue("tooth-base");

    await tile18.click();
    await expect(toothSelect).toHaveValue("tooth-base");
  });

  // =========================================================================
  // Scenario F — Restoration Presets
  // =========================================================================
  test("Scenario F: restorative presets — fixed span bridge preset application and Status/Plan fidelity", async ({ page }) => {
    const tile11 = page.locator('#toothGrid .tooth-tile.side-view[data-tooth="11"]');
    const tile21 = page.locator('#toothGrid .tooth-tile.side-view[data-tooth="21"]');
    const restorationSelect = page.locator("#restorationSelect");
    const bridgePillar = page.locator("#bridgePillar");
    const statusBtn = page.locator("#chartModeStatus");
    const planBtn = page.locator("#chartModePlan");

    // 1. Apply upper 12-22 zircon span bridge preset from the Status Extras dropdown
    await page.locator("#statusExtraSelect").selectOption("upper-12-22-zircon");
    await page.locator("#statusExtraApply").click();

    // 2. Verify tooth 11 restorative state
    await tile11.click();
    await expect(restorationSelect).toHaveValue("crown|zircon");
    await expect(bridgePillar).toBeChecked();

    // Verify side-view SVG has active crown layer
    const svgCrown11 = tile11.locator('svg [id="zircon-crown"]');
    await expect(svgCrown11).toHaveAttribute("data-active", "1");

    // 3. Verify tooth 21 restorative state
    await tile21.click();
    await expect(restorationSelect).toHaveValue("crown|zircon");
    await expect(bridgePillar).toBeChecked();
    const svgCrown21 = tile21.locator('svg [id="zircon-crown"]');
    await expect(svgCrown21).toHaveAttribute("data-active", "1");

    // 4. Verify cross-mode Status / Plan preservation
    await planBtn.click();
    await tile11.click();
    await expect(restorationSelect).toHaveValue("crown|zircon");
    await expect(svgCrown11).toHaveAttribute("data-active", "1");

    await statusBtn.click();
    await tile11.click();
    await expect(restorationSelect).toHaveValue("crown|zircon");
    await expect(svgCrown11).toHaveAttribute("data-active", "1");
  });

  // =========================================================================
  // Scenario G — Periodontal Measurements
  // =========================================================================
  test("Scenario G: periodontal probing grid — PD/GM input, BOP toggle, CAL calculation, and persistence", async ({ page }) => {
    const tile11 = page.locator('#toothGrid .tooth-tile.side-view[data-tooth="11"]');
    const tile21 = page.locator('#toothGrid .tooth-tile.side-view[data-tooth="21"]');
    const perioPdB = page.locator("#perio-pd-B");
    const perioGmB = page.locator("#perio-gm-B");
    const perioBopB = page.locator("#perio-bop-B");
    const perioReadout = page.locator("#perioReadout");

    await tile11.click();

    // 1. Initial state: uncharted site has disabled GM and BOP, and empty readout
    await expect(perioPdB).toHaveValue("");
    await expect(perioGmB).toBeDisabled();
    await expect(perioBopB).toBeDisabled();
    await expect(perioReadout).toHaveText("No sites charted");

    // 2. Chart Pocket Depth at Buccal site (B)
    await perioPdB.fill("5");
    await perioPdB.dispatchEvent("change");

    // Now GM and BOP are enabled for this charted site
    await expect(perioGmB).toBeEnabled();
    await expect(perioBopB).toBeEnabled();

    // 3. Enter Gingival Margin (GM) and toggle Bleeding on Probing (BOP)
    await perioGmB.fill("-2");
    await perioGmB.dispatchEvent("change");

    await perioBopB.check();
    await perioBopB.dispatchEvent("change");

    // 4. Verify derived CAL (CAL = PD + GM = 5 + (-2) = 3) and BOP% readout
    await expect(perioReadout).toContainText("B CAL 3");
    await expect(perioReadout).toContainText("BOP% 100%");

    // 5. Switch to tooth 21: verify tooth 21 has clean/uncharted perio values
    await tile21.click();
    await expect(perioPdB).toHaveValue("");
    await expect(perioGmB).toBeDisabled();
    await expect(perioBopB).toBeDisabled();
    await expect(perioReadout).toHaveText("No sites charted");

    // 6. Switch back to tooth 11: verify values and calculated readout persisted
    await tile11.click();
    await expect(perioPdB).toHaveValue("5");
    await expect(perioGmB).toHaveValue("-2");
    await expect(perioBopB).toBeChecked();
    await expect(perioReadout).toContainText("B CAL 3");
    await expect(perioReadout).toContainText("BOP% 100%");
  });

  // =========================================================================
  // Scenario H — SVG Layer Lifecycle & Persistence
  // =========================================================================
  test("Scenario H: SVG persistence — sound → restoration → endo → sound lifecycle without stale layers", async ({ page }) => {
    const tile11 = page.locator('#toothGrid .tooth-tile.side-view[data-tooth="11"]');
    const svg11 = tile11.locator("svg");
    const baseLayer = svg11.locator('[id="tooth-base"]');
    const crownLayer = svg11.locator('[id="zircon-crown"]');
    const restorationSelect = page.locator("#restorationSelect");
    const pulpEndoSelect = page.locator("#pulpEndoSelect");
    const btnResetTooth = page.locator("#btnResetTooth");

    // 1. Initial sound tooth: base active, restoration inactive, no proposed styling
    await tile11.click();
    await expect(baseLayer).toHaveAttribute("data-active", "1");
    await expect(crownLayer).toHaveAttribute("data-active", "0");
    await expect(svg11.locator('[data-proposed="1"]')).toHaveCount(0);

    // 2. Clinical finding: Zirconia crown
    await restorationSelect.selectOption("crown|zircon");
    await expect(crownLayer).toHaveAttribute("data-active", "1");

    // 3. Transition to different finding: remove crown, apply endo filling
    await restorationSelect.selectOption("none|none");
    await pulpEndoSelect.selectOption("endo-filling");

    // Crown layer must be deactivated (no stale restoration layer)
    await expect(crownLayer).toHaveAttribute("data-active", "0");
    // Endo filling group must be active
    const endoLayer = svg11.locator('[id="endo-filling"]');
    await expect(endoLayer).toHaveAttribute("data-active", "1");

    // 4. Return to sound tooth via Reset Tooth action
    await btnResetTooth.click();

    // Verify all active pathological/restorative layers are deactivated
    await expect(crownLayer).toHaveAttribute("data-active", "0");
    await expect(endoLayer).toHaveAttribute("data-active", "0");
    await expect(baseLayer).toHaveAttribute("data-active", "1");
    // No stale proposed markers remain on the visible SVG
    await expect(svg11.locator('[data-proposed="1"]')).toHaveCount(0);
  });
});
