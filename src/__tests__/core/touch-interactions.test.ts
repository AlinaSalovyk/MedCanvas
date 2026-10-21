// Characterization tests for touch interactions in the odontogram engine:
// short tap (zoom popover), long press (context menu), movement cancellation,
// pinch-to-zoom scaling and snap-back, mobile arch toggle bar, read-only restrictions,
// and teardown cleanup.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import App from "../../App";
import {
  __resetChartStateForTest,
  destroyOdontogram,
  setReadOnly,
  getSelectedTeeth,
} from "../../odontogram";
import { activeTooth } from "@/engine/selection";

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

// Install touch-enabled DOM stubs (pointer: coarse) so isTouchDevice() returns true
// and wires touchstart / touchmove / touchend + arch toggle bar.
function installTouchStubs() {
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
  installTouchStubs();
  cleanup();
  document.body.innerHTML = "";
  __resetChartStateForTest();
});

afterEach(() => {
  destroyOdontogram();
  cleanup();
  document.body.innerHTML = "";
});

async function renderAppWithTouch(props: Record<string, unknown> = {}) {
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

function createTouchEvent(type: string, touches: Array<{ clientX: number; clientY: number }>): TouchEvent {
  return new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches: touches.map((t) => ({ ...t, target: document.body } as unknown as Touch)),
  });
}

describe("Touch interactions characterization", () => {
  describe("A. Short tap opens zoom popover", () => {
    it("short tap on a tooth tile opens the zoom popover with tooth label and action buttons", async () => {
      await renderAppWithTouch();
      const t11 = tile(11);
      expect(t11).toBeTruthy();

      t11.dispatchEvent(createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]));

      // Elapsed time < 500ms (LONG_PRESS_MS)
      t11.dispatchEvent(createTouchEvent("touchend", []));

      const popover = document.querySelector(".odon-zoom-popover");
      expect(popover).toBeTruthy();
      expect(popover?.querySelector(".odon-zoom-title")?.textContent).toContain("11");

      // Verify action buttons exist
      const buttons = Array.from(popover?.querySelectorAll(".odon-zoom-btn") ?? []);
      expect(buttons.length).toBeGreaterThanOrEqual(3); // Select/Deselect, Info, Reset, Close

      // Close button dismisses popover
      const closeBtn = popover?.querySelector(".odon-zoom-close") as HTMLButtonElement;
      expect(closeBtn).toBeTruthy();
      fireEvent.click(closeBtn);
      expect(document.querySelector(".odon-zoom-popover")).toBeNull();
    });

    it("zoom popover Select button toggles selection and updates active tooth", async () => {
      await renderAppWithTouch();
      const t11 = tile(11);

      t11.dispatchEvent(createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]));
      t11.dispatchEvent(createTouchEvent("touchend", []));

      const popover = document.querySelector(".odon-zoom-popover") as HTMLElement;
      expect(popover).toBeTruthy();

      const selectBtn = popover.querySelector(".odon-zoom-btn") as HTMLButtonElement;
      expect(selectBtn.textContent).toContain("Select");

      fireEvent.click(selectBtn);

      expect(getSelectedTeeth()).toContain(11);
      expect(activeTooth).toBe(11);
      expect(document.querySelector(".odon-zoom-popover")).toBeNull();
    });
  });

  describe("B. Long press opens context menu", () => {
    it("long press (> 500ms) on a tooth tile opens the context menu near touch point", async () => {
      await renderAppWithTouch();
      const t11 = tile(11);

      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        t11.dispatchEvent(createTouchEvent("touchstart", [{ clientX: 120, clientY: 200 }]));

        // Advance past LONG_PRESS_MS (500ms)
        vi.advanceTimersByTime(550);

        const ctxMenu = document.querySelector(".odon-ctx-menu") as HTMLElement;
        expect(ctxMenu).toBeTruthy();
        expect(ctxMenu.style.left).toContain("120px");
        expect(ctxMenu.querySelectorAll(".odon-ctx-item").length).toBeGreaterThan(0);

        // Outside click dismisses context menu
        fireEvent.click(document.body);
        expect(document.querySelector(".odon-ctx-menu")).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("touch movement beyond threshold cancels the long-press timer and short-tap popover", async () => {
      await renderAppWithTouch();
      const t11 = tile(11);

      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        t11.dispatchEvent(createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]));

        // Move > TOUCH_MOVE_THRESHOLD (10px)
        t11.dispatchEvent(createTouchEvent("touchmove", [{ clientX: 125, clientY: 100 }]));

        // Advance past long press timer
        vi.advanceTimersByTime(600);
        expect(document.querySelector(".odon-ctx-menu")).toBeNull();

        // Release touch: touchMoved was set, so short tap popover must NOT open
        t11.dispatchEvent(createTouchEvent("touchend", []));
        expect(document.querySelector(".odon-zoom-popover")).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("C. Pinch-to-zoom scaling and snap-back", () => {
    it("two-finger touch on toothGrid activates pinch scaling within [0.5, 3] limits", async () => {
      await renderAppWithTouch();
      const grid = document.getElementById("toothGrid") as HTMLElement;
      expect(grid).toBeTruthy();

      // Touch start with 2 fingers: distance = 100px (100 to 200)
      grid.dispatchEvent(createTouchEvent("touchstart", [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ]));
      expect(grid.classList.contains("odon-pinch-active")).toBe(true);

      // Pinch zoom in: distance = 200px (50 to 250) -> 2x scale
      grid.dispatchEvent(createTouchEvent("touchmove", [
        { clientX: 50, clientY: 100 },
        { clientX: 250, clientY: 100 },
      ]));
      expect(grid.style.transform).toBe("scale(2)");

      // Pinch zoom beyond max limit: distance = 400px -> clamped to scale(3)
      grid.dispatchEvent(createTouchEvent("touchmove", [
        { clientX: 0, clientY: 100 },
        { clientX: 400, clientY: 100 },
      ]));
      expect(grid.style.transform).toBe("scale(3)");

      // End pinch
      grid.dispatchEvent(createTouchEvent("touchend", []));
      // Maintains zoomed scale since scale > 1.1
      expect(grid.style.transform).toBe("scale(3)");
    });

    it("pinch zoom snaps back to 1.0 when near normal scale (0.9 to 1.1)", async () => {
      await renderAppWithTouch();
      const grid = document.getElementById("toothGrid") as HTMLElement;

      grid.dispatchEvent(createTouchEvent("touchstart", [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ]));

      // Move slightly to scale ~1.05
      grid.dispatchEvent(createTouchEvent("touchmove", [
        { clientX: 98, clientY: 100 },
        { clientX: 203, clientY: 100 },
      ]));

      grid.dispatchEvent(createTouchEvent("touchend", []));

      // Snapped back
      expect(grid.style.transform).toBe("");
      expect(grid.classList.contains("odon-pinch-active")).toBe(false);
    });
  });

  describe("D. Mobile Arch toggle bar", () => {
    it("builds the arch toggle bar and toggles odon-arch-upper and odon-arch-lower classes", async () => {
      await renderAppWithTouch();
      const grid = document.getElementById("toothGrid") as HTMLElement;
      const toggleBar = document.querySelector(".odon-arch-toggle");
      expect(toggleBar).toBeTruthy();

      const [btnUpper, btnBoth, btnLower] = Array.from(toggleBar?.querySelectorAll(".odon-arch-btn") ?? []) as HTMLButtonElement[];
      expect(btnUpper).toBeTruthy();
      expect(btnBoth).toBeTruthy();
      expect(btnLower).toBeTruthy();

      // Click Upper: grid receives odon-arch-upper
      fireEvent.click(btnUpper);
      expect(grid.classList.contains("odon-arch-upper")).toBe(true);
      expect(grid.classList.contains("odon-arch-lower")).toBe(false);
      expect(btnUpper.classList.contains("active")).toBe(true);

      // Click Upper again: toggles back to "both"
      fireEvent.click(btnUpper);
      expect(grid.classList.contains("odon-arch-upper")).toBe(false);
      expect(btnBoth.classList.contains("active")).toBe(true);

      // Click Lower: grid receives odon-arch-lower
      fireEvent.click(btnLower);
      expect(grid.classList.contains("odon-arch-lower")).toBe(true);
      expect(btnLower.classList.contains("active")).toBe(true);

      // Click Both: resets
      fireEvent.click(btnBoth);
      expect(grid.classList.contains("odon-arch-lower")).toBe(false);
      expect(btnBoth.classList.contains("active")).toBe(true);
    });
  });

  describe("E. Read-only restrictions and teardown cleanup", () => {
    it("read-only mode blocks tile touchstart and touchend from opening popovers", async () => {
      await renderAppWithTouch();
      setReadOnly(true);

      const t11 = tile(11);
      t11.dispatchEvent(createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]));
      t11.dispatchEvent(createTouchEvent("touchend", []));

      expect(document.querySelector(".odon-zoom-popover")).toBeNull();
      expect(document.querySelector(".odon-ctx-menu")).toBeNull();
    });

    it("destroyOdontogram cleanly cleans up touch state, arch bar, and popovers", async () => {
      await renderAppWithTouch();
      const t11 = tile(11);
      t11.dispatchEvent(createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]));
      t11.dispatchEvent(createTouchEvent("touchend", []));
      expect(document.querySelector(".odon-zoom-popover")).toBeTruthy();

      destroyOdontogram();

      expect(document.querySelector(".odon-arch-toggle")).toBeNull();
      expect(document.querySelector(".odon-zoom-popover")).toBeNull();
      expect(document.querySelector(".odon-ctx-menu")).toBeNull();
    });
  });
});
