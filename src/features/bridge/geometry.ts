import type {
  GetToothState,
  GridRelativeRect,
  RectFor,
  MaterialColor,
  BridgeBar,
} from "./types";
import {
  SADDLE_Y_FRACTION,
  SADDLE_Y_FRACTION_LOWER,
  SADDLE_THICKNESS,
  SADDLE_OVERLAP,
} from "./constants";
import { spanMaterial } from "./detection";

/** Locate the side-view tile for a tooth (the tile that draws the saddle). */
export function sideTile(grid: HTMLElement, toothNo: number): HTMLElement | null {
  return grid.querySelector(
    `.tooth-tile.side-view[data-tooth="${toothNo}"]`,
  ) as HTMLElement | null;
}

/**
 * Resolve a tooth's side-view tile box in grid-relative coordinates, or null if
 * the tile is absent or hidden (zero-sized). Shared by the live overlay and the
 * export pass so both read geometry identically.
 *
 * @param grid - The `#toothGrid` element.
 * @param gridRect - The grid's own `getBoundingClientRect()` (origin).
 * @param toothNo - FDI tooth number.
 */
export function tileRectFor(
  grid: HTMLElement,
  gridRect: { left: number; top: number },
  toothNo: number,
): GridRelativeRect | null {
  const tile = sideTile(grid, toothNo);
  if (!tile) return null;
  const r = tile.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return { x: r.left - gridRect.left, y: r.top - gridRect.top, width: r.width, height: r.height };
}

/**
 * Compute the saddle bars that fill the inter-tile gaps of every span. This is
 * the single source of truth for bar geometry, shared by the live overlay and
 * the export pass.
 *
 * @param spans - Output of `detectBridgeSpans`.
 * @param getState - Reads a tooth's state by FDI number (for material color).
 * @param rectFor - Resolves each tooth's grid-relative tile box.
 * @param materialColor - Resolves a material key to a solid color.
 */
export function computeBridgeBars(
  spans: number[][],
  getState: GetToothState,
  rectFor: RectFor,
  materialColor: MaterialColor,
): BridgeBar[] {
  const bars: BridgeBar[] = [];
  for (const span of spans) {
    const fill = materialColor(spanMaterial(span, getState));
    // Lower-arch tooth numbers are 31-48; first tooth number tells the whole span's arch.
    const isLower = span[0] >= 31;
    const yFraction = isLower ? SADDLE_Y_FRACTION_LOWER : SADDLE_Y_FRACTION;
    for (let i = 0; i < span.length - 1; i++) {
      const a = rectFor(span[i]);
      const b = rectFor(span[i + 1]);
      if (!a || !b) continue;
      if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) continue;
      // Derive left/right rect from actual geometry.
      const leftRect = a.x <= b.x ? a : b;
      const rightRect = a.x <= b.x ? b : a;
      const overlap = Math.min(leftRect.width, rightRect.width) * SADDLE_OVERLAP;
      const x0 = leftRect.x + leftRect.width - overlap;
      const x1 = rightRect.x + overlap;
      const width = x1 - x0;
      if (width <= 0) continue;
      const height = leftRect.height * SADDLE_THICKNESS;
      const midY = leftRect.y + leftRect.height * yFraction;
      bars.push({ x: x0, y: midY - height / 2, width, height, fill });
    }
  }
  return bars;
}
