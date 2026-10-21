import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  applyPluginOverlays,
  insertPluginGroup,
  type PluginOverlayContext,
  type PluginOverlayRegistry,
} from "@/engine/overlays/pluginOverlayRenderer";
import type { OdontogramPlugin } from "@/plugin";

describe("pluginOverlayRenderer module", () => {
  let svg: SVGSVGElement;
  let overlays: PluginOverlayRegistry;

  beforeEach(() => {
    document.body.innerHTML = "";
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    document.body.appendChild(svg);
    overlays = new Map();
  });

  describe("A. Early returns & guard conditions", () => {
    it("is a no-op when plugins list is empty", () => {
      const ctx: PluginOverlayContext = {
        plugins: [],
        roots: [svg],
        state: null,
        overlays,
      };

      applyPluginOverlays(16, ctx);
      expect(svg.querySelectorAll("g[data-plugin]").length).toBe(0);
      expect(overlays.size).toBe(0);
    });

    it("is a no-op when roots is undefined or empty", () => {
      const plugin: OdontogramPlugin = {
        id: "p1",
        label: { en: "P1" },
        layer: "overlay",
        renderSvg: () => '<circle cx="5" cy="5" r="3" fill="blue" />',
      };

      const ctxNull: PluginOverlayContext = {
        plugins: [plugin],
        roots: undefined,
        state: null,
        overlays,
      };
      applyPluginOverlays(16, ctxNull);
      expect(overlays.size).toBe(0);

      const ctxEmpty: PluginOverlayContext = {
        plugins: [plugin],
        roots: [],
        state: null,
        overlays,
      };
      applyPluginOverlays(16, ctxEmpty);
      expect(overlays.size).toBe(0);
    });
  });

  describe("B. Plugin SVG rendering, attributes, and customState", () => {
    it("renders valid SVG markup with data-plugin and data-layer attributes", () => {
      const renderSpy = vi.fn().mockReturnValue('<circle cx="10" cy="10" r="4" fill="red" />');
      const plugin: OdontogramPlugin = {
        id: "marker-plugin",
        label: { en: "Marker" },
        layer: "overlay",
        renderSvg: renderSpy,
      };

      const customState = { color: "red", active: true };
      const ctx: PluginOverlayContext = {
        plugins: [plugin],
        roots: [svg],
        state: { customStates: { "marker-plugin": customState } },
        overlays,
      };

      // Tooth 16 is in Quadrant 1
      applyPluginOverlays(16, ctx);

      expect(renderSpy).toHaveBeenCalledWith(16, 1, customState);

      const g = svg.querySelector("g[data-plugin='marker-plugin']");
      expect(g).not.toBeNull();
      expect(g?.getAttribute("data-plugin")).toBe("marker-plugin");
      expect(g?.getAttribute("data-layer")).toBe("overlay");
      expect(g?.innerHTML).toContain("<circle");
      expect(g?.innerHTML).toContain('fill="red"');

      // Overlay map entry updated
      const toothMap = overlays.get(16);
      expect(toothMap).toBeDefined();
      expect(toothMap?.get("marker-plugin")?.get(svg)).toBe(g);
    });

    it("passes undefined to renderSvg when customState is absent", () => {
      const renderSpy = vi.fn().mockReturnValue('<rect width="10" height="10" fill="green" />');
      const plugin: OdontogramPlugin = {
        id: "rect-plugin",
        label: { en: "Rect" },
        layer: "restoration",
        renderSvg: renderSpy,
      };

      const ctx: PluginOverlayContext = {
        plugins: [plugin],
        roots: [svg],
        state: { customStates: {} },
        overlays,
      };

      // Tooth 41 is in Quadrant 4
      applyPluginOverlays(41, ctx);

      expect(renderSpy).toHaveBeenCalledWith(41, 4, undefined);
      const g = svg.querySelector("g[data-plugin='rect-plugin']");
      expect(g?.getAttribute("data-layer")).toBe("restoration");
    });
  });

  describe("C. Error handling and empty output", () => {
    it("catches renderSvg exceptions and skips the plugin silently", () => {
      const pluginThrow: OdontogramPlugin = {
        id: "throw-plugin",
        label: { en: "Throw" },
        layer: "overlay",
        renderSvg: () => {
          throw new Error("Plugin rendering failed");
        },
      };
      const pluginValid: OdontogramPlugin = {
        id: "valid-plugin",
        label: { en: "Valid" },
        layer: "overlay",
        renderSvg: () => '<circle cx="1" cy="1" r="1" />',
      };

      const ctx: PluginOverlayContext = {
        plugins: [pluginThrow, pluginValid],
        roots: [svg],
        state: null,
        overlays,
      };

      expect(() => applyPluginOverlays(11, ctx)).not.toThrow();

      expect(svg.querySelector("g[data-plugin='throw-plugin']")).toBeNull();
      expect(svg.querySelector("g[data-plugin='valid-plugin']")).not.toBeNull();
    });

    it("skips group creation when renderSvg returns empty, null, or undefined", () => {
      const pNull: OdontogramPlugin = {
        id: "p-null",
        label: { en: "Null" },
        layer: "overlay",
        renderSvg: () => null,
      };
      const pUndef: OdontogramPlugin = {
        id: "p-undef",
        label: { en: "Undef" },
        layer: "overlay",
        renderSvg: () => undefined,
      };
      const pEmpty: OdontogramPlugin = {
        id: "p-empty",
        label: { en: "Empty" },
        layer: "overlay",
        renderSvg: () => "",
      };

      const ctx: PluginOverlayContext = {
        plugins: [pNull, pUndef, pEmpty],
        roots: [svg],
        state: null,
        overlays,
      };

      applyPluginOverlays(21, ctx);
      expect(svg.querySelectorAll("g[data-plugin]").length).toBe(0);
    });
  });

  describe("D. Security sanitization contract", () => {
    it("strips malicious elements and handlers before injecting innerHTML", () => {
      const maliciousPlugin: OdontogramPlugin = {
        id: "xss-plugin",
        label: { en: "Malicious" },
        layer: "overlay",
        renderSvg: () =>
          '<circle cx="10" cy="10" r="5" onload="window.pwned=true" /><script>window.hacked=true</script>',
      };

      const ctx: PluginOverlayContext = {
        plugins: [maliciousPlugin],
        roots: [svg],
        state: null,
        overlays,
      };

      applyPluginOverlays(11, ctx);

      const g = svg.querySelector("g[data-plugin='xss-plugin']");
      expect(g).not.toBeNull();
      expect(g?.innerHTML).toContain("<circle");
      expect(g?.innerHTML).not.toContain("onload");
      expect(g?.innerHTML).not.toContain("<script");
    });

    it("logs a console warning and skips overlay when markup is sanitized to empty", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const pureScriptPlugin: OdontogramPlugin = {
        id: "script-only-plugin",
        label: { en: "Script" },
        layer: "overlay",
        renderSvg: () => "<script>alert(1)</script>",
      };

      const ctx: PluginOverlayContext = {
        plugins: [pureScriptPlugin],
        roots: [svg],
        state: null,
        overlays,
      };

      applyPluginOverlays(11, ctx);

      expect(warnSpy).toHaveBeenCalledWith(
        'odontogram plugin "script-only-plugin": renderSvg() output was fully removed by sanitization — overlay skipped',
      );
      expect(svg.querySelector("g[data-plugin='script-only-plugin']")).toBeNull();
      warnSpy.mockRestore();
    });
  });

  describe("E. Overlay replacement and multiple SVG roots", () => {
    it("removes previous overlay element on re-render", () => {
      let count = 1;
      const plugin: OdontogramPlugin = {
        id: "dynamic-plugin",
        label: { en: "Dynamic" },
        layer: "overlay",
        renderSvg: () => `<text>v${count}</text>`,
      };

      const ctx: PluginOverlayContext = {
        plugins: [plugin],
        roots: [svg],
        state: null,
        overlays,
      };

      applyPluginOverlays(11, ctx);
      const firstG = svg.querySelector("g[data-plugin='dynamic-plugin']");
      expect(firstG?.textContent).toContain("v1");

      count = 2;
      applyPluginOverlays(11, ctx);
      const secondG = svg.querySelector("g[data-plugin='dynamic-plugin']");
      expect(secondG?.textContent).toContain("v2");

      // Verify no duplicate groups left in DOM
      expect(svg.querySelectorAll("g[data-plugin='dynamic-plugin']").length).toBe(1);
    });

    it("renders and retains independent overlays on all SVG roots when a tooth has multiple roots", () => {
      // INTENTIONAL BEHAVIORAL CHANGE (Targeted Clinical Bug Fix):
      // Previously, the single-element-per-plugin registry caused later roots to remove
      // the overlay element inserted into earlier roots, leaving only the last root with an overlay.
      // Now, each SVG root independently receives and retains its own <g data-plugin> overlay.
      const svg2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      document.body.appendChild(svg2);

      const plugin: OdontogramPlugin = {
        id: "multi-root-plugin",
        label: { en: "MultiRoot" },
        layer: "overlay",
        renderSvg: () => '<circle cx="2" cy="2" r="1" />',
      };

      const ctx: PluginOverlayContext = {
        plugins: [plugin],
        roots: [svg, svg2],
        state: null,
        overlays,
      };

      applyPluginOverlays(11, ctx);

      // Both roots retain their distinct overlay group:
      const g1 = svg.querySelector("g[data-plugin='multi-root-plugin']");
      const g2 = svg2.querySelector("g[data-plugin='multi-root-plugin']");

      expect(g1).not.toBeNull();
      expect(g2).not.toBeNull();
      expect(g1).not.toBe(g2); // distinct element instances

      expect(g1?.getAttribute("data-layer")).toBe("overlay");
      expect(g2?.getAttribute("data-layer")).toBe("overlay");

      const pluginMap = overlays.get(11)?.get("multi-root-plugin");
      expect(pluginMap?.get(svg)).toBe(g1);
      expect(pluginMap?.get(svg2)).toBe(g2);
    });

    it("supports three or more SVG roots on the same tooth independently", () => {
      const svg2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const svg3 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      document.body.appendChild(svg2);
      document.body.appendChild(svg3);

      const plugin: OdontogramPlugin = {
        id: "three-root-plugin",
        label: { en: "ThreeRoot" },
        layer: "overlay",
        renderSvg: () => '<rect width="5" height="5" />',
      };

      const ctx: PluginOverlayContext = {
        plugins: [plugin],
        roots: [svg, svg2, svg3],
        state: null,
        overlays,
      };

      applyPluginOverlays(14, ctx);

      const g1 = svg.querySelector("g[data-plugin='three-root-plugin']");
      const g2 = svg2.querySelector("g[data-plugin='three-root-plugin']");
      const g3 = svg3.querySelector("g[data-plugin='three-root-plugin']");

      expect(g1).not.toBeNull();
      expect(g2).not.toBeNull();
      expect(g3).not.toBeNull();

      expect(new Set([g1, g2, g3]).size).toBe(3); // All three are distinct instances
      const pluginMap = overlays.get(14)?.get("three-root-plugin");
      expect(pluginMap?.get(svg)).toBe(g1);
      expect(pluginMap?.get(svg2)).toBe(g2);
      expect(pluginMap?.get(svg3)).toBe(g3);
    });

    it("renders multiple plugins across multiple roots without cross-plugin contamination", () => {
      const svg2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      document.body.appendChild(svg2);

      const pBase: OdontogramPlugin = {
        id: "p-base",
        label: { en: "Base" },
        layer: "base",
        renderSvg: () => '<circle r="5" fill="cyan" />',
      };
      const pOverlay: OdontogramPlugin = {
        id: "p-overlay",
        label: { en: "Overlay" },
        layer: "overlay",
        renderSvg: () => '<text>Label</text>',
      };

      const ctx: PluginOverlayContext = {
        plugins: [pBase, pOverlay],
        roots: [svg, svg2],
        state: null,
        overlays,
      };

      applyPluginOverlays(26, ctx);

      // Both plugins exist on both roots
      expect(svg.querySelector("g[data-plugin='p-base']")).not.toBeNull();
      expect(svg.querySelector("g[data-plugin='p-overlay']")).not.toBeNull();
      expect(svg2.querySelector("g[data-plugin='p-base']")).not.toBeNull();
      expect(svg2.querySelector("g[data-plugin='p-overlay']")).not.toBeNull();

      // Z-order on both roots: base is before overlay
      const root1Children = Array.from(svg.children);
      expect(root1Children.indexOf(svg.querySelector("g[data-plugin='p-base']")!))
        .toBeLessThan(root1Children.indexOf(svg.querySelector("g[data-plugin='p-overlay']")!));

      const root2Children = Array.from(svg2.children);
      expect(root2Children.indexOf(svg2.querySelector("g[data-plugin='p-base']")!))
        .toBeLessThan(root2Children.indexOf(svg2.querySelector("g[data-plugin='p-overlay']")!));
    });

    it("replaces content cleanly on every root when plugin state updates without leaving duplicates", () => {
      const svg2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      document.body.appendChild(svg2);

      const plugin: OdontogramPlugin = {
        id: "state-update-plugin",
        label: { en: "StateUpdate" },
        layer: "overlay",
        renderSvg: (_tn, _q, state) => `<text>${(state as { text?: string })?.text ?? "initial"}</text>`,
      };

      const ctx: PluginOverlayContext = {
        plugins: [plugin],
        roots: [svg, svg2],
        state: { customStates: { "state-update-plugin": { text: "round-1" } } },
        overlays,
      };

      applyPluginOverlays(11, ctx);
      expect(svg.querySelector("g[data-plugin='state-update-plugin']")?.textContent).toBe("round-1");
      expect(svg2.querySelector("g[data-plugin='state-update-plugin']")?.textContent).toBe("round-1");

      // Update state
      ctx.state = { customStates: { "state-update-plugin": { text: "round-2" } } };
      applyPluginOverlays(11, ctx);

      expect(svg.querySelector("g[data-plugin='state-update-plugin']")?.textContent).toBe("round-2");
      expect(svg2.querySelector("g[data-plugin='state-update-plugin']")?.textContent).toBe("round-2");

      // Exactly one group per root (no accumulation)
      expect(svg.querySelectorAll("g[data-plugin='state-update-plugin']").length).toBe(1);
      expect(svg2.querySelectorAll("g[data-plugin='state-update-plugin']").length).toBe(1);
    });

    it("continues rendering other plugins when one plugin throws an error", () => {
      const svg2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      document.body.appendChild(svg2);

      const failingPlugin: OdontogramPlugin = {
        id: "fail-plugin",
        label: { en: "Fail" },
        layer: "overlay",
        renderSvg: () => { throw new Error("Crash"); },
      };
      const healthyPlugin: OdontogramPlugin = {
        id: "healthy-plugin",
        label: { en: "Healthy" },
        layer: "overlay",
        renderSvg: () => '<circle cx="1" cy="1" r="1" />',
      };

      const ctx: PluginOverlayContext = {
        plugins: [failingPlugin, healthyPlugin],
        roots: [svg, svg2],
        state: null,
        overlays,
      };

      expect(() => applyPluginOverlays(11, ctx)).not.toThrow();

      expect(svg.querySelector("g[data-plugin='fail-plugin']")).toBeNull();
      expect(svg2.querySelector("g[data-plugin='fail-plugin']")).toBeNull();
      expect(svg.querySelector("g[data-plugin='healthy-plugin']")).not.toBeNull();
      expect(svg2.querySelector("g[data-plugin='healthy-plugin']")).not.toBeNull();
    });

    it("prunes references to detached/removed roots when roots array changes", () => {
      const svg2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      document.body.appendChild(svg2);

      const plugin: OdontogramPlugin = {
        id: "prune-plugin",
        label: { en: "Prune" },
        layer: "overlay",
        renderSvg: () => '<circle r="3" />',
      };

      const ctx: PluginOverlayContext = {
        plugins: [plugin],
        roots: [svg, svg2],
        state: null,
        overlays,
      };

      applyPluginOverlays(11, ctx);
      const rootMap = overlays.get(11)?.get("prune-plugin");
      expect(rootMap?.has(svg)).toBe(true);
      expect(rootMap?.has(svg2)).toBe(true);

      // Now tooth layout drops svg2 (e.g. view mode toggle or arch layout change)
      ctx.roots = [svg];
      applyPluginOverlays(11, ctx);

      expect(rootMap?.has(svg)).toBe(true);
      expect(rootMap?.has(svg2)).toBe(false); // svg2 pruned from registry!
      expect(svg2.querySelector("g[data-plugin='prune-plugin']")).toBeNull(); // removed from DOM
    });

    it("preserves unrelated tooth overlays when rendering a specific tooth", () => {
      const svgTooth12 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      document.body.appendChild(svgTooth12);

      const plugin: OdontogramPlugin = {
        id: "shared-plugin",
        label: { en: "Shared" },
        layer: "overlay",
        renderSvg: (tn) => `<text>Tooth-${tn}</text>`,
      };

      // First render tooth 12
      applyPluginOverlays(12, {
        plugins: [plugin],
        roots: [svgTooth12],
        state: null,
        overlays,
      });

      expect(svgTooth12.querySelector("g[data-plugin='shared-plugin']")?.textContent).toBe("Tooth-12");

      // Now render tooth 11
      applyPluginOverlays(11, {
        plugins: [plugin],
        roots: [svg],
        state: null,
        overlays,
      });

      // Tooth 12's overlay is completely preserved
      expect(svgTooth12.querySelector("g[data-plugin='shared-plugin']")?.textContent).toBe("Tooth-12");
      expect(svg.querySelector("g[data-plugin='shared-plugin']")?.textContent).toBe("Tooth-11");
    });
  });

  describe("F. insertPluginGroup z-order placement", () => {
    it("inserts base layer before existing elements", () => {
      const existingChild = document.createElementNS("http://www.w3.org/2000/svg", "g");
      existingChild.id = "tooth-base";
      svg.appendChild(existingChild);

      const gBase = document.createElementNS("http://www.w3.org/2000/svg", "g");
      gBase.setAttribute("data-plugin", "base-p");
      gBase.setAttribute("data-layer", "base");

      insertPluginGroup(svg, gBase, "base");

      expect(svg.firstChild).toBe(gBase);
    });

    it("orders multiple plugin layers correctly: base < restoration < overlay", () => {
      const gOverlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
      gOverlay.setAttribute("data-plugin", "p-overlay");
      gOverlay.setAttribute("data-layer", "overlay");

      const gBase = document.createElementNS("http://www.w3.org/2000/svg", "g");
      gBase.setAttribute("data-plugin", "p-base");
      gBase.setAttribute("data-layer", "base");

      const gRestoration = document.createElementNS("http://www.w3.org/2000/svg", "g");
      gRestoration.setAttribute("data-plugin", "p-restoration");
      gRestoration.setAttribute("data-layer", "restoration");

      // Insert in arbitrary order: overlay first, then base, then restoration
      insertPluginGroup(svg, gOverlay, "overlay");
      insertPluginGroup(svg, gBase, "base");
      insertPluginGroup(svg, gRestoration, "restoration");

      const children = Array.from(svg.children);
      expect(children[0]).toBe(gBase); // z=0
      expect(children[1]).toBe(gRestoration); // z=3
      expect(children[2]).toBe(gOverlay); // z=6
    });

    it("falls back to overlay z=6 for unknown layers", () => {
      const gUnknown = document.createElementNS("http://www.w3.org/2000/svg", "g");
      gUnknown.setAttribute("data-plugin", "p-unknown");
      gUnknown.setAttribute("data-layer", "custom-layer");

      const gBase = document.createElementNS("http://www.w3.org/2000/svg", "g");
      gBase.setAttribute("data-plugin", "p-base");
      gBase.setAttribute("data-layer", "base");

      insertPluginGroup(svg, gBase, "base");
      insertPluginGroup(svg, gUnknown, "custom-layer");

      const children = Array.from(svg.children);
      expect(children[0]).toBe(gBase);
      expect(children[1]).toBe(gUnknown);
    });
  });
});
