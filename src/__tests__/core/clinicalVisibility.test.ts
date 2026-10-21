import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  syncInflammationModVisibility,
  syncPeriImplantVisibility,
  __syncInflammationModVisibilityForTest,
  __syncPeriImplantVisibilityForTest,
} from "@/engine/indicators/clinicalVisibility";
import {
  __syncInflammationModVisibilityForTest as reexportedSyncInflammation,
  __syncPeriImplantVisibilityForTest as reexportedSyncPeriImplant,
} from "@/odontogram";

function buildModsContainer(includeParodontal = true, includeInflammation = true): HTMLElement {
  const container = document.createElement("div");
  container.id = "modsChecks";

  if (includeParodontal) {
    const lbl = document.createElement("label");
    const inp = document.createElement("input");
    inp.type = "checkbox";
    inp.value = "parodontal";
    const span = document.createElement("span");
    span.textContent = "Parodontal";
    lbl.appendChild(inp);
    lbl.appendChild(span);
    container.appendChild(lbl);
  }

  if (includeInflammation) {
    const lbl = document.createElement("label");
    const inp = document.createElement("input");
    inp.type = "checkbox";
    inp.value = "inflammation";
    const span = document.createElement("span");
    span.textContent = "Inflammation";
    lbl.appendChild(inp);
    lbl.appendChild(span);
    container.appendChild(lbl);
  }

  return container;
}

function buildPeriImplantRow(): HTMLElement {
  const row = document.createElement("div");
  row.id = "periImplantRow";
  row.className = "row hidden";
  return row;
}

describe("clinicalVisibility unit & behavioral verification", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  describe("re-export parity through @/odontogram", () => {
    it("exports identical test helper references", () => {
      expect(reexportedSyncInflammation).toBe(__syncInflammationModVisibilityForTest);
      expect(reexportedSyncPeriImplant).toBe(__syncPeriImplantVisibilityForTest);
    });
  });

  describe("syncInflammationModVisibility", () => {
    it("hides inflammation for present natural tooth (tooth-base)", () => {
      const container = buildModsContainer();
      const label = container.querySelector('input[value="inflammation"]')!.closest("label")!;

      syncInflammationModVisibility(container, "tooth-base");
      expect(label.classList.contains("hidden")).toBe(true);
    });

    it("hides inflammation for present milk tooth (milktooth)", () => {
      const container = buildModsContainer();
      const label = container.querySelector('input[value="inflammation"]')!.closest("label")!;

      syncInflammationModVisibility(container, "milktooth");
      expect(label.classList.contains("hidden")).toBe(true);
    });

    it("hides inflammation for implant", () => {
      const container = buildModsContainer();
      const label = container.querySelector('input[value="inflammation"]')!.closest("label")!;

      syncInflammationModVisibility(container, "implant");
      expect(label.classList.contains("hidden")).toBe(true);
    });

    it("shows inflammation for missing tooth (none)", () => {
      const container = buildModsContainer();
      const label = container.querySelector('input[value="inflammation"]')!.closest("label")!;
      label.classList.add("hidden");

      syncInflammationModVisibility(container, "none");
      expect(label.classList.contains("hidden")).toBe(false);
    });

    it("shows inflammation for extraction socket (no-tooth-after-extraction)", () => {
      const container = buildModsContainer();
      const label = container.querySelector('input[value="inflammation"]')!.closest("label")!;
      label.classList.add("hidden");

      syncInflammationModVisibility(container, "no-tooth-after-extraction");
      expect(label.classList.contains("hidden")).toBe(false);
    });

    it("hides inflammation for tooth-under-gum (retained/impacted)", () => {
      const container = buildModsContainer();
      const label = container.querySelector('input[value="inflammation"]')!.closest("label")!;

      syncInflammationModVisibility(container, "tooth-under-gum");
      expect(label.classList.contains("hidden")).toBe(true);
    });

    it("handles null container gracefully", () => {
      expect(() => syncInflammationModVisibility(null, "tooth-base")).not.toThrow();
    });

    it("handles missing inflammation checkbox gracefully", () => {
      const container = buildModsContainer(true, false);
      expect(() => syncInflammationModVisibility(container, "tooth-base")).not.toThrow();
    });

    it("falls back to parentElement when closest('label') returns null", () => {
      const container = document.createElement("div");
      const wrapper = document.createElement("div");
      const inp = document.createElement("input");
      inp.type = "checkbox";
      inp.value = "inflammation";
      wrapper.appendChild(inp);
      container.appendChild(wrapper);

      syncInflammationModVisibility(container, "tooth-base");
      expect(wrapper.classList.contains("hidden")).toBe(true);

      syncInflammationModVisibility(container, "none");
      expect(wrapper.classList.contains("hidden")).toBe(false);
    });

    it("toggles correctly across repeated sequential state changes", () => {
      const container = buildModsContainer();
      const label = container.querySelector('input[value="inflammation"]')!.closest("label")!;

      syncInflammationModVisibility(container, "tooth-base");
      expect(label.classList.contains("hidden")).toBe(true);

      syncInflammationModVisibility(container, "none");
      expect(label.classList.contains("hidden")).toBe(false);

      syncInflammationModVisibility(container, "implant");
      expect(label.classList.contains("hidden")).toBe(true);

      syncInflammationModVisibility(container, "no-tooth-after-extraction");
      expect(label.classList.contains("hidden")).toBe(false);

      syncInflammationModVisibility(container, "tooth-base");
      expect(label.classList.contains("hidden")).toBe(true);
    });

    it("__syncInflammationModVisibilityForTest delegates directly", () => {
      const container = buildModsContainer();
      const label = container.querySelector('input[value="inflammation"]')!.closest("label")!;

      __syncInflammationModVisibilityForTest(container, "tooth-base");
      expect(label.classList.contains("hidden")).toBe(true);

      __syncInflammationModVisibilityForTest(container, "none");
      expect(label.classList.contains("hidden")).toBe(false);
    });
  });

  describe("syncPeriImplantVisibility", () => {
    it("shows periImplantRow for implant, hides for natural tooth", () => {
      const row = buildPeriImplantRow();

      syncPeriImplantVisibility(row, null, "implant");
      expect(row.classList.contains("hidden")).toBe(false);

      syncPeriImplantVisibility(row, null, "tooth-base");
      expect(row.classList.contains("hidden")).toBe(true);

      syncPeriImplantVisibility(row, null, "none");
      expect(row.classList.contains("hidden")).toBe(true);

      syncPeriImplantVisibility(row, null, "no-tooth-after-extraction");
      expect(row.classList.contains("hidden")).toBe(true);
    });

    it("hides both parodontal and inflammation checkboxes for implant", () => {
      const container = buildModsContainer();
      const paroLabel = container.querySelector('input[value="parodontal"]')!.closest("label")!;
      const inflLabel = container.querySelector('input[value="inflammation"]')!.closest("label")!;

      syncPeriImplantVisibility(null, container, "implant");
      expect(paroLabel.classList.contains("hidden")).toBe(true);
      expect(inflLabel.classList.contains("hidden")).toBe(true);
    });

    it("un-hides both parodontal and inflammation checkboxes for non-implant (blanket rule)", () => {
      const container = buildModsContainer();
      const paroLabel = container.querySelector('input[value="parodontal"]')!.closest("label")!;
      const inflLabel = container.querySelector('input[value="inflammation"]')!.closest("label")!;
      paroLabel.classList.add("hidden");
      inflLabel.classList.add("hidden");

      syncPeriImplantVisibility(null, container, "tooth-base");
      expect(paroLabel.classList.contains("hidden")).toBe(false);
      expect(inflLabel.classList.contains("hidden")).toBe(false);
    });

    it("handles null elements gracefully", () => {
      expect(() => syncPeriImplantVisibility(null, null, "implant")).not.toThrow();
    });

    it("falls back to parentElement when closest('label') returns null", () => {
      const container = document.createElement("div");
      const paroDiv = document.createElement("div");
      const paroInp = document.createElement("input");
      paroInp.type = "checkbox";
      paroInp.value = "parodontal";
      paroDiv.appendChild(paroInp);
      container.appendChild(paroDiv);

      syncPeriImplantVisibility(null, container, "implant");
      expect(paroDiv.classList.contains("hidden")).toBe(true);

      syncPeriImplantVisibility(null, container, "tooth-base");
      expect(paroDiv.classList.contains("hidden")).toBe(false);
    });

    it("__syncPeriImplantVisibilityForTest delegates directly", () => {
      const row = buildPeriImplantRow();
      const container = buildModsContainer();
      const paroLabel = container.querySelector('input[value="parodontal"]')!.closest("label")!;

      __syncPeriImplantVisibilityForTest(row, container, "implant");
      expect(row.classList.contains("hidden")).toBe(false);
      expect(paroLabel.classList.contains("hidden")).toBe(true);

      __syncPeriImplantVisibilityForTest(row, container, "tooth-base");
      expect(row.classList.contains("hidden")).toBe(true);
      expect(paroLabel.classList.contains("hidden")).toBe(false);
    });
  });

  describe("invocation order contract (composition proof)", () => {
    it("ORIGINAL ORDER: syncPeriImplantVisibility then syncInflammationModVisibility produces correct visibility", () => {
      const row = buildPeriImplantRow();
      const container = buildModsContainer();
      const paroLabel = container.querySelector('input[value="parodontal"]')!.closest("label")!;
      const inflLabel = container.querySelector('input[value="inflammation"]')!.closest("label")!;

      // Case 1: Present tooth ("tooth-base")
      syncPeriImplantVisibility(row, container, "tooth-base");
      // Right after syncPeriImplantVisibility, inflLabel is un-hidden by the blanket non-implant rule:
      expect(inflLabel.classList.contains("hidden")).toBe(false);
      // Now syncInflammationModVisibility runs and applies the authoritative present-tooth rule:
      syncInflammationModVisibility(container, "tooth-base");
      expect(row.classList.contains("hidden")).toBe(true);
      expect(paroLabel.classList.contains("hidden")).toBe(false);
      expect(inflLabel.classList.contains("hidden")).toBe(true); // CORRECT: hidden for natural tooth

      // Case 2: Implant ("implant")
      syncPeriImplantVisibility(row, container, "implant");
      syncInflammationModVisibility(container, "implant");
      expect(row.classList.contains("hidden")).toBe(false); // shown
      expect(paroLabel.classList.contains("hidden")).toBe(true);  // hidden
      expect(inflLabel.classList.contains("hidden")).toBe(true);  // hidden

      // Case 3: Missing tooth ("none")
      syncPeriImplantVisibility(row, container, "none");
      syncInflammationModVisibility(container, "none");
      expect(row.classList.contains("hidden")).toBe(true);
      expect(paroLabel.classList.contains("hidden")).toBe(false); // shown
      expect(inflLabel.classList.contains("hidden")).toBe(false); // shown for missing socket

      // Case 4: Extraction socket ("no-tooth-after-extraction")
      syncPeriImplantVisibility(row, container, "no-tooth-after-extraction");
      syncInflammationModVisibility(container, "no-tooth-after-extraction");
      expect(row.classList.contains("hidden")).toBe(true);
      expect(paroLabel.classList.contains("hidden")).toBe(false); // shown
      expect(inflLabel.classList.contains("hidden")).toBe(false); // shown for extraction socket
    });

    it("REVERSED ORDER: syncInflammationModVisibility then syncPeriImplantVisibility breaks present tooth inflammation visibility", () => {
      const row = buildPeriImplantRow();
      const container = buildModsContainer();
      const inflLabel = container.querySelector('input[value="inflammation"]')!.closest("label")!;

      // On a present natural tooth:
      // 1. syncInflammationModVisibility runs first and hides inflammation:
      syncInflammationModVisibility(container, "tooth-base");
      expect(inflLabel.classList.contains("hidden")).toBe(true);

      // 2. syncPeriImplantVisibility runs second with blanket non-implant rule and clobbers inflammation:
      syncPeriImplantVisibility(row, container, "tooth-base");
      // INCORRECT BEHAVIOR: inflLabel has become visible again because syncPeriImplantVisibility overrode it!
      expect(inflLabel.classList.contains("hidden")).toBe(false);
      // This confirms why syncInflammationModVisibility MUST run AFTER syncPeriImplantVisibility.
    });
  });
});
