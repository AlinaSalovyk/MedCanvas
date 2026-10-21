// Characterization tests for popup overlays in the odontogram engine:
// Zoom popover, Context menu, Note editor, Caries depth popup, and Filling defect popup.
// Tests opening, closing, user actions, state mutations, cancellation, outside clicks,
// Escape key handling, and duplicate popup prevention.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import App from "../../App";
import {
  __resetChartStateForTest,
  __setToothStateForTest,
  __setActiveToothForTest,
  __setSelectionForTest,
  destroyOdontogram,
  getStatusChart,
  getSelectedTeeth,
  openCariesDepthPopup,
  openFillingDefectPopup,
} from "../../odontogram";
import { activeTooth } from "@/engine/selection";

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

function installDomStubs() {
  window.matchMedia = ((q: string) => ({
    matches: q.includes("coarse"),
    media: q,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false; },
  })) as unknown as typeof window.matchMedia;

  if (typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver === "undefined") {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}

beforeEach(() => {
  installDomStubs();
  cleanup();
  document.body.innerHTML = "";
  __resetChartStateForTest();
});

afterEach(() => {
  destroyOdontogram();
  cleanup();
  document.body.innerHTML = "";
});

async function renderApp(props: Record<string, unknown> = {}) {
  const result = render(createElement(App, { language: "en", ...props }));
  await waitFor(() => {
    const grid = document.getElementById("toothGrid");
    expect(grid && grid.childElementCount).toBeGreaterThan(0);
  });
  return result;
}

function tile(toothNo: number): HTMLElement {
  return document.querySelector(`.tooth-tile.side-view[data-tooth="${toothNo}"]`) as HTMLElement;
}

function openZoomPopoverForTooth(toothNo: number) {
  const t = tile(toothNo);
  t.dispatchEvent(new TouchEvent("touchstart", {
    bubbles: true,
    cancelable: true,
    touches: [{ clientX: 100, clientY: 100 } as unknown as Touch],
  }));
  t.dispatchEvent(new TouchEvent("touchend", {
    bubbles: true,
    cancelable: true,
    touches: [],
  }));
}

describe("Popups interaction characterization", () => {
  describe("A. Zoom Popover actions", () => {
    it("Info button selects tooth and scrolls controls into view", async () => {
      await renderApp();
      openZoomPopoverForTooth(11);

      const popover = document.querySelector(".odon-zoom-popover") as HTMLElement;
      expect(popover).toBeTruthy();

      const infoBtn = Array.from(popover.querySelectorAll(".odon-zoom-btn"))
        .find((b) => b.textContent?.includes("Details") || b.textContent?.includes("Info")) as HTMLButtonElement;
      expect(infoBtn).toBeTruthy();

      fireEvent.click(infoBtn);

      expect(getSelectedTeeth()).toContain(11);
      expect(activeTooth).toBe(11);
      expect(document.querySelector(".odon-zoom-popover")).toBeNull();
    });

    it("Reset button resets tooth state and closes zoom popover", async () => {
      await renderApp();
      // Set some state on tooth 11 first
      __setToothStateForTest(11, { toothSelection: "implant" });
      expect(getStatusChart().teeth[11].toothSelection).toBe("implant");

      openZoomPopoverForTooth(11);
      const popover = document.querySelector(".odon-zoom-popover") as HTMLElement;
      const resetBtn = popover.querySelector(".odon-zoom-btn.danger") as HTMLButtonElement;
      expect(resetBtn).toBeTruthy();

      fireEvent.click(resetBtn);

      // Reverted to default tooth-base
      expect(getStatusChart().teeth[11].toothSelection).toBe("tooth-base");
      expect(document.querySelector(".odon-zoom-popover")).toBeNull();
    });

    it("clicking the overlay backdrop closes the zoom popover", async () => {
      await renderApp();
      openZoomPopoverForTooth(11);

      const overlay = document.querySelector(".odon-zoom-overlay") as HTMLElement;
      expect(overlay).toBeTruthy();

      // Click on overlay itself (not inside the popover card)
      fireEvent.click(overlay);
      expect(document.querySelector(".odon-zoom-popover")).toBeNull();
    });

    it("Note button opens Note Editor when notes are enabled", async () => {
      await renderApp({ enableNotes: true });
      openZoomPopoverForTooth(11);

      const popover = document.querySelector(".odon-zoom-popover") as HTMLElement;
      const noteBtn = Array.from(popover.querySelectorAll(".odon-zoom-btn"))
        .find((b) => b.textContent?.includes("Note")) as HTMLButtonElement;
      expect(noteBtn).toBeTruthy();

      fireEvent.click(noteBtn);

      // Zoom popover closes and Note popover opens
      expect(document.querySelector(".odon-zoom-popover")).toBeNull();
      expect(document.querySelector(".odon-note-popover")).toBeTruthy();
    });
  });

  describe("B. Context Menu multi-selection", () => {
    it("context menu offers multi-select item when other teeth are already selected", async () => {
      await renderApp();
      // Select tooth 16 first
      __setSelectionForTest([16]);
      __setActiveToothForTest(16);

      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        // Long press on tooth 11
        const t11 = tile(11);
        t11.dispatchEvent(new TouchEvent("touchstart", {
          bubbles: true,
          cancelable: true,
          touches: [{ clientX: 120, clientY: 200 } as unknown as Touch],
        }));
        vi.advanceTimersByTime(550);

        const menu = document.querySelector(".odon-ctx-menu") as HTMLElement;
        expect(menu).toBeTruthy();

        // Must show multi-select affordance
        const items = Array.from(menu.querySelectorAll(".odon-ctx-item"));
        const multiItem = items.find((i) => i.textContent?.toLowerCase().includes("multi") || i.textContent?.includes("selection") || i.textContent?.includes("add"));
        expect(multiItem).toBeTruthy();

        fireEvent.click(multiItem!);

        expect(getSelectedTeeth()).toContain(16);
        expect(getSelectedTeeth()).toContain(11);
        expect(getSelectedTeeth().length).toBe(2);
        expect(document.querySelector(".odon-ctx-menu")).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("C. Note Editor cancellation and backdrop click", () => {
    it("close button ✕ dismisses Note Editor without saving changes", async () => {
      await renderApp({ enableNotes: true });
      __setToothStateForTest(11, { toothSelection: "tooth-base", note: "original" });

      const t11 = tile(11);
      fireEvent.dblClick(t11);

      const popover = document.querySelector(".odon-note-popover") as HTMLElement;
      expect(popover).toBeTruthy();

      const textarea = popover.querySelector("textarea") as HTMLTextAreaElement;
      expect(textarea.value).toBe("original");
      textarea.value = "modified but cancelled";

      const closeBtn = popover.querySelector(".odon-zoom-close") as HTMLButtonElement;
      fireEvent.click(closeBtn);

      expect(document.querySelector(".odon-note-popover")).toBeNull();
      // State note remains original
      expect(getStatusChart().teeth[11].note).toBe("original");
    });

    it("clicking note backdrop dismisses Note Editor without saving", async () => {
      await renderApp({ enableNotes: true });
      __setToothStateForTest(11, { toothSelection: "tooth-base", note: "keep" });

      fireEvent.dblClick(tile(11));
      const backdrop = document.querySelector(".odon-note-backdrop") as HTMLElement;
      expect(backdrop).toBeTruthy();

      const textarea = backdrop.querySelector("textarea") as HTMLTextAreaElement;
      textarea.value = "unsaved draft";

      fireEvent.click(backdrop);

      expect(document.querySelector(".odon-note-popover")).toBeNull();
      expect(getStatusChart().teeth[11].note).toBe("keep");
    });
  });

  describe("D. Caries Depth Popup contextual behavior & dismissal", () => {
    it("primary caries context displays visual depth options and updates cariesSeverity", async () => {
      await renderApp();
      __setToothStateForTest(11, { toothSelection: "tooth-base", caries: ["caries-buccal"] });
      __setSelectionForTest([11]);

      const anchor = document.createElement("div");
      document.body.appendChild(anchor);

      openCariesDepthPopup("buccal", anchor);

      const popup = document.querySelector(".odon-depth-popup") as HTMLElement;
      expect(popup).toBeTruthy();
      expect(popup.textContent).toContain("Caries");

      // Pick an option
      const options = Array.from(popup.querySelectorAll(".odon-depth-option")) as HTMLButtonElement[];
      expect(options.length).toBeGreaterThan(0);

      // Click option (e.g. deep / 6)
      fireEvent.click(options[options.length - 1]);

      expect(getStatusChart().teeth[11].cariesSeverity.buccal).toBeDefined();
      expect(document.querySelector(".odon-depth-popup")).toBeNull();
    });

    it("recurrent caries context (surface has filling) displays CARS options and toggles recurrent caries", async () => {
      await renderApp();
      __setToothStateForTest(11, {
        toothSelection: "tooth-base",
        fillingSurfaces: ["buccal"],
        fillingSurfaceMaterials: { buccal: "composite" },
      });
      __setSelectionForTest([11]);

      const anchor = document.createElement("div");
      document.body.appendChild(anchor);

      openCariesDepthPopup("buccal", anchor);

      const popup = document.querySelector(".odon-depth-popup") as HTMLElement;
      expect(popup).toBeTruthy();
      // Recurrent caries title shown
      expect(popup.textContent?.toLowerCase()).toContain("recurrent");

      const options = Array.from(popup.querySelectorAll(".odon-depth-option")) as HTMLButtonElement[];
      expect(options.length).toBeGreaterThanOrEqual(2);

      // Score > 0 adds recurrent caries
      fireEvent.click(options[1]); // Score 1
      expect(getStatusChart().teeth[11].caries).toContain("caries-buccal");

      // Open again and pick score 0 -> reverts recurrent caries
      openCariesDepthPopup("buccal", anchor);
      const popup2 = document.querySelector(".odon-depth-popup") as HTMLElement;
      const zeroOption = Array.from(popup2.querySelectorAll(".odon-depth-option"))[0] as HTMLButtonElement;
      fireEvent.click(zeroOption);

      expect(getStatusChart().teeth[11].caries).not.toContain("caries-buccal");
      expect(getStatusChart().teeth[11].fillingSurfaces).toContain("buccal");
    });

    it("Escape key dismisses Caries Depth popup", async () => {
      await renderApp();
      __setToothStateForTest(11, { toothSelection: "tooth-base", caries: ["caries-buccal"] });
      __setSelectionForTest([11]);

      const anchor = document.createElement("div");
      document.body.appendChild(anchor);

      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        openCariesDepthPopup("buccal", anchor);
        vi.runAllTimers(); // flush setTimeout for document listener registration

        expect(document.querySelector(".odon-depth-popup")).toBeTruthy();

        fireEvent.keyDown(document, { key: "Escape" });
        expect(document.querySelector(".odon-depth-popup")).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("outside mousedown dismisses Caries Depth popup", async () => {
      await renderApp();
      __setToothStateForTest(11, { toothSelection: "tooth-base", caries: ["caries-buccal"] });
      __setSelectionForTest([11]);

      const anchor = document.createElement("div");
      document.body.appendChild(anchor);

      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        openCariesDepthPopup("buccal", anchor);
        vi.runAllTimers();

        expect(document.querySelector(".odon-depth-popup")).toBeTruthy();

        fireEvent.mouseDown(document.body);
        expect(document.querySelector(".odon-depth-popup")).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("opening a second popup closes the previous one (duplicate prevention)", async () => {
      await renderApp();
      __setToothStateForTest(11, { toothSelection: "tooth-base", caries: ["caries-buccal", "caries-occlusal"] });
      __setSelectionForTest([11]);

      const a1 = document.createElement("div");
      const a2 = document.createElement("div");
      document.body.appendChild(a1);
      document.body.appendChild(a2);

      openCariesDepthPopup("buccal", a1);
      expect(document.querySelectorAll(".odon-depth-popup").length).toBe(1);

      openCariesDepthPopup("occlusal", a2);
      expect(document.querySelectorAll(".odon-depth-popup").length).toBe(1);
    });
  });

  describe("E. Filling Defect Popup behavior & dismissal", () => {
    it("filling defect popup writes structural defect on pick and dismisses", async () => {
      await renderApp();
      __setToothStateForTest(11, {
        toothSelection: "tooth-base",
        fillingSurfaces: ["buccal"],
        fillingSurfaceMaterials: { buccal: "composite" },
      });
      __setSelectionForTest([11]);

      const anchor = document.createElement("div");
      document.body.appendChild(anchor);

      openFillingDefectPopup("buccal", anchor);

      const popup = document.querySelector(".odon-depth-popup") as HTMLElement;
      expect(popup).toBeTruthy();

      const options = Array.from(popup.querySelectorAll(".odon-depth-option")) as HTMLButtonElement[];
      expect(options.length).toBe(4); // none, marginal, fracture, wear

      // Click "fracture" (index 2)
      fireEvent.click(options[2]);

      expect(getStatusChart().teeth[11].fillingDefect.buccal).toBe("fracture");
      expect(document.querySelector(".odon-depth-popup")).toBeNull();
    });

    it("Escape key dismisses Filling Defect popup", async () => {
      await renderApp();
      __setToothStateForTest(11, {
        toothSelection: "tooth-base",
        fillingSurfaces: ["buccal"],
        fillingSurfaceMaterials: { buccal: "composite" },
      });
      __setSelectionForTest([11]);

      const anchor = document.createElement("div");
      document.body.appendChild(anchor);

      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        openFillingDefectPopup("buccal", anchor);
        vi.runAllTimers();

        expect(document.querySelector(".odon-depth-popup")).toBeTruthy();

        fireEvent.keyDown(document, { key: "Escape" });
        expect(document.querySelector(".odon-depth-popup")).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
