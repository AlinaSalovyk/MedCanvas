/**
 * Bridge Overlay lifecycle management.
 *
 * Owns the bridge-overlay redraw over `#toothGrid`, live tooth-state lookup
 * for bridge spans, and debounced ResizeObserver management.
 *
 * Extracted from `src/odontogram.ts` during Stage 1 decomposition.
 */

import { toothState } from "@/state/chart";
import {
  renderBridgeOverlay,
  defaultMaterialColor,
  type BridgeToothState,
} from "@/bridgeOverlay";
import { $ } from "@/engine/domHelpers";

let bridgeOverlayResizeObserver: ResizeObserver | null = null;
let bridgeOverlayResizeTimer: ReturnType<typeof setTimeout> | null = null;

/** Read a tooth's state as the minimal shape the bridge overlay consumes. */
export function bridgeStateFor(toothNo: number): BridgeToothState | undefined {
  return toothState.get(toothNo) as BridgeToothState | undefined;
}

/** (Re)draw the engine-owned multi-tooth bridge overlay over `#toothGrid`. */
export function updateBridgeOverlay(): void {
  const grid = $("#toothGrid") as HTMLElement | null;
  renderBridgeOverlay({ grid, getState: bridgeStateFor, materialColor: defaultMaterialColor });
}

/** Observe `#toothGrid` and re-run the bridge overlay (debounced) on resize. */
export function setupBridgeOverlayResize(): void {
  if (typeof ResizeObserver === "undefined") return;
  const grid = $("#toothGrid") as HTMLElement | null;
  if (!grid) return;
  teardownBridgeOverlayResize();
  bridgeOverlayResizeObserver = new ResizeObserver(() => {
    if (bridgeOverlayResizeTimer) clearTimeout(bridgeOverlayResizeTimer);
    bridgeOverlayResizeTimer = setTimeout(() => {
      bridgeOverlayResizeTimer = null;
      try {
        updateBridgeOverlay();
      } catch (e) {
        console.error("odontogram bridge overlay resize render failed", e);
      }
    }, 100);
  });
  bridgeOverlayResizeObserver.observe(grid);
}

/** Disconnect the bridge-overlay resize observer and cancel any pending redraw. */
export function teardownBridgeOverlayResize(): void {
  if (bridgeOverlayResizeObserver) {
    bridgeOverlayResizeObserver.disconnect();
    bridgeOverlayResizeObserver = null;
  }
  if (bridgeOverlayResizeTimer) {
    clearTimeout(bridgeOverlayResizeTimer);
    bridgeOverlayResizeTimer = null;
  }
}

/** TEST-ONLY: inspect active resize timer handle. */
export function __getBridgeOverlayResizeTimerForTest(): ReturnType<typeof setTimeout> | null {
  return bridgeOverlayResizeTimer;
}

/** TEST-ONLY: inspect active ResizeObserver instance. */
export function __getBridgeOverlayResizeObserverForTest(): ResizeObserver | null {
  return bridgeOverlayResizeObserver;
}
