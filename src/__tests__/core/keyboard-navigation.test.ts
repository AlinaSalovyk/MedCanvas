// Characterization tests for keyboard accessibility and navigation in the odontogram engine:
// ArrowLeft/ArrowRight, ArrowUp/ArrowDown, arch crossing, skipping hidden wisdom teeth,
// Enter/Space tooth selection, multi-selection, Escape clearing, and read-only behavior.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import App from "@/App";
import {
  __resetChartStateForTest,
  destroyOdontogram,
  setReadOnly,
  setWisdomVisible,
  getSelectedTeeth,
} from "@/odontogram";
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
  setWisdomVisible(true);
});

afterEach(() => {
  destroyOdontogram();
  cleanup();
  document.body.innerHTML = "";
});

async function renderApp() {
  const result = render(createElement(App, { language: "en" }));
  await waitFor(() => {
    const grid = document.getElementById("toothGrid");
    expect(grid && grid.childElementCount).toBeGreaterThan(0);
  });
  return result;
}

function tile(toothNo: number): HTMLElement {
  return document.querySelector(`.tooth-tile.side-view[data-tooth="${toothNo}"]`) as HTMLElement;
}

describe("Keyboard navigation characterization", () => {
  describe("A. Horizontal arrow navigation (ArrowRight / ArrowLeft)", () => {
    it("ArrowRight navigates left-to-right across teeth in the upper arch", async () => {
      await renderApp();
      const t18 = tile(18);
      t18.focus();
      expect(document.activeElement).toBe(t18);

      // 18 -> 17
      fireEvent.keyDown(t18, { key: "ArrowRight" });
      expect(document.activeElement).toBe(tile(17));

      // 17 -> 16
      fireEvent.keyDown(tile(17), { key: "ArrowRight" });
      expect(document.activeElement).toBe(tile(16));

      // Across midline: 11 -> 21
      tile(11).focus();
      fireEvent.keyDown(tile(11), { key: "ArrowRight" });
      expect(document.activeElement).toBe(tile(21));
    });

    it("ArrowLeft navigates right-to-left across teeth in the upper arch", async () => {
      await renderApp();
      tile(28).focus();
      expect(document.activeElement).toBe(tile(28));

      // 28 -> 27
      fireEvent.keyDown(tile(28), { key: "ArrowLeft" });
      expect(document.activeElement).toBe(tile(27));

      // Across midline: 21 -> 11
      tile(21).focus();
      fireEvent.keyDown(tile(21), { key: "ArrowLeft" });
      expect(document.activeElement).toBe(tile(11));
    });

    it("ArrowRight navigates across teeth in the lower arch (48 -> 47 ... 41 -> 31 ... 38)", async () => {
      await renderApp();
      tile(48).focus();
      fireEvent.keyDown(tile(48), { key: "ArrowRight" });
      expect(document.activeElement).toBe(tile(47));

      tile(41).focus();
      fireEvent.keyDown(tile(41), { key: "ArrowRight" });
      expect(document.activeElement).toBe(tile(31));
    });
  });

  describe("B. Vertical arrow navigation (ArrowDown / ArrowUp)", () => {
    it("ArrowDown navigates from upper arch to corresponding lower arch tooth", async () => {
      await renderApp();
      // Tooth 11 (col 7 in upper arch) -> Tooth 41 (col 7 in lower arch)
      tile(11).focus();
      fireEvent.keyDown(tile(11), { key: "ArrowDown" });
      expect(document.activeElement).toBe(tile(41));

      // Tooth 16 (col 2 in upper arch) -> Tooth 46 (col 2 in lower arch)
      tile(16).focus();
      fireEvent.keyDown(tile(16), { key: "ArrowDown" });
      expect(document.activeElement).toBe(tile(46));
    });

    it("ArrowUp navigates from lower arch to corresponding upper arch tooth", async () => {
      await renderApp();
      // Tooth 41 -> Tooth 11
      tile(41).focus();
      fireEvent.keyDown(tile(41), { key: "ArrowUp" });
      expect(document.activeElement).toBe(tile(11));

      // Tooth 31 -> Tooth 21
      tile(31).focus();
      fireEvent.keyDown(tile(31), { key: "ArrowUp" });
      expect(document.activeElement).toBe(tile(21));
    });
  });

  describe("C. Hidden wisdom teeth skipping", () => {
    it("skips wisdom teeth when setWisdomVisible(false)", async () => {
      await renderApp();
      setWisdomVisible(false);

      // Tooth 18 is now hidden (.wisdom-hidden)
      expect(tile(18).classList.contains("wisdom-hidden")).toBe(true);

      // Focus on 17; pressing ArrowLeft cannot target 18, so focus remains on 17
      tile(17).focus();
      fireEvent.keyDown(tile(17), { key: "ArrowLeft" });
      expect(document.activeElement).toBe(tile(17));

      // Focus on 27; pressing ArrowRight cannot target 28, so focus remains on 27
      tile(27).focus();
      fireEvent.keyDown(tile(27), { key: "ArrowRight" });
      expect(document.activeElement).toBe(tile(27));
    });
  });

  describe("D. Tooth selection via Enter, Space, and Escape", () => {
    it("Enter selects focused tooth and updates active tooth state and tile UI", async () => {
      await renderApp();
      const t16 = tile(16);
      t16.focus();

      fireEvent.keyDown(t16, { key: "Enter" });

      expect(getSelectedTeeth()).toContain(16);
      expect(activeTooth).toBe(16);
      expect(t16.classList.contains("active")).toBe(true);
    });

    it("Space selects focused tooth and replaces prior single selection", async () => {
      await renderApp();
      const t16 = tile(16);
      const t21 = tile(21);

      fireEvent.keyDown(t16, { key: "Enter" });
      expect(getSelectedTeeth()).toContain(16);

      fireEvent.keyDown(t21, { key: " " });
      expect(getSelectedTeeth()).toContain(21);
      expect(getSelectedTeeth()).not.toContain(16);
      expect(activeTooth).toBe(21);
    });

    it("Ctrl+Enter / Meta+Enter adds focused tooth to selection (multi-select)", async () => {
      await renderApp();
      const t16 = tile(16);
      const t21 = tile(21);

      fireEvent.keyDown(t16, { key: "Enter" });
      expect(getSelectedTeeth().length).toBe(1);

      // Multi-select with Ctrl
      fireEvent.keyDown(t21, { key: "Enter", ctrlKey: true });
      expect(getSelectedTeeth()).toContain(16);
      expect(getSelectedTeeth()).toContain(21);
      expect(getSelectedTeeth().length).toBe(2);

      // Toggle off with Ctrl
      fireEvent.keyDown(t21, { key: "Enter", ctrlKey: true });
      expect(getSelectedTeeth()).not.toContain(21);
      expect(getSelectedTeeth()).toContain(16);
      expect(getSelectedTeeth().length).toBe(1);
    });

    it("Escape clears selection", async () => {
      await renderApp();
      const t16 = tile(16);
      fireEvent.keyDown(t16, { key: "Enter" });
      expect(getSelectedTeeth().length).toBe(1);

      fireEvent.keyDown(t16, { key: "Escape" });
      expect(getSelectedTeeth().length).toBe(0);
      expect(activeTooth).toBeNull();
      expect(t16.classList.contains("active")).toBe(false);
    });
  });

  describe("E. Read-only restrictions", () => {
    it("read-only mode ignores keyboard selection and sets tabindex='-1'", async () => {
      await renderApp();
      setReadOnly(true);

      const t16 = tile(16);
      expect(t16.getAttribute("tabindex")).toBe("-1");

      fireEvent.keyDown(t16, { key: "Enter" });
      expect(getSelectedTeeth().length).toBe(0);
      expect(activeTooth).toBeNull();

      setReadOnly(false);
      expect(t16.getAttribute("tabindex")).toBe("0");
    });
  });
});
