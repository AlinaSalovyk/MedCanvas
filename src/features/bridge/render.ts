import type { BridgeBar, RenderBridgeOverlayDeps, RectFor } from "./types";
import { SVG_NS, BRIDGE_OVERLAY_CLASS, BRIDGE_BAR_CLASS } from "./constants";
import { defaultMaterialColor, detectBridgeSpans } from "./detection";
import { tileRectFor, computeBridgeBars } from "./geometry";

/**
 * Build a saddle-bar `<rect>` SVG element in the current document. Shared by the
 * live overlay and the export path so the two draw identical geometry.
 */
export function barRect(bar: BridgeBar): SVGRectElement {
  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("class", BRIDGE_BAR_CLASS);
  rect.setAttribute("x", String(bar.x));
  rect.setAttribute("y", String(bar.y));
  rect.setAttribute("width", String(bar.width));
  rect.setAttribute("height", String(bar.height));
  const r = Math.min(bar.height / 2, bar.width / 2);
  rect.setAttribute("rx", String(r));
  rect.setAttribute("ry", String(r));
  rect.setAttribute("fill", bar.fill);
  rect.setAttribute("stroke", "#1b3f1c");
  rect.setAttribute("stroke-width", "0.5");
  return rect;
}

/**
 * Ensure a single `<svg class="bridge-overlay">` child of the grid and (re)draw
 * the bridge-span saddle bars into it. Idempotent: clears and redraws on every
 * call. No-op (never throws) when the grid is absent or there are no spans.
 */
export function renderBridgeOverlay(deps: RenderBridgeOverlayDeps): void {
  const { grid } = deps;
  if (!grid) return;
  const materialColor = deps.materialColor ?? defaultMaterialColor;

  let overlay = grid.querySelector(
    `:scope > svg.${BRIDGE_OVERLAY_CLASS}`,
  ) as SVGSVGElement | null;

  const spans = detectBridgeSpans(deps.getState);
  if (spans.length === 0) {
    if (overlay) {
      while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
    }
    return;
  }

  const gridRect = grid.getBoundingClientRect();
  const rectFor: RectFor = (toothNo) => tileRectFor(grid, gridRect, toothNo);

  const bars = computeBridgeBars(spans, deps.getState, rectFor, materialColor);

  if (!overlay) {
    overlay = document.createElementNS(SVG_NS, "svg");
    overlay.setAttribute("class", BRIDGE_OVERLAY_CLASS);
    overlay.setAttribute("aria-hidden", "true");
    grid.appendChild(overlay);
  }
  while (overlay.firstChild) overlay.removeChild(overlay.firstChild);

  const W = Math.max(1, Math.round(gridRect.width));
  const H = Math.max(1, Math.round(gridRect.height));
  overlay.setAttribute("width", String(W));
  overlay.setAttribute("height", String(H));
  overlay.setAttribute("viewBox", `0 0 ${W} ${H}`);

  for (const bar of bars) {
    overlay.appendChild(barRect(bar));
  }
}
