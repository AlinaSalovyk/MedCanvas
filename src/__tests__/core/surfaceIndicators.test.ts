import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  syncSurfaceDepthIndicator,
  syncFillingSubcariesIndicator,
  syncFillingDefectIndicator,
  __syncSurfaceDepthIndicatorForTest,
  __syncFillingSubcariesIndicatorForTest,
  __syncFillingDefectIndicatorForTest,
} from "@/engine/indicators/surfaceIndicators";
import {
  __syncSurfaceDepthIndicatorForTest as reexportedSyncSurfaceDepth,
  __syncFillingSubcariesIndicatorForTest as reexportedSyncFillingSubcaries,
  __syncFillingDefectIndicatorForTest as reexportedSyncFillingDefect,
} from "@/odontogram";
import {
  setIcdasEnabled,
  setRadiographicDepthMode,
} from "@/engine/sessionSettings";

function createSurfaceCell(surface = "occlusal", prefix = "caries-"): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "surface-cell";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.value = `${prefix}${surface}`;
  const ind = document.createElement("div");
  ind.className = "surf-depth";
  cell.appendChild(input);
  cell.appendChild(ind);
  return cell;
}

function createFillingCell(surface = "occlusal"): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "surface-cell";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.value = surface;
  const ind = document.createElement("span");
  ind.className = "surf-defect";
  const depth = document.createElement("span");
  depth.className = "surf-depth";
  cell.appendChild(input);
  cell.appendChild(ind);
  cell.appendChild(depth);
  return cell;
}

describe("surfaceIndicators unit & behavioral verification", () => {
  beforeEach(() => {
    setIcdasEnabled(false);
    setRadiographicDepthMode("off");
  });

  afterEach(() => {
    setIcdasEnabled(false);
    setRadiographicDepthMode("off");
  });

  describe("re-export parity through @/odontogram", () => {
    it("exports identical test helpers", () => {
      expect(reexportedSyncSurfaceDepth).toBe(__syncSurfaceDepthIndicatorForTest);
      expect(reexportedSyncFillingSubcaries).toBe(__syncFillingSubcariesIndicatorForTest);
      expect(reexportedSyncFillingDefect).toBe(__syncFillingDefectIndicatorForTest);
    });
  });

  describe("syncSurfaceDepthIndicator", () => {
    it("handles ICDAS disabled mode: renders 3 bars and data-depth", () => {
      setIcdasEnabled(false);
      const cell = createSurfaceCell("occlusal");
      syncSurfaceDepthIndicator(cell, {
        cariesSeverity: new Map([["occlusal", 2]]),
      });
      const ind = cell.querySelector(".surf-depth")!;
      expect(ind.classList.contains("icdas")).toBe(false);
      expect(ind.getAttribute("data-depth")).toBe("surface");
      expect(ind.getAttribute("data-icdas")).toBe("2");
      expect(ind.innerHTML).toBe("<i></i><i></i><i></i>");
    });

    it("handles ICDAS enabled mode: renders numeric badge and icdas class", () => {
      setIcdasEnabled(true);
      const cell = createSurfaceCell("occlusal");
      syncSurfaceDepthIndicator(cell, {
        cariesSeverity: new Map([["occlusal", 4]]),
      });
      const ind = cell.querySelector(".surf-depth")!;
      expect(ind.classList.contains("icdas")).toBe(true);
      expect(ind.getAttribute("data-depth")).toBe("dentin");
      expect(ind.getAttribute("data-icdas")).toBe("4");
      expect(ind.textContent).toBe("4");
    });

    it("defaults code to 2 when caries severity is empty or missing", () => {
      const cell = createSurfaceCell("distal");
      syncSurfaceDepthIndicator(cell, {
        cariesSeverity: new Map(),
      });
      const ind = cell.querySelector(".surf-depth")!;
      expect(ind.getAttribute("data-icdas")).toBe("2");
      expect(ind.getAttribute("data-depth")).toBe("surface");
    });

    it("correctly maps 3-level caries depth for various ICDAS codes", () => {
      const codesToExpected = [
        { code: 1, depth: "surface" },
        { code: 2, depth: "surface" },
        { code: 3, depth: "dentin" },
        { code: 4, depth: "dentin" },
        { code: 5, depth: "deep" },
        { code: 6, depth: "deep" },
      ];
      for (const { code, depth } of codesToExpected) {
        const cell = createSurfaceCell("mesial");
        syncSurfaceDepthIndicator(cell, {
          cariesSeverity: new Map([["mesial", code]]),
        });
        const ind = cell.querySelector(".surf-depth")!;
        expect(ind.getAttribute("data-depth")).toBe(depth);
      }
    });

    it("handles radiographic-depth mode toggling and values", () => {
      const cell = createSurfaceCell("lingual");
      const stateWithRadio = {
        cariesSeverity: new Map([["lingual", 3]]),
        radiographicDepth: new Map([["lingual", "r2"]]),
      };

      // Off by default: data-radio must NOT be set
      setRadiographicDepthMode("off");
      syncSurfaceDepthIndicator(cell, stateWithRadio);
      let ind = cell.querySelector(".surf-depth")!;
      expect(ind.hasAttribute("data-radio")).toBe(false);

      // On (detailed): data-radio must be set
      setRadiographicDepthMode("detailed");
      syncSurfaceDepthIndicator(cell, stateWithRadio);
      ind = cell.querySelector(".surf-depth")!;
      expect(ind.getAttribute("data-radio")).toBe("r2");

      // On but value is "none": data-radio must be removed
      const stateRadioNone = {
        cariesSeverity: new Map([["lingual", 3]]),
        radiographicDepth: new Map([["lingual", "none"]]),
      };
      syncSurfaceDepthIndicator(cell, stateRadioNone);
      expect(ind.hasAttribute("data-radio")).toBe(false);
    });

    it("tolerates missing radiographicDepth optional map (defensive optional-chaining)", () => {
      const cell = createSurfaceCell("buccal");
      expect(() => syncSurfaceDepthIndicator(cell, { cariesSeverity: new Map() })).not.toThrow();
      const ind = cell.querySelector(".surf-depth")!;
      expect(ind.getAttribute("data-icdas")).toBe("2");
      expect(ind.hasAttribute("data-radio")).toBe(false);
    });

    it("matches original semantic behavior: requires cariesSeverity map on state", () => {
      const cell = createSurfaceCell("buccal");
      // Original code does `state.cariesSeverity.get(surface)` without null-guarding cariesSeverity itself
      expect(() => syncSurfaceDepthIndicator(cell, {} as never)).toThrow();
    });

    it("survives consecutive calls and updates DOM cleanly", () => {
      const cell = createSurfaceCell("occlusal");
      const ind = cell.querySelector(".surf-depth")!;

      setIcdasEnabled(true);
      syncSurfaceDepthIndicator(cell, { cariesSeverity: new Map([["occlusal", 5]]) });
      expect(ind.textContent).toBe("5");
      expect(ind.classList.contains("icdas")).toBe(true);

      setIcdasEnabled(false);
      syncSurfaceDepthIndicator(cell, { cariesSeverity: new Map([["occlusal", 1]]) });
      expect(ind.innerHTML).toBe("<i></i><i></i><i></i>");
      expect(ind.classList.contains("icdas")).toBe(false);
      expect(ind.getAttribute("data-icdas")).toBe("1");
    });
  });

  describe("syncFillingSubcariesIndicator", () => {
    it("adds .has-subcaries and CARS badge when filling AND caries exist on surface", () => {
      setIcdasEnabled(true);
      const cell = createFillingCell("occlusal");
      syncFillingSubcariesIndicator(cell, {
        caries: new Set(["caries-occlusal"]),
        cariesSeverity: new Map([["occlusal", 6]]),
        fillingSurfaceMaterials: new Map([["occlusal", "comp"]]),
      });
      const ind = cell.querySelector(".surf-depth")!;
      expect(ind.classList.contains("has-subcaries")).toBe(true);
      expect(ind.getAttribute("data-icdas")).toBe("6");
      expect(ind.getAttribute("data-depth")).toBe("deep");
      expect(ind.textContent).toBe("6");
    });

    it("removes .has-subcaries and CARS attributes when caries absent", () => {
      const cell = createFillingCell("occlusal");
      const ind = cell.querySelector(".surf-depth")!;
      ind.classList.add("has-subcaries", "icdas");
      ind.setAttribute("data-depth", "deep");
      ind.setAttribute("data-icdas", "6");

      syncFillingSubcariesIndicator(cell, {
        caries: new Set(),
        fillingSurfaceMaterials: new Map([["occlusal", "comp"]]),
      });
      expect(ind.classList.contains("has-subcaries")).toBe(false);
      expect(ind.classList.contains("icdas")).toBe(false);
      expect(ind.hasAttribute("data-depth")).toBe(false);
      expect(ind.hasAttribute("data-icdas")).toBe(false);
      expect(ind.innerHTML).toBe("<i></i><i></i><i></i>");
    });

    it("does not flag subcaries if caries present but filling absent", () => {
      const cell = createFillingCell("occlusal");
      syncFillingSubcariesIndicator(cell, {
        caries: new Set(["caries-occlusal"]),
        fillingSurfaceMaterials: new Map(),
      });
      const ind = cell.querySelector(".surf-depth")!;
      expect(ind.classList.contains("has-subcaries")).toBe(false);
    });

    it("handles missing maps without throwing", () => {
      const cell = createFillingCell("occlusal");
      expect(() => syncFillingSubcariesIndicator(cell, {})).not.toThrow();
      const ind = cell.querySelector(".surf-depth")!;
      expect(ind.classList.contains("has-subcaries")).toBe(false);
    });
  });

  describe("syncFillingDefectIndicator", () => {
    it("sets .has-defect and data-defect when filling exists and defect is non-none", () => {
      const cell = createFillingCell("distal");
      syncFillingDefectIndicator(cell, {
        fillingSurfaceMaterials: new Map([["distal", "amalgam"]]),
        fillingDefect: new Map([["distal", "fracture"]]),
      });
      const ind = cell.querySelector(".surf-defect")!;
      expect(ind.classList.contains("has-defect")).toBe(true);
      expect(ind.getAttribute("data-defect")).toBe("fracture");
    });

    it("clears defect when defect is 'none'", () => {
      const cell = createFillingCell("distal");
      syncFillingDefectIndicator(cell, {
        fillingSurfaceMaterials: new Map([["distal", "amalgam"]]),
        fillingDefect: new Map([["distal", "none"]]),
      });
      const ind = cell.querySelector(".surf-defect")!;
      expect(ind.classList.contains("has-defect")).toBe(false);
      expect(ind.hasAttribute("data-defect")).toBe(false);
    });

    it("clears defect when filling is missing even if defect value exists", () => {
      const cell = createFillingCell("distal");
      syncFillingDefectIndicator(cell, {
        fillingSurfaceMaterials: new Map(),
        fillingDefect: new Map([["distal", "marginal"]]),
      });
      const ind = cell.querySelector(".surf-defect")!;
      expect(ind.classList.contains("has-defect")).toBe(false);
      expect(ind.hasAttribute("data-defect")).toBe(false);
    });

    it("handles missing maps and non-matching DOM nodes safely", () => {
      const cell = createFillingCell("distal");
      expect(() => syncFillingDefectIndicator(cell, {})).not.toThrow();

      const emptyDiv = document.createElement("div");
      expect(() => syncFillingDefectIndicator(emptyDiv, {})).not.toThrow();
    });
  });
});
