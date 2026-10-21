import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  showCariesDepthPopup,
  showFillingDefectPopup,
  hideCariesDepthPopup,
} from "@/engine/popups/surfacePopups";
import {
  openCariesDepthPopup,
  openFillingDefectPopup,
  __setToothStateForTest,
  __setActiveToothForTest,
  __setSelectionForTest,
  __resetChartStateForTest,
  getStatusChart,
  initOdontogram,
  destroyOdontogram,
} from "@/odontogram";
import { setI18nLanguage } from "@/i18n/useI18n";
import { setRadiographicDepthMode } from "@/engine/sessionSettings";

describe("surfacePopups module & public popup entry points", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    setI18nLanguage("en");
    __resetChartStateForTest();
  });

  afterEach(() => {
    hideCariesDepthPopup();
    destroyOdontogram();
    document.body.innerHTML = "";
    setI18nLanguage("en");
    setRadiographicDepthMode("off");
  });

  describe("A. hideCariesDepthPopup", () => {
    it("removes .odon-depth-popup from document when present", () => {
      const p = document.createElement("div");
      p.className = "odon-depth-popup";
      document.body.appendChild(p);

      expect(document.querySelector(".odon-depth-popup")).not.toBeNull();
      hideCariesDepthPopup();
      expect(document.querySelector(".odon-depth-popup")).toBeNull();
    });

    it("no-ops safely when no popup is mounted", () => {
      expect(() => hideCariesDepthPopup()).not.toThrow();
    });
  });

  describe("B. Viewport clamping and positioning", () => {
    it("clamps popup position within viewport bounds for near-edge anchors", () => {
      __setToothStateForTest(16, { toothSelection: "tooth-base", caries: ["caries-occlusal"] });
      __setActiveToothForTest(16);

      const anchor = document.createElement("div");
      document.body.appendChild(anchor);

      // Anchor placed at the far bottom-right edge of a 1024x768 viewport
      vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
        left: 1020,
        top: 760,
        right: 1024,
        bottom: 768,
        width: 10,
        height: 10,
        x: 1020,
        y: 760,
        toJSON: () => {},
      });

      showCariesDepthPopup("occlusal", anchor, 16);

      const popup = document.querySelector(".odon-depth-popup") as HTMLElement;
      expect(popup).not.toBeNull();

      const left = parseFloat(popup.style.left);
      const top = parseFloat(popup.style.top);

      // Clamped to at most window.innerWidth - pw - 8
      expect(left).toBeLessThanOrEqual(window.innerWidth - 8);
      expect(left).toBeGreaterThanOrEqual(8);
      // Clamped vertically
      expect(top).toBeLessThanOrEqual(window.innerHeight - 8);
      expect(top).toBeGreaterThanOrEqual(8);
    });

    it("clamps to minimum 8px margin for negative/zero anchor positions", () => {
      __setToothStateForTest(16, { toothSelection: "tooth-base", caries: ["caries-occlusal"] });
      __setActiveToothForTest(16);

      const anchor = document.createElement("div");
      document.body.appendChild(anchor);

      vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
        left: -50,
        top: -50,
        right: -40,
        bottom: -40,
        width: 10,
        height: 10,
        x: -50,
        y: -50,
        toJSON: () => {},
      });

      showCariesDepthPopup("occlusal", anchor, 16);

      const popup = document.querySelector(".odon-depth-popup") as HTMLElement;
      expect(popup).not.toBeNull();
      expect(parseFloat(popup.style.left)).toBe(8);
      expect(parseFloat(popup.style.top)).toBe(8);
    });
  });

  describe("C. Surface title formatting across anterior and posterior teeth", () => {
    it("formats title with 'incisal' for anterior teeth (e.g. 11)", () => {
      __setToothStateForTest(11, { toothSelection: "tooth-base", caries: ["caries-occlusal"] });
      __setActiveToothForTest(11);

      const anchor = document.createElement("div");
      document.body.appendChild(anchor);

      showCariesDepthPopup("occlusal", anchor, 11);

      const title = document.querySelector(".odon-depth-title");
      expect(title?.textContent?.toLowerCase()).toContain("incisal");
    });

    it("formats title with 'occlusal' for posterior teeth (e.g. 16)", () => {
      __setToothStateForTest(16, { toothSelection: "tooth-base", caries: ["caries-occlusal"] });
      __setActiveToothForTest(16);

      const anchor = document.createElement("div");
      document.body.appendChild(anchor);

      showCariesDepthPopup("occlusal", anchor, 16);

      const title = document.querySelector(".odon-depth-title");
      expect(title?.textContent?.toLowerCase()).toContain("occlusal");
    });
  });

  describe("D. Asynchronous listener registration & dismissal lifecycle", () => {
    it("dismisses on Escape key via deferred keydown listener", () => {
      __setToothStateForTest(16, { toothSelection: "tooth-base", caries: ["caries-occlusal"] });
      __setActiveToothForTest(16);

      const anchor = document.createElement("div");
      document.body.appendChild(anchor);

      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        showCariesDepthPopup("occlusal", anchor, 16);
        vi.runAllTimers(); // flush setTimeout(..., 0)

        expect(document.querySelector(".odon-depth-popup")).not.toBeNull();

        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        expect(document.querySelector(".odon-depth-popup")).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("dismisses on outside mousedown via deferred mousedown listener", () => {
      __setToothStateForTest(16, { toothSelection: "tooth-base", caries: ["caries-occlusal"] });
      __setActiveToothForTest(16);

      const anchor = document.createElement("div");
      document.body.appendChild(anchor);

      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        showCariesDepthPopup("occlusal", anchor, 16);
        vi.runAllTimers();

        expect(document.querySelector(".odon-depth-popup")).not.toBeNull();

        document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        expect(document.querySelector(".odon-depth-popup")).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("repeated sequential calls close prior popup before opening new one", () => {
      __setToothStateForTest(16, { toothSelection: "tooth-base", caries: ["caries-occlusal", "caries-mesial"] });
      __setActiveToothForTest(16);

      const a1 = document.createElement("div");
      const a2 = document.createElement("div");
      document.body.appendChild(a1);
      document.body.appendChild(a2);

      showCariesDepthPopup("occlusal", a1, 16);
      expect(document.querySelectorAll(".odon-depth-popup").length).toBe(1);

      showCariesDepthPopup("mesial", a2, 16);
      expect(document.querySelectorAll(".odon-depth-popup").length).toBe(1);
    });
  });

  describe("E. Integration through odontogram public facade entry points", () => {
    it("openCariesDepthPopup routes mutation through real applyToSelected", () => {
      const host = document.createElement("div");
      host.id = "host";
      document.body.appendChild(host);
      initOdontogram();

      __setToothStateForTest(11, { toothSelection: "tooth-base", caries: ["caries-buccal"] });
      __setSelectionForTest([11]);
      __setActiveToothForTest(11);

      const anchor = document.createElement("div");
      document.body.appendChild(anchor);

      openCariesDepthPopup("buccal", anchor);

      const popup = document.querySelector(".odon-depth-popup") as HTMLElement;
      expect(popup).not.toBeNull();

      const options = popup.querySelectorAll(".odon-depth-option");
      expect(options.length).toBeGreaterThan(0);

      // Click the last option (e.g. depth 6)
      const btn = options[options.length - 1] as HTMLButtonElement;
      btn.click();

      // Mutation has taken effect in status chart
      expect(getStatusChart().teeth[11].cariesSeverity.buccal).toBeDefined();
      expect(document.querySelector(".odon-depth-popup")).toBeNull();
    });

    it("openFillingDefectPopup routes structural defect through real applyToSelected", () => {
      const host = document.createElement("div");
      host.id = "host";
      document.body.appendChild(host);
      initOdontogram();

      __setToothStateForTest(11, {
        toothSelection: "tooth-base",
        fillingSurfaces: ["buccal"],
        fillingSurfaceMaterials: { buccal: "composite" },
      });
      __setSelectionForTest([11]);
      __setActiveToothForTest(11);

      const anchor = document.createElement("div");
      document.body.appendChild(anchor);

      openFillingDefectPopup("buccal", anchor);

      const popup = document.querySelector(".odon-depth-popup") as HTMLElement;
      expect(popup).not.toBeNull();

      const options = popup.querySelectorAll(".odon-depth-option");
      expect(options.length).toBe(4); // none, marginal, fracture, wear

      // Click "marginal" (index 1)
      const btn = options[1] as HTMLButtonElement;
      btn.click();

      expect(getStatusChart().teeth[11].fillingDefect.buccal).toBe("marginal");
      expect(document.querySelector(".odon-depth-popup")).toBeNull();
    });

    it("openFillingDefectPopup no-ops when surface has no filling", () => {
      const host = document.createElement("div");
      host.id = "host";
      document.body.appendChild(host);
      initOdontogram();

      __setToothStateForTest(11, { toothSelection: "tooth-base" });
      __setActiveToothForTest(11);

      const anchor = document.createElement("div");
      document.body.appendChild(anchor);

      openFillingDefectPopup("buccal", anchor);
      expect(document.querySelector(".odon-depth-popup")).toBeNull();
    });
  });

  describe("F. Explicit applyFn callback parameter", () => {
    it("showCariesDepthPopup executes explicit applyFn when provided", () => {
      __setToothStateForTest(16, { toothSelection: "tooth-base", caries: ["caries-occlusal"] });
      __setActiveToothForTest(16);

      const anchor = document.createElement("div");
      document.body.appendChild(anchor);

      const mockApply = vi.fn((fn) => {
        const fakeState = { caries: new Set(["caries-occlusal"]), cariesSeverity: new Map() };
        fn(fakeState);
        expect(fakeState.cariesSeverity.has("occlusal")).toBe(true);
      });

      showCariesDepthPopup("occlusal", anchor, 16, mockApply);

      const popup = document.querySelector(".odon-depth-popup") as HTMLElement;
      const opt = popup.querySelector(".odon-depth-option") as HTMLButtonElement;
      opt.click();

      expect(mockApply).toHaveBeenCalledTimes(1);
    });

    it("showFillingDefectPopup executes explicit applyFn when provided", () => {
      __setToothStateForTest(16, {
        toothSelection: "tooth-base",
        fillingSurfaces: ["occlusal"],
        fillingSurfaceMaterials: { occlusal: "composite" },
      });
      __setActiveToothForTest(16);

      const anchor = document.createElement("div");
      document.body.appendChild(anchor);

      const mockApply = vi.fn((fn) => {
        const fakeState = { fillingDefect: new Map() };
        fn(fakeState);
        expect(fakeState.fillingDefect.has("occlusal")).toBe(true);
      });

      showFillingDefectPopup("occlusal", anchor, 16, mockApply);

      const popup = document.querySelector(".odon-depth-popup") as HTMLElement;
      const opt = popup.querySelectorAll(".odon-depth-option")[2] as HTMLButtonElement; // fracture
      opt.click();

      expect(mockApply).toHaveBeenCalledTimes(1);
    });
  });
});
