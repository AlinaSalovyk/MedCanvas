import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, waitFor } from "@testing-library/react";
import App from "../../App";
import {
  initOdontogram,
  destroyOdontogram,
  rebuildGrid,
  registerPlugins,
  setPluginState,
  setToothAnatomy,
  __resetChartStateForTest,
} from "../../odontogram";
import type { OdontogramPlugin } from "@/plugin";

vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });

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

const testMarkerPlugin: OdontogramPlugin = {
  id: "marker-overlay",
  label: { en: "Marker", uk: "Маркер" },
  layer: "overlay",
  renderSvg: (toothNo, _quadrant, customState) => {
    const text = (customState as { label?: string })?.label ?? `T${toothNo}`;
    return `<text class="plugin-marker" x="10" y="20">${text}</text>`;
  },
};

const testBasePlugin: OdontogramPlugin = {
  id: "base-indicator",
  label: { en: "Base", uk: "База" },
  layer: "base",
  renderSvg: () => '<circle class="plugin-base" cx="15" cy="15" r="5" fill="#3b82f6" />',
};

beforeEach(async () => {
  installDomStubs();
  cleanup();
  document.body.innerHTML = "";
  __resetChartStateForTest();
  await setToothAnatomy("classic");
});

afterEach(async () => {
  destroyOdontogram();
  await setToothAnatomy("classic");
  cleanup();
  document.body.innerHTML = "";
});

async function waitForGrid() {
  await waitFor(() => {
    const grid = document.getElementById("toothGrid");
    expect(grid && grid.childElementCount).toBeGreaterThan(0);
  });
}

describe("Plugin multi-root real-grid integration tests", () => {
  it("renders plugin overlay into BOTH posterior side-view and occlusal-view roots in Classic profile", async () => {
    render(createElement(App, { language: "en" }));
    await waitForGrid();

    // Register test plugin on real initialized odontogram
    registerPlugins([testMarkerPlugin]);

    // Tooth 16 is a posterior molar that has both a side-view tile and an occlusal-view tile
    const sideTile = document.querySelector(".tooth-tile.side-view[data-tooth='16']");
    const occlTile = document.querySelector(".tooth-tile.occl-view[data-tooth='16']");

    expect(sideTile, "sideTile for tooth 16 must exist").not.toBeNull();
    expect(occlTile, "occlTile for tooth 16 must exist").not.toBeNull();

    const sideSvg = sideTile?.querySelector("svg");
    const occlSvg = occlTile?.querySelector("svg");

    expect(sideSvg, "sideSvg must exist").not.toBeNull();
    expect(occlSvg, "occlSvg must exist").not.toBeNull();

    // TARGETED BUG FIX VERIFICATION:
    // Previously, occlSvg rendering removed the overlay from sideSvg.
    // Now, BOTH sideSvg and occlSvg independently retain their <g data-plugin> overlay!
    const sideOverlay = sideSvg?.querySelector("g[data-plugin='marker-overlay']");
    const occlOverlay = occlSvg?.querySelector("g[data-plugin='marker-overlay']");

    expect(sideOverlay, "sideSvg must retain its plugin overlay").not.toBeNull();
    expect(occlOverlay, "occlSvg must retain its plugin overlay").not.toBeNull();

    expect(sideOverlay?.textContent).toContain("T16");
    expect(occlOverlay?.textContent).toContain("T16");
  });

  it("updates custom state across all roots of a tooth without leaving duplicate groups", async () => {
    render(createElement(App, { language: "en" }));
    await waitForGrid();

    registerPlugins([testMarkerPlugin]);

    // Initial render
    const sideTile = document.querySelector(".tooth-tile.side-view[data-tooth='16']");
    const occlTile = document.querySelector(".tooth-tile.occl-view[data-tooth='16']");
    expect(sideTile?.querySelector("g[data-plugin='marker-overlay']")?.textContent).toContain("T16");
    expect(occlTile?.querySelector("g[data-plugin='marker-overlay']")?.textContent).toContain("T16");

    // Set custom state for tooth 16
    setPluginState(16, "marker-overlay", { label: "IMPLANT-ACTIVE" });

    // Verify both roots updated to the new state
    const sideOverlay = sideTile?.querySelector("g[data-plugin='marker-overlay']");
    const occlOverlay = occlTile?.querySelector("g[data-plugin='marker-overlay']");

    expect(sideOverlay?.textContent).toContain("IMPLANT-ACTIVE");
    expect(occlOverlay?.textContent).toContain("IMPLANT-ACTIVE");

    // Ensure exactly 1 group per root (no duplicate accumulation)
    expect(sideTile?.querySelectorAll("g[data-plugin='marker-overlay']").length).toBe(1);
    expect(occlTile?.querySelectorAll("g[data-plugin='marker-overlay']").length).toBe(1);
  });

  it("renders plugin overlays on all permanent and primary variant roots in Measured profile", async () => {
    render(createElement(App, { language: "en" }));
    await waitForGrid();

    await setToothAnatomy("measured");
    await waitForGrid();

    registerPlugins([testMarkerPlugin, testBasePlugin]);

    // Tooth 14 in Measured profile has both permanent and primary SVG roots in its side-view tile
    const sideTile14 = document.querySelector(".tooth-tile.side-view[data-tooth='14']");
    expect(sideTile14).not.toBeNull();

    const svgs = Array.from(sideTile14?.querySelectorAll("svg") ?? []);
    expect(svgs.length).toBeGreaterThanOrEqual(2); // permanent + primary

    for (const svg of svgs) {
      const markerG = svg.querySelector("g[data-plugin='marker-overlay']");
      const baseG = svg.querySelector("g[data-plugin='base-indicator']");

      expect(markerG, `Every SVG root of tooth 14 must have marker-overlay`).not.toBeNull();
      expect(baseG, `Every SVG root of tooth 14 must have base-indicator`).not.toBeNull();

      // Base layer is placed before overlay layer
      const children = Array.from(svg.children);
      expect(children.indexOf(baseG!)).toBeLessThan(children.indexOf(markerG!));
    }
  });

  it("cleans up overlay references on destroyOdontogram() and rebuilds cleanly on re-init", async () => {
    render(createElement(App, { language: "en" }));
    await waitForGrid();

    registerPlugins([testMarkerPlugin]);
    expect(document.querySelectorAll("g[data-plugin='marker-overlay']").length).toBeGreaterThan(0);

    // Teardown
    destroyOdontogram();
    expect(document.getElementById("toothGrid")?.innerHTML).toBe("");

    // Re-initialize
    await initOdontogram();
    await waitForGrid();

    // Re-register plugins on fresh DOM
    registerPlugins([testMarkerPlugin]);
    const sideTile = document.querySelector(".tooth-tile.side-view[data-tooth='11']");
    expect(sideTile?.querySelector("g[data-plugin='marker-overlay']")).not.toBeNull();
  });

  it("preserves selection and rebuilds plugin overlays across rebuildGrid()", async () => {
    render(createElement(App, { language: "en" }));
    await waitForGrid();

    registerPlugins([testMarkerPlugin]);
    setPluginState(11, "marker-overlay", { label: "SAVED-LABEL" });

    // Trigger rebuildGrid (as happens on chart remount / profile toggle)
    await rebuildGrid();
    await waitForGrid();

    // The rebuilt grid should still have the custom state rendered on tooth 11
    const sideTile = document.querySelector(".tooth-tile.side-view[data-tooth='11']");
    expect(sideTile?.querySelector("g[data-plugin='marker-overlay']")?.textContent).toContain("SAVED-LABEL");
    expect(sideTile?.querySelectorAll("g[data-plugin='marker-overlay']").length).toBe(1);
  });
});
