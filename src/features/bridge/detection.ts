import type { BridgeToothState, GetToothState } from "./types";
import { ARCHES, DEFAULT_MATERIAL_COLORS } from "./constants";

/** Default color resolver used when no `materialColor` dependency is provided. */
export function defaultMaterialColor(material: string): string {
  return DEFAULT_MATERIAL_COLORS[material] ?? "#8a8f98";
}

function isBridgeTooth(s: BridgeToothState | undefined | null): boolean {
  if (!s) return false;
  return s.restorationType === "bridge" || s.bridgePillar === true;
}

/**
 * Derive multi-tooth bridge spans from tooth state.
 *
 * A span is a maximal run of consecutive teeth WITHIN a single arch where each
 * tooth is a bridge tooth (`restorationType === "bridge"` OR `bridgePillar`).
 * Only runs of length >= 2 are returned (an isolated bridge tooth is not a span).
 *
 * @param getState - Reads a tooth's state by FDI number.
 * @returns Arrays of consecutive tooth numbers, each of length >= 2.
 */
export function detectBridgeSpans(getState: GetToothState): number[][] {
  const spans: number[][] = [];
  for (const arch of ARCHES) {
    let run: number[] = [];
    for (const tn of arch) {
      if (isBridgeTooth(getState(tn))) {
        run.push(tn);
      } else {
        if (run.length >= 2) spans.push(run);
        run = [];
      }
    }
    if (run.length >= 2) spans.push(run);
  }
  return spans;
}

/**
 * Pick the material color for a span: prefer the first bridge tooth with an
 * explicit restoration material, then any pillar's material, else "metal".
 */
export function spanMaterial(span: number[], getState: GetToothState): string {
  for (const tn of span) {
    const s = getState(tn);
    if (s && s.restorationType === "bridge" && s.restorationMaterial && s.restorationMaterial !== "none") {
      return s.restorationMaterial;
    }
  }
  for (const tn of span) {
    const s = getState(tn);
    if (s && s.restorationMaterial && s.restorationMaterial !== "none") return s.restorationMaterial;
  }
  return "metal";
}
