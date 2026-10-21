import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";
import {
  applyStateToSvgSingle,
  applyProposedStyling,
  clearProposedStyling,
  markProposed,
  collectActiveLayers,
  setPulpInflamPaths,
  inflammationHome,
  PROPOSED_DASH,
  PROPOSED_TINT,
  type ToothPainterOptions,
} from "@/engine/rendering/toothSvgPainter";
import {
  __resetChartStateForTest,
  __setToothStateForTest,
  __parseSvgForTest,
  setChartMode,
} from "@/odontogram";
import { hydrateState } from "@/state/payload";

const svg11 = readFileSync(fileURLToPath(new NodeURL("../../assets/teeth-svgs/11.svg", import.meta.url)), "utf8");

const SOUND_STATE = { toothSelection: "tooth-base" };
const MISSING_ENDO_STATE = { toothSelection: "none", endo: "endo-filling" };
const CROWN_STATE = { toothSelection: "tooth-base", restorationType: "crown", restorationMaterial: "zircon" };

describe("toothSvgPainter module unit & integration tests", () => {
  beforeEach(() => {
    __resetChartStateForTest();
    document.body.innerHTML = "";
  });

  describe("Warning callback routing and timing", () => {
    it("invokes onStateWarning callback synchronously when passed as function", () => {
      const node = __parseSvgForTest(svg11);
      const state = hydrateState(MISSING_ENDO_STATE);
      const warningsReceived: unknown[] = [];

      applyStateToSvgSingle(11, node, state, (s) => {
        warningsReceived.push(s);
      });

      expect(warningsReceived.length).toBe(1);
      expect(warningsReceived[0]).toBe(state);
    });

    it("invokes onStateWarning callback when passed inside options object", () => {
      const node = __parseSvgForTest(svg11);
      const state = hydrateState(SOUND_STATE);
      let called = false;
      const opts: ToothPainterOptions = {
        onStateWarning: (s) => {
          if (s === state) called = true;
        },
      };

      applyStateToSvgSingle(11, node, state, opts);
      expect(called).toBe(true);
    });

    it("reads live active-chart toothState when state argument is undefined", () => {
      const node = __parseSvgForTest(svg11);
      __setToothStateForTest(11, MISSING_ENDO_STATE);
      let receivedState: unknown = null;

      applyStateToSvgSingle(11, node, undefined, (s) => {
        receivedState = s;
      });

      expect(receivedState).toBeDefined();
      expect((receivedState as Record<string, unknown>).endo).toBe("endo-filling");
    });

    it("supports 3-argument overload (toothNo, svg, callback) reading live toothState", () => {
      const node = __parseSvgForTest(svg11);
      __setToothStateForTest(11, CROWN_STATE);
      let receivedState: unknown = null;

      applyStateToSvgSingle(11, node, (s: unknown) => {
        receivedState = s;
      });

      expect(receivedState).toBeDefined();
      expect((receivedState as Record<string, unknown>).restorationType).toBe("crown");
    });

    it("early-returns without calling callback when state or svg is null/missing", () => {
      const callbackCalls: unknown[] = [];
      const cb = (s: unknown) => callbackCalls.push(s);

      // SVG is null
      applyStateToSvgSingle(11, null as unknown as Element, hydrateState(SOUND_STATE), cb);
      expect(callbackCalls.length).toBe(0);

      // Node present but toothState absent and no state passed
      const node = __parseSvgForTest(svg11);
      applyStateToSvgSingle(99, node, undefined, cb);
      expect(callbackCalls.length).toBe(0);
    });

    it("does not forward warning callback to detached Status clone paint during applyProposedStyling", () => {
      const node = __parseSvgForTest(svg11);
      __setToothStateForTest(11, SOUND_STATE);
      setChartMode("plan");
      __setToothStateForTest(11, CROWN_STATE);

      // Paint Plan state
      applyStateToSvgSingle(11, node);

      const receivedInProposed: unknown[] = [];
      applyProposedStyling(11, node, (statusState) => {
        receivedInProposed.push(statusState);
      });

      // Proposed styling paints detached clone without invoking warning callback (isolation)
      expect(receivedInProposed.length).toBe(0);
    });

    it("does not paint clone or invoke callback in Status mode during applyProposedStyling", () => {
      const node = __parseSvgForTest(svg11);
      __setToothStateForTest(11, SOUND_STATE);

      let callbackFired = false;
      applyProposedStyling(11, node, () => {
        callbackFired = true;
      });

      expect(callbackFired).toBe(false);
    });
  });

  describe("collectActiveLayers and styling utilities", () => {
    it("collectActiveLayers preserves document order and extracts id, opacity, class", () => {
      const node = __parseSvgForTest(svg11);
      applyStateToSvgSingle(11, node, hydrateState(SOUND_STATE));
      const layers = collectActiveLayers(node);

      expect(layers.length).toBeGreaterThan(0);
      expect(layers.every((l) => typeof l.id === "string" && l.id.length > 0)).toBe(true);
      expect(layers.some((l) => l.id === "tooth-base")).toBe(true);
    });

    it("markProposed sets attributes and clearProposedStyling restores them", () => {
      const node = __parseSvgForTest(svg11);
      applyStateToSvgSingle(11, node, hydrateState(SOUND_STATE));
      const toothBase = node.querySelector("#tooth-base")!;

      toothBase.style.strokeDasharray = "1 1";
      toothBase.style.stroke = "red";

      markProposed(toothBase);
      expect(toothBase.getAttribute("data-proposed")).toBe("1");
      expect(toothBase.getAttribute("data-base-dash")).toBe("1 1");
      expect(toothBase.getAttribute("data-base-pstroke")).toBe("red");
      expect(toothBase.style.strokeDasharray).toBe(PROPOSED_DASH);
      expect(["rgb(91, 122, 157)", PROPOSED_TINT]).toContain(toothBase.style.stroke);

      clearProposedStyling(node);
      expect(toothBase.getAttribute("data-proposed")).toBeNull();
      expect(toothBase.style.strokeDasharray).toBe("1 1");
      expect(toothBase.style.stroke).toBe("red");
    });

    it("setPulpInflamPaths sets flame sublayers symmetrically", () => {
      const node = __parseSvgForTest(svg11);
      setPulpInflamPaths(node, true);
      const flame1 = node.querySelector("#pulp-inflam-path-1");
      if (flame1) {
        expect(flame1.getAttribute("data-active")).toBe("1");
      }
      setPulpInflamPaths(node, false);
      if (flame1) {
        expect(flame1.getAttribute("data-active")).toBe("0");
      }
    });

    it("inflammationHome is an element-keyed WeakMap instance", () => {
      expect(inflammationHome).toBeInstanceOf(WeakMap);
      const dummy = document.createElement("div");
      const parent = document.createElement("div");
      parent.appendChild(dummy);
      inflammationHome.set(dummy, { parent, next: null });
      expect(inflammationHome.get(dummy)).toEqual({ parent, next: null });
    });
  });
});
