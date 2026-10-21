// Characterization tests for engine lifecycle resilience:
// Repeated initialization, repeated destruction, destroy-and-reinitialize sequences,
// React StrictMode double mount/unmount race conditions, initToken cancellation,
// and listener/timer/observer teardown guarantees.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import App from "../../App";
import {
  initOdontogram,
  destroyOdontogram,
  rebuildGrid,
  __resetChartStateForTest,
  getSelectedTeeth,
} from "../../odontogram";
import { activeTooth } from "@/engine/selection";

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

function installDomStubs() {
  window.matchMedia = ((q: string) => ({
    matches: false,
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

async function waitForGrid() {
  await waitFor(() => {
    const grid = document.getElementById("toothGrid");
    expect(grid && grid.childElementCount).toBeGreaterThan(0);
  });
}

function tile(toothNo: number): HTMLElement {
  return document.querySelector(`.tooth-tile.side-view[data-tooth="${toothNo}"]`) as HTMLElement;
}

describe("Engine lifecycle resilience characterization", () => {
  describe("A. Repeated initialization idempotence", () => {
    it("calling initOdontogram() multiple times is an idempotent no-op", async () => {
      render(createElement(App, { language: "en" }));
      await waitForGrid();

      const grid = document.getElementById("toothGrid")!;
      const childCount = grid.childElementCount;
      expect(childCount).toBeGreaterThan(0);

      // Call initOdontogram() again while already initialized
      await initOdontogram();
      await initOdontogram();

      // Child elements and grid structure remain unchanged (not duplicated)
      expect(grid.childElementCount).toBe(childCount);
    });
  });

  describe("B. Repeated destruction idempotence", () => {
    it("calling destroyOdontogram() multiple times is completely safe and throws no errors", async () => {
      render(createElement(App, { language: "en" }));
      await waitForGrid();

      // First teardown
      destroyOdontogram();
      expect(getSelectedTeeth().length).toBe(0);
      expect(activeTooth).toBeNull();

      // Subsequent teardowns must be clean no-ops
      expect(() => {
        destroyOdontogram();
        destroyOdontogram();
      }).not.toThrow();
    });
  });

  describe("C. Destroy and reinitialize round-trip", () => {
    it("engine fully recovers after destroyOdontogram() and rebuilds a functional grid", async () => {
      render(createElement(App, { language: "en" }));
      await waitForGrid();

      // Select tooth 16 on first mount
      fireEvent.click(tile(16));
      expect(getSelectedTeeth()).toContain(16);
      expect(activeTooth).toBe(16);

      // Teardown
      destroyOdontogram();
      expect(getSelectedTeeth().length).toBe(0);
      expect(activeTooth).toBeNull();
      const grid = document.getElementById("toothGrid")!;
      expect(grid.innerHTML).toBe("");

      // Re-initialize
      await initOdontogram();
      await waitForGrid();

      // Rebuilt grid is fully interactive: clicking tooth 11 works
      expect(grid.childElementCount).toBeGreaterThan(0);
      fireEvent.click(tile(11));
      expect(getSelectedTeeth()).toContain(11);
      expect(activeTooth).toBe(11);
      expect(tile(11).classList.contains("active")).toBe(true);
    });
  });

  describe("D. StrictMode mount/unmount/mount race handling", () => {
    it("handles rapid mount -> unmount -> mount without stale in-flight token collisions", async () => {
      // Build a container with toothGrid
      const root = document.createElement("div");
      root.id = "toothGrid";
      document.body.appendChild(root);

      // Start first init (in-flight async)
      const p1 = initOdontogram();

      // Immediately destroy (simulating StrictMode unmount effect)
      destroyOdontogram();

      // Immediately re-init (simulating StrictMode second mount effect)
      const p2 = initOdontogram();

      await Promise.all([p1, p2]);
      await waitForGrid();

      const grid = document.getElementById("toothGrid")!;
      expect(grid.childElementCount).toBeGreaterThan(0);

      // Verify tooth 11 was rendered and is interactive
      expect(tile(11)).toBeTruthy();
      fireEvent.click(tile(11));
      expect(getSelectedTeeth()).toContain(11);
    });
  });

  describe("E. Selection preservation across rebuildGrid() without teardown", () => {
    it("rebuildGrid() preserves the active selection across its internal rebuild", async () => {
      render(createElement(App, { language: "en" }));
      await waitForGrid();

      fireEvent.click(tile(16));
      expect(getSelectedTeeth()).toContain(16);
      expect(activeTooth).toBe(16);

      // rebuildGrid preserves selection
      await rebuildGrid();
      await waitForGrid();

      expect(getSelectedTeeth()).toContain(16);
      expect(activeTooth).toBe(16);
      expect(tile(16).classList.contains("active")).toBe(true);
    });
  });
});
