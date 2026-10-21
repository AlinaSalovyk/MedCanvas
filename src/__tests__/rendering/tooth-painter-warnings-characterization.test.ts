// Tests for SVG tooth painter DOM side effects and active-tooth warning presentation:
//
// 1. Decoupled warning presentation: #warnings belongs to the orchestrator and reflects
//    the active tooth and active chart, not SVG painting passes.
// 2. Plan mode isolation: detached Status clone painting in applyProposedStyling never
//    mutates or overwrites the live #warnings DOM element.
// 3. Graceful degradation when the #warnings DOM element is absent.
// 4. Prevention of cross-tooth interference: rendering unrelated teeth or full-mouth
//    loops does not overwrite the active tooth's warnings.
// 5. Selection lifecycle: clearing selection clears warnings; multiple selection uses
//    only the current active tooth.
// 6. Transaction safety: deferred confirm Cancel preserves prior warnings; Accept updates warnings.
// 7. Surface remount and localization: rewireControls restores warnings; locale changes update text.
//
// NOTE: Stage 19 characterized the legacy bug where SVG painting side effects wrote to #warnings.
// In Stage 22, these expectations are deliberately updated to verify the corrected,
// orchestrator-owned active-tooth warning presentation.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";
import {
  __resetChartStateForTest,
  __setToothStateForTest,
  __parseSvgForTest,
  __renderActiveLayersOnNode,
  __applyProposedStylingForTest,
  setChartMode,
  __getStateWarnings,
  __setActiveToothForTest,
  __setSelectionForTest,
  clearSelection,
  initOdontogram,
  destroyOdontogram,
  rewireControls,
  isDualStateConfirmPending,
  acceptDualStateConfirm,
  cancelDualStateConfirm,
} from "../../odontogram";
import { requestDualStateConfirm } from "../../engine/dualStateGate";
import { hydrateState } from "../../state/payload";
import { setI18nLanguage, t } from "../../i18n/useI18n";

const svg11 = readFileSync(fileURLToPath(new NodeURL("../../assets/teeth-svgs/11.svg", import.meta.url)), "utf8");
const svg14 = readFileSync(fileURLToPath(new NodeURL("../../assets/teeth-svgs/14.svg", import.meta.url)), "utf8");
const svg14Occl = readFileSync(fileURLToPath(new NodeURL("../../assets/teeth-svgs/14_occl.svg", import.meta.url)), "utf8");

// Valid clinical states that survive hydrateState() validation:
const SOUND_STATE = { toothSelection: "tooth-base" };
const MISSING_ENDO_STATE = { toothSelection: "none", endo: "endo-filling" };
const CROWN_REPLACE_NO_CROWN_STATE = { toothSelection: "tooth-base", crownReplace: true, restorationType: "none" };
const MULTI_WARN_STATE = { toothSelection: "none", endo: "endo-filling", caries: ["caries-occlusal"] };
const CROWN_STATE = { toothSelection: "tooth-base", restorationType: "crown", restorationMaterial: "zircon" };

beforeEach(() => {
  setI18nLanguage("en");
  __resetChartStateForTest();
  document.body.innerHTML = "";
});

afterEach(() => {
  __resetChartStateForTest();
  document.body.innerHTML = "";
  setI18nLanguage("en");
});

describe("SVG Tooth Painter: Warning DOM Side Effects and Active-Tooth Scoping", () => {
  describe("Suite A: Status Mode #warnings Presentation for Active Tooth", () => {
    it("A1: active tooth presents clinical warnings in #warnings, and node rendering preserves active tooth warnings", () => {
      document.body.innerHTML = '<div id="warnings" class="warnings"></div>';
      const warningsEl = document.getElementById("warnings")!;

      // Confirm expected warning from pure calculator on hydrated state
      const expectedWarnings = __getStateWarnings(hydrateState(MISSING_ENDO_STATE));
      expect(expectedWarnings).toContain(t("warn.endoOnMissing"));

      __setActiveToothForTest(11);
      __setToothStateForTest(11, MISSING_ENDO_STATE);

      const items = warningsEl.querySelectorAll(".warning-item");
      expect(items.length).toBe(1);
      expect(items[0]?.textContent).toBe("⚠ " + t("warn.endoOnMissing"));

      // Decoupled SVG painting does not alter or corrupt the active tooth's warning presentation:
      const node = __parseSvgForTest(svg11);
      __renderActiveLayersOnNode(node, 11, MISSING_ENDO_STATE);
      expect(warningsEl.querySelectorAll(".warning-item").length).toBe(1);
      expect(warningsEl.textContent).toContain(t("warn.endoOnMissing"));
    });

    it("A2: clears existing warning elements when active tooth transitions to a non-warning state", () => {
      document.body.innerHTML = '<div id="warnings" class="warnings"></div>';
      const warningsEl = document.getElementById("warnings")!;

      __setActiveToothForTest(11);
      // First state: warning state
      __setToothStateForTest(11, MISSING_ENDO_STATE);
      expect(warningsEl.querySelectorAll(".warning-item").length).toBe(1);

      // Second state: sound state (no warnings)
      __setToothStateForTest(11, SOUND_STATE);
      expect(warningsEl.querySelectorAll(".warning-item").length).toBe(0);
      expect(warningsEl.innerHTML).toBe("");
    });

    it("A3: renders multiple distinct warning items when active tooth state triggers multiple clinical checks", () => {
      document.body.innerHTML = '<div id="warnings" class="warnings"></div>';
      const warningsEl = document.getElementById("warnings")!;

      const expected = __getStateWarnings(hydrateState(MULTI_WARN_STATE));
      expect(expected).toContain(t("warn.endoOnMissing"));
      expect(expected).toContain(t("warn.cariesOnMissing"));
      expect(expected.length).toBe(2);

      __setActiveToothForTest(11);
      __setToothStateForTest(11, MULTI_WARN_STATE);

      const items = warningsEl.querySelectorAll(".warning-item");
      expect(items.length).toBe(2);
      const texts = Array.from(items).map((el) => el.textContent);
      expect(texts).toContain("⚠ " + t("warn.endoOnMissing"));
      expect(texts).toContain("⚠ " + t("warn.cariesOnMissing"));
    });
  });

  describe("Suite B: Plan Mode With Detached Status Clone (Separation Verified)", () => {
    it("B1: Plan warnings on active tooth remain visible after detached Status-clone painting", () => {
      document.body.innerHTML = '<div id="warnings" class="warnings"></div>';
      const warningsEl = document.getElementById("warnings")!;

      // 1. Status chart has SOUND state (0 warnings)
      __setActiveToothForTest(11);
      __setToothStateForTest(11, SOUND_STATE);
      expect(__getStateWarnings(hydrateState(SOUND_STATE))).toEqual([]);

      // 2. Initialize Plan mode
      setChartMode("plan");

      // 3. Plan chart has a warning state (crownReplace flag with no crown)
      __setToothStateForTest(11, CROWN_REPLACE_NO_CROWN_STATE);
      const planWarnings = __getStateWarnings(hydrateState(CROWN_REPLACE_NO_CROWN_STATE));
      expect(planWarnings).toContain(t("warn.crownReplaceNoCrown"));

      // Active tooth warning panel reflects the Plan warning:
      expect(warningsEl.querySelectorAll(".warning-item").length).toBe(1);
      expect(warningsEl.textContent).toContain(t("warn.crownReplaceNoCrown"));

      // 4. Paint live SVG node with Plan state and run proposed styling (which paints detached Status clone)
      const node = __parseSvgForTest(svg11);
      __renderActiveLayersOnNode(node, 11, CROWN_REPLACE_NO_CROWN_STATE);
      __applyProposedStylingForTest(11, node);

      // CORRECTED BEHAVIOR (Stage 22):
      // The detached Status-clone render NO LONGER overwrites #warnings with Status state!
      // The Plan warning remains visible in #warnings.
      expect(warningsEl.querySelectorAll(".warning-item").length).toBe(1);
      expect(warningsEl.textContent).toContain(t("warn.crownReplaceNoCrown"));
    });

    it("B2: old Status warning does not reappear in Plan mode, and reappears after switching back to Status", () => {
      document.body.innerHTML = '<div id="warnings" class="warnings"></div>';
      const warningsEl = document.getElementById("warnings")!;

      // 1. Status chart HAS a warning (endo on missing tooth)
      __setActiveToothForTest(11);
      __setToothStateForTest(11, MISSING_ENDO_STATE);
      expect(__getStateWarnings(hydrateState(MISSING_ENDO_STATE))).toContain(t("warn.endoOnMissing"));
      expect(warningsEl.querySelectorAll(".warning-item").length).toBe(1);

      // 2. Initialize Plan mode
      setChartMode("plan");

      // 3. Plan chart resolves the issue: tooth is now sound tooth-base (0 warnings)
      __setToothStateForTest(11, SOUND_STATE);
      expect(__getStateWarnings(hydrateState(SOUND_STATE))).toEqual([]);
      expect(warningsEl.querySelectorAll(".warning-item").length).toBe(0);

      // 4. Paint live node with Plan state and apply proposed styling
      const node = __parseSvgForTest(svg11);
      __renderActiveLayersOnNode(node, 11, SOUND_STATE);
      __applyProposedStylingForTest(11, node);

      // CORRECTED BEHAVIOR (Stage 22):
      // Detached Status clone painting does NOT resurrect the Status warning in Plan mode!
      expect(warningsEl.querySelectorAll(".warning-item").length).toBe(0);
      expect(warningsEl.innerHTML).toBe("");

      // 5. Switching back to Status mode restores the Status warning:
      setChartMode("status");
      expect(warningsEl.querySelectorAll(".warning-item").length).toBe(1);
      expect(warningsEl.textContent).toContain(t("warn.endoOnMissing"));
    });

    it("B3: detached clone is strictly temporary and is never inserted into the DOM", () => {
      document.body.innerHTML = '<div id="container"><div id="warnings"></div></div>';
      const container = document.getElementById("container")!;

      __setActiveToothForTest(11);
      __setToothStateForTest(11, SOUND_STATE);
      setChartMode("plan");
      __setToothStateForTest(11, CROWN_STATE);

      const node = __parseSvgForTest(svg11);
      container.appendChild(node);
      expect(container.querySelectorAll("svg").length).toBe(1);

      __renderActiveLayersOnNode(node, 11, CROWN_STATE);
      __applyProposedStylingForTest(11, node);

      // Only the single mounted SVG exists in the document; the clone was never inserted
      expect(container.querySelectorAll("svg").length).toBe(1);
      expect(container.contains(node)).toBe(true);
    });
  });

  describe("Suite C: Missing Warning Container Graceful Degradation", () => {
    it("C1: painting and state updates with a warning state when #warnings is absent do not throw", () => {
      document.body.innerHTML = "<div>No warnings container here</div>";
      expect(document.getElementById("warnings")).toBeNull();

      __setActiveToothForTest(11);
      expect(() => {
        __setToothStateForTest(11, MISSING_ENDO_STATE);
        const node = __parseSvgForTest(svg11);
        __renderActiveLayersOnNode(node, 11, MISSING_ENDO_STATE);
      }).not.toThrow();
    });

    it("C2: proposed styling in Plan mode when #warnings is absent does not throw", () => {
      document.body.innerHTML = "<div>No warnings container here</div>";
      __setActiveToothForTest(11);
      __setToothStateForTest(11, SOUND_STATE);
      setChartMode("plan");
      __setToothStateForTest(11, CROWN_STATE);

      const node = __parseSvgForTest(svg11);
      expect(() => {
        __renderActiveLayersOnNode(node, 11, CROWN_STATE);
        __applyProposedStylingForTest(11, node);
      }).not.toThrow();
    });
  });

  describe("Suite D: Active Tooth Scoping and Prevention of Repaint Interference", () => {
    it("D1: changing active tooth immediately updates warnings; painting unrelated teeth does not overwrite warnings", () => {
      document.body.innerHTML = '<div id="warnings" class="warnings"></div>';
      const warningsEl = document.getElementById("warnings")!;

      // Tooth 11 is active with endoOnMissing warning
      __setActiveToothForTest(11);
      __setToothStateForTest(11, MISSING_ENDO_STATE);
      expect(warningsEl.textContent).toContain(t("warn.endoOnMissing"));

      // Chart tooth 21 with crownReplaceNoCrown warning, and paint tooth 21 SVG
      __setToothStateForTest(21, CROWN_REPLACE_NO_CROWN_STATE);
      const node21 = __parseSvgForTest(svg11);
      __renderActiveLayersOnNode(node21, 21, CROWN_REPLACE_NO_CROWN_STATE);

      // CORRECTED BEHAVIOR (Stage 22):
      // Tooth 11 is the active tooth, so tooth 21's painting pass does NOT overwrite #warnings!
      expect(warningsEl.textContent).toContain(t("warn.endoOnMissing"));
      expect(warningsEl.textContent).not.toContain(t("warn.crownReplaceNoCrown"));

      // Changing the active tooth to 21 immediately updates warnings:
      __setActiveToothForTest(21);
      __setToothStateForTest(21, CROWN_REPLACE_NO_CROWN_STATE);
      expect(warningsEl.textContent).toContain(t("warn.crownReplaceNoCrown"));
      expect(warningsEl.textContent).not.toContain(t("warn.endoOnMissing"));

      // Transitioning active tooth 21 to sound state clears warnings:
      __setToothStateForTest(21, SOUND_STATE);
      expect(warningsEl.querySelectorAll(".warning-item").length).toBe(0);
    });

    it("D2: multi-tooth Plan rendering loop preserves active tooth's warnings without cross-tooth contamination", () => {
      document.body.innerHTML = '<div id="warnings" class="warnings"></div>';
      const warningsEl = document.getElementById("warnings")!;

      // Tooth 11: Status sound, Plan has warning
      __setToothStateForTest(11, SOUND_STATE);
      // Tooth 14: Status has warning, Plan sound
      __setToothStateForTest(14, MISSING_ENDO_STATE);

      setChartMode("plan");
      __setActiveToothForTest(11);
      __setToothStateForTest(11, CROWN_REPLACE_NO_CROWN_STATE);
      __setToothStateForTest(14, SOUND_STATE);

      expect(warningsEl.textContent).toContain(t("warn.crownReplaceNoCrown"));

      const node11 = __parseSvgForTest(svg11);
      const node14 = __parseSvgForTest(svg14);

      // 1. Render tooth 11
      __renderActiveLayersOnNode(node11, 11, CROWN_REPLACE_NO_CROWN_STATE);
      __applyProposedStylingForTest(11, node11);
      expect(warningsEl.textContent).toContain(t("warn.crownReplaceNoCrown"));

      // 2. Render tooth 14
      __renderActiveLayersOnNode(node14, 14, SOUND_STATE);
      __applyProposedStylingForTest(14, node14);

      // CORRECTED BEHAVIOR (Stage 22):
      // Painting tooth 14 did not overwrite or corrupt tooth 11's warnings!
      expect(warningsEl.textContent).toContain(t("warn.crownReplaceNoCrown"));
      expect(warningsEl.textContent).not.toContain(t("warn.endoOnMissing"));
    });
  });

  describe("Suite E: Multi-Root Simulation and View Isolation", () => {
    it("E1: two roots of the same tooth execute sequential paint + proposed styling passes identically", () => {
      document.body.innerHTML = '<div id="warnings" class="warnings"></div>';
      const warningsEl = document.getElementById("warnings")!;

      __setActiveToothForTest(14);
      __setToothStateForTest(14, SOUND_STATE);
      setChartMode("plan");
      __setToothStateForTest(14, CROWN_STATE); // Proposed crown (sound, 0 warnings)

      const buccalRoot = __parseSvgForTest(svg14);
      const occlusalRoot = __parseSvgForTest(svg14Occl);

      // Simulate roots loop for tooth 14:
      const roots = [buccalRoot, occlusalRoot];
      for (const root of roots) {
        __renderActiveLayersOnNode(root, 14, CROWN_STATE);
        __applyProposedStylingForTest(14, root);
      }

      // Both roots successfully receive proposed markings on their respective crown layers
      const buccalCrown = buccalRoot.querySelector("#zircon-crown");
      const occlCrown = occlusalRoot.querySelector("#zircon-crown");

      expect(buccalCrown?.getAttribute("data-proposed")).toBe("1");
      expect(occlCrown?.getAttribute("data-proposed")).toBe("1");
      expect(buccalCrown?.style.strokeDasharray).toBe("4 2");
      expect(occlCrown?.style.strokeDasharray).toBe("4 2");

      // Warnings panel remains clean (0 warnings on crown state):
      expect(warningsEl.innerHTML).toBe("");
    });

    it("E2: no cross-root attribute or style contamination occurs between independent SVG nodes", () => {
      const root1 = __parseSvgForTest(svg11);
      const root2 = __parseSvgForTest(svg11);

      // Render root1 with crown, root2 with sound
      __renderActiveLayersOnNode(root1, 11, CROWN_STATE);
      __renderActiveLayersOnNode(root2, 11, SOUND_STATE);

      expect(root1.querySelector("#zircon-crown")?.getAttribute("data-active")).toBe("1");
      expect(root2.querySelector("#zircon-crown")?.getAttribute("data-active")).toBe("0");
    });
  });

  describe("Suite F: SVG Style Gap Coverage and Reused Node Invariance", () => {
    it("F1: repeated Plan -> Status -> Plan transitions on the SAME node preserve base styles", () => {
      const node = __parseSvgForTest(svg11);

      // 1. Status mode (sound)
      __setToothStateForTest(11, SOUND_STATE);
      __renderActiveLayersOnNode(node, 11, SOUND_STATE);
      __applyProposedStylingForTest(11, node);

      // 2. Switch to Plan mode and propose a crown
      setChartMode("plan");
      __setToothStateForTest(11, CROWN_STATE);
      __renderActiveLayersOnNode(node, 11, CROWN_STATE);
      __applyProposedStylingForTest(11, node);

      const crownEl = node.querySelector("#zircon-crown") as SVGElement;
      expect(crownEl.getAttribute("data-proposed")).toBe("1");
      expect(crownEl.style.strokeDasharray).toBe("4 2");
      const baseDashCaptured = crownEl.getAttribute("data-base-dash");
      const baseStrokeCaptured = crownEl.getAttribute("data-base-pstroke");
      expect(baseDashCaptured).toBe("");
      expect(baseStrokeCaptured).toBe("rgb(27, 63, 28)");

      // 3. Switch back to Status mode and repaint sound
      setChartMode("status");
      __renderActiveLayersOnNode(node, 11, SOUND_STATE);
      __applyProposedStylingForTest(11, node);

      // Proposed styling must be cleared and base stroke restored
      expect(crownEl.getAttribute("data-proposed")).toBeNull();
      expect(crownEl.style.strokeDasharray).toBe("");
      expect(crownEl.style.stroke).toBe("rgb(27, 63, 28)");

      // 4. Switch back to Plan mode and propose crown again on the SAME node
      setChartMode("plan");
      __setToothStateForTest(11, CROWN_STATE);
      __renderActiveLayersOnNode(node, 11, CROWN_STATE);
      __applyProposedStylingForTest(11, node);

      // data-base-dash must NOT have captured "4 2" as the base style!
      expect(crownEl.getAttribute("data-proposed")).toBe("1");
      expect(crownEl.getAttribute("data-base-dash")).toBe("");
      expect(crownEl.getAttribute("data-base-pstroke")).toBe("rgb(27, 63, 28)");
      expect(crownEl.style.strokeDasharray).toBe("4 2");
    });

    it("F2: detached Status clone rendering does not mutate any attributes on the original live node", () => {
      __setToothStateForTest(11, SOUND_STATE);
      setChartMode("plan");
      __setToothStateForTest(11, CROWN_STATE);

      const node = __parseSvgForTest(svg11);
      __renderActiveLayersOnNode(node, 11, CROWN_STATE);

      // Snapshot non-crown elements on node before applyProposedStyling
      const baseElBefore = node.querySelector("#tooth-base");
      const baseActiveBefore = baseElBefore?.getAttribute("data-active");
      const baseFillBefore = baseElBefore?.style.fill;

      __applyProposedStylingForTest(11, node);

      const baseElAfter = node.querySelector("#tooth-base");
      expect(baseElAfter?.getAttribute("data-active")).toBe(baseActiveBefore);
      expect(baseElAfter?.style.fill).toBe(baseFillBefore);
      expect(baseElAfter?.getAttribute("data-proposed")).toBeNull();
    });

    it("F3: proposed styling clears and restores cleanly across sequential distinct clinical states", () => {
      __setToothStateForTest(11, SOUND_STATE);
      setChartMode("plan");
      __setToothStateForTest(11, CROWN_STATE);

      const node = __parseSvgForTest(svg11);
      __renderActiveLayersOnNode(node, 11, CROWN_STATE);
      __applyProposedStylingForTest(11, node);

      const crownEl = node.querySelector("#zircon-crown") as SVGElement;
      expect(crownEl.getAttribute("data-proposed")).toBe("1");

      // Transition to extraction socket in Plan
      const extractionState = { toothSelection: "no-tooth-after-extraction" };
      __setToothStateForTest(11, extractionState);
      __renderActiveLayersOnNode(node, 11, extractionState);
      __applyProposedStylingForTest(11, node);

      expect(crownEl.getAttribute("data-proposed")).toBeNull();
      expect(crownEl.getAttribute("data-active")).toBe("0");

      // Return to crown in Plan
      __setToothStateForTest(11, CROWN_STATE);
      __renderActiveLayersOnNode(node, 11, CROWN_STATE);
      __applyProposedStylingForTest(11, node);

      expect(crownEl.getAttribute("data-proposed")).toBe("1");
      expect(crownEl.style.strokeDasharray).toBe("4 2");
    });
  });

  describe("Suite G: Selection, Transaction Safety, Lifecycle, and Localization Integration", () => {
    it("G1: clearing selection clears warnings", () => {
      document.body.innerHTML = '<div id="warnings" class="warnings"></div>';
      const warningsEl = document.getElementById("warnings")!;

      __setSelectionForTest([11]);
      __setToothStateForTest(11, MISSING_ENDO_STATE);
      expect(warningsEl.querySelectorAll(".warning-item").length).toBe(1);

      clearSelection();
      expect(warningsEl.querySelectorAll(".warning-item").length).toBe(0);
      expect(warningsEl.innerHTML).toBe("");
    });

    it("G2: multiple selection uses only the active tooth (no whole-mouth aggregation)", () => {
      document.body.innerHTML = '<div id="warnings" class="warnings"></div>';
      const warningsEl = document.getElementById("warnings")!;

      __setToothStateForTest(11, MISSING_ENDO_STATE);
      __setToothStateForTest(12, CROWN_REPLACE_NO_CROWN_STATE);

      // Select [11, 12] with tooth 11 active
      __setSelectionForTest([11, 12]);
      __setActiveToothForTest(11);
      __setToothStateForTest(11, MISSING_ENDO_STATE);

      expect(warningsEl.textContent).toContain(t("warn.endoOnMissing"));
      expect(warningsEl.textContent).not.toContain(t("warn.crownReplaceNoCrown"));

      // Switch active tooth within selection to 12
      __setActiveToothForTest(12);
      __setToothStateForTest(12, CROWN_REPLACE_NO_CROWN_STATE);

      expect(warningsEl.textContent).toContain(t("warn.crownReplaceNoCrown"));
      expect(warningsEl.textContent).not.toContain(t("warn.endoOnMissing"));
    });

    it("G3: deferred confirmation Cancel preserves previous warnings, Accept refreshes committed warnings", () => {
      document.body.innerHTML = '<div id="warnings" class="warnings"></div>';
      const warningsEl = document.getElementById("warnings")!;

      __setActiveToothForTest(11);
      __setToothStateForTest(11, SOUND_STATE);
      expect(warningsEl.querySelectorAll(".warning-item").length).toBe(0);

      // 1. Candidate edit requests dual-state confirm
      let applied = false;
      let reverted = false;
      requestDualStateConfirm(
        () => {
          applied = true;
          __setToothStateForTest(11, MISSING_ENDO_STATE);
        },
        () => {
          reverted = true;
          __setToothStateForTest(11, SOUND_STATE);
        }
      );

      expect(isDualStateConfirmPending()).toBe(true);
      // While pending, warnings are not updated with candidate uncommitted state
      expect(warningsEl.querySelectorAll(".warning-item").length).toBe(0);

      // User cancels
      cancelDualStateConfirm();
      expect(reverted).toBe(true);
      expect(isDualStateConfirmPending()).toBe(false);
      expect(warningsEl.querySelectorAll(".warning-item").length).toBe(0);

      // 2. Second request, user accepts
      requestDualStateConfirm(
        () => {
          applied = true;
          __setToothStateForTest(11, MISSING_ENDO_STATE);
        },
        () => {
          reverted = true;
        }
      );
      acceptDualStateConfirm();
      expect(applied).toBe(true);
      expect(warningsEl.querySelectorAll(".warning-item").length).toBe(1);
      expect(warningsEl.textContent).toContain(t("warn.endoOnMissing"));
    });

    it("G4: controls-panel remount via rewireControls restores correct warning content", async () => {
      document.body.innerHTML = '<div id="warnings" class="warnings"></div>';
      const warningsEl = document.getElementById("warnings")!;

      await initOdontogram();
      try {
        __setActiveToothForTest(11);
        __setToothStateForTest(11, MISSING_ENDO_STATE);
        expect(warningsEl.querySelectorAll(".warning-item").length).toBe(1);

        // Simulate surface remount: #warnings container replaced by fresh DOM element
        warningsEl.innerHTML = "";
        expect(warningsEl.querySelectorAll(".warning-item").length).toBe(0);

        rewireControls();
        // rewireControls restores the active tooth's warning presentation
        expect(warningsEl.querySelectorAll(".warning-item").length).toBe(1);
        expect(warningsEl.textContent).toContain(t("warn.endoOnMissing"));
      } finally {
        destroyOdontogram();
      }
    });

    it("G5: localization refreshes displayed warning text", async () => {
      document.body.innerHTML = '<div id="warnings" class="warnings"></div>';
      const warningsEl = document.getElementById("warnings")!;

      __setActiveToothForTest(11);
      await setI18nLanguage("en");
      __setToothStateForTest(11, MISSING_ENDO_STATE);

      expect(warningsEl.textContent).toContain(t("warn.endoOnMissing"));
      const enText = warningsEl.textContent;

      // Switch language to Ukrainian
      await setI18nLanguage("uk");
      __setToothStateForTest(11, MISSING_ENDO_STATE);
      const ukText = warningsEl.textContent;

      expect(ukText).toContain(t("warn.endoOnMissing"));
      expect(ukText).not.toBe(enText);

      await setI18nLanguage("en");
    });

    it("G6: lifecycle management ensures proper subscription cleanup on destroy and no duplicate subscriptions on reinit", async () => {
      document.body.innerHTML = '<div id="warnings" class="warnings"></div>';
      const warningsEl = document.getElementById("warnings")!;

      await initOdontogram();
      __setActiveToothForTest(11);
      __setToothStateForTest(11, MISSING_ENDO_STATE);
      expect(warningsEl.querySelectorAll(".warning-item").length).toBe(1);

      destroyOdontogram();
      // destroyOdontogram clears warnings and unhooks
      expect(warningsEl.innerHTML).toBe("");

      // Reinitialization sets up single clean subscription
      await initOdontogram();
      __setActiveToothForTest(11);
      __setToothStateForTest(11, MISSING_ENDO_STATE);
      expect(warningsEl.querySelectorAll(".warning-item").length).toBe(1);

      destroyOdontogram();
      expect(warningsEl.innerHTML).toBe("");
    });
  });
});
