// Characterization tests for imperative SVG rendering symmetry and DOM coupling:
// Repeated rendering on a single persistent SVG node, full clinical transition symmetry,
// inflammationHome WeakMap DOM reparenting and restoration, showBase & showHealthyPulp
// configuration toggling, and proposed Plan strokeDasharray / stroke attribute assertions.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";
import {
  __parseSvgForTest,
  __renderActiveLayersOnNode,
  __applyProposedStylingForTest,
  __setToothStateForTest,
  __resetChartStateForTest,
  setShowBase,
  setHealthyPulpVisible,
  setChartMode,
} from "../../odontogram";

const svg11 = readFileSync(fileURLToPath(new NodeURL("../../assets/teeth-svgs/11.svg", import.meta.url)), "utf8");

beforeEach(() => {
  __resetChartStateForTest();
  setShowBase(true);
  setHealthyPulpVisible(true);
});

afterEach(() => {
  setShowBase(true);
  setHealthyPulpVisible(true);
  __resetChartStateForTest();
});

describe("SVG Rendering Symmetry and DOM Coupling", () => {
  describe("A. Repeated rendering lifecycle and transition symmetry on a persistent node", () => {
    it("renders through sound -> caries -> crown -> extraction -> sound and returns to identical baseline", () => {
      const node = __parseSvgForTest(svg11);

      // Baseline sound state
      const soundState = { toothSelection: "tooth-base" };
      const baselineLayers = __renderActiveLayersOnNode(node, 11, soundState);
      const baselineIds = baselineLayers.map((l) => l.id);
      expect(baselineIds).toContain("tooth-base");
      expect(baselineIds).not.toContain("caries-occlusal");
      expect(baselineIds).not.toContain("zircon-crown");

      // Transition 1: Occlusal caries
      const cariesState = { toothSelection: "tooth-base", caries: ["caries-occlusal"] };
      const cariesLayers = __renderActiveLayersOnNode(node, 11, cariesState);
      expect(cariesLayers.map((l) => l.id)).toContain("caries-occlusal");

      // Transition 2: Zircon Crown
      const crownState = { toothSelection: "tooth-base", restorationType: "crown", restorationMaterial: "zircon" };
      const crownLayers = __renderActiveLayersOnNode(node, 11, crownState);
      const crownIds = crownLayers.map((l) => l.id);
      expect(crownIds).toContain("zircon-crown");
      expect(crownIds).not.toContain("caries-occlusal"); // Caries deactivated

      // Transition 3: Extraction socket
      const extractionState = { toothSelection: "no-tooth-after-extraction" };
      const extractLayers = __renderActiveLayersOnNode(node, 11, extractionState);
      const extractIds = extractLayers.map((l) => l.id);
      expect(extractIds).not.toContain("tooth-base");
      expect(extractIds).not.toContain("zircon-crown");

      // Transition 4: Return to sound state
      const finalLayers = __renderActiveLayersOnNode(node, 11, soundState);

      // Must be byte-identical in active layer sequence, opacities, and classes
      expect(finalLayers).toEqual(baselineLayers);

      // Assert explicit data-active="0" on clinical elements that were deactivated
      const cariesEl = node.querySelector("#caries-occlusal");
      expect(cariesEl?.getAttribute("data-active")).toBe("0");

      const crownEl = node.querySelector("#zircon-crown");
      expect(crownEl?.getAttribute("data-active")).toBe("0");
    });
  });

  describe("B. inflammationHome DOM reparenting and restoration on persistent node", () => {
    it("reparents #inflammation to end of tooth container when lifted, and restores to original parent when cleared", () => {
      const node = __parseSvgForTest(svg11);
      const inflammation = node.querySelector("#inflammation") as SVGElement;
      expect(inflammation).toBeTruthy();

      const homeParent = inflammation.parentElement;
      const homeNext = inflammation.nextSibling;
      expect(homeParent?.id).toBe("mods");

      // 1. Activate endo resection with apical diagnosis -> lifts inflammation above tooth
      const resectionState = {
        toothSelection: "tooth-base",
        endoResection: true,
        apicalDx: "asymptomatic-apical-periodontitis",
      };
      __renderActiveLayersOnNode(node, 11, resectionState);

      // Reparented to tooth group container (not inside #mods anymore)
      expect(inflammation.parentElement).not.toBe(homeParent);
      const toothGroup = node.querySelector("#tooth");
      const expectedContainer = toothGroup?.parentElement || node;
      expect(inflammation.parentElement).toBe(expectedContainer);
      expect(expectedContainer.lastElementChild).toBe(inflammation);

      // 2. Clear endo resection -> must restore back into #mods at original sibling index!
      const clearedState = {
        toothSelection: "tooth-base",
        endoResection: false,
        apicalDx: "asymptomatic-apical-periodontitis",
      };
      __renderActiveLayersOnNode(node, 11, clearedState);

      expect(inflammation.parentElement).toBe(homeParent);
      expect(inflammation.nextSibling).toBe(homeNext);

      // 3. Activate cervical resorption -> lifts again
      const resorptionState = {
        toothSelection: "tooth-base",
        resorptionType: "external-cervical",
        apicalDx: "asymptomatic-apical-periodontitis",
      };
      __renderActiveLayersOnNode(node, 11, resorptionState);

      expect(inflammation.parentElement).toBe(expectedContainer);
      expect(expectedContainer.lastElementChild).toBe(inflammation);

      // 4. Return to sound state -> restored back to home and deactivated
      __renderActiveLayersOnNode(node, 11, { toothSelection: "tooth-base" });
      expect(inflammation.parentElement).toBe(homeParent);
      expect(inflammation.nextSibling).toBe(homeNext);
      expect(inflammation.getAttribute("data-active")).toBe("0");
    });
  });

  describe("C. Configuration toggles: setShowBase and setHealthyPulpVisible", () => {
    it("setShowBase(false) deactivates base element; setShowBase(true) activates it", () => {
      const node = __parseSvgForTest(svg11);
      const state = { toothSelection: "tooth-base" };

      setShowBase(false);
      __renderActiveLayersOnNode(node, 11, state);
      const baseEl = node.querySelector("#base");
      expect(baseEl?.getAttribute("data-active")).toBe("0");

      setShowBase(true);
      __renderActiveLayersOnNode(node, 11, state);
      expect(baseEl?.getAttribute("data-active")).not.toBe("0");
    });

    it("setHealthyPulpVisible(false) hides healthy-pulp layer when pulp is sound", () => {
      const node = __parseSvgForTest(svg11);
      const state = { toothSelection: "tooth-base" };

      setHealthyPulpVisible(false);
      __renderActiveLayersOnNode(node, 11, state);
      const healthyPulp = node.querySelector("#healthy-pulp");
      if (healthyPulp) {
        expect(healthyPulp.getAttribute("data-active")).toBe("0");
      }

      setHealthyPulpVisible(true);
      __renderActiveLayersOnNode(node, 11, state);
      if (healthyPulp) {
        expect(healthyPulp.getAttribute("data-active")).not.toBe("0");
      }
    });
  });

  describe("D. Proposed Plan stroke styling and attribute mutations", () => {
    it("marks proposed layers with data-proposed, strokeDasharray, stroke, and base capture", () => {
      const SOUND_STATE = { toothSelection: "tooth-base", restorationType: "none", restorationMaterial: "none" };
      const CROWN_STATE = { toothSelection: "tooth-base", restorationType: "crown", restorationMaterial: "zircon" };

      __setToothStateForTest(11, SOUND_STATE); // Status chart: sound
      setChartMode("plan"); // Clone status to plan
      __setToothStateForTest(11, CROWN_STATE); // Plan chart: crown

      const node = __parseSvgForTest(svg11);
      __renderActiveLayersOnNode(node, 11, CROWN_STATE);
      __applyProposedStylingForTest(11, node);

      const crownEl = node.querySelector("#zircon-crown") as SVGElement;
      expect(crownEl).toBeTruthy();

      // Assert explicit SVG attributes
      expect(crownEl.getAttribute("data-proposed")).toBe("1");
      expect(crownEl.style.strokeDasharray).toBe("4 2");
      expect(["#5b7a9d", "rgb(91, 122, 157)"]).toContain(crownEl.style.stroke);
      expect(crownEl.getAttribute("data-base-dash")).toBe("");
      expect(crownEl.getAttribute("data-base-pstroke")).toBe("rgb(27, 63, 28)");

      // tooth-base was active in status as well, so must NOT be marked proposed
      const baseEl = node.querySelector("#tooth-base") as SVGElement;
      expect(baseEl.getAttribute("data-proposed")).toBeNull();
      expect(baseEl.style.strokeDasharray).toBe("");

      // Flip back to Status mode -> clears proposed styling and restores base stroke
      setChartMode("status");
      __renderActiveLayersOnNode(node, 11, SOUND_STATE);
      __applyProposedStylingForTest(11, node);

      expect(crownEl.getAttribute("data-proposed")).toBeNull();
      expect(crownEl.style.strokeDasharray).toBe("");
      expect(crownEl.style.stroke).toBe("rgb(27, 63, 28)");
    });
  });
});
