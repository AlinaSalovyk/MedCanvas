import { t } from "@/i18n/useI18n";
import { kebabToCamel } from "@/state/pulpApical";
import { VALID_ROOT_CARIES } from "@/state/payload";
import { SECONDARY_CARS_LABEL_KEY } from "@/engine/constants";
import {
  getIcdasEnabled,
  getSecondaryCariesMode,
  getRootCariesMode,
  getRadiographicDepthMode,
} from "@/engine/sessionSettings";
import type { SecondaryCariesMode, RootCariesMode, RadiographicDepthMode } from "@/engine/types";

/**
 * The three-step VISUAL SEVERITY ramp an ICDAS code renders at: the caries
 * layer's opacity (0.45 / 0.7 / 1.0), the `data-depth` bar/badge, and the
 * coarse three-option picker offered when ICDAS mode is off (2/4/6).
 */
export function icdasTier(code: number): 1 | 2 | 3 {
  return code <= 2 ? 1 : code <= 4 ? 2 : 3;
}

/** The `data-depth` value for the {@link icdasTier} ramp. The middle value is
 *  named "dentin" for historical reasons (it is the coarse picker's middle
 *  option) — it is a severity bucket, not the exported depth. */
export function icdasToThreeLevel(code: number): string {
  const tr = icdasTier(code);
  return tr === 3 ? "deep" : tr === 2 ? "dentin" : "surface";
}

export function getCariesDepthOptions(): Array<{ value: number; label: string; title?: string }> {
  if (getIcdasEnabled()) {
    return [1, 2, 3, 4, 5, 6].map((n) => ({
      value: n,
      label: `${n} — ${t(`icdas.code.${n}`)}`,
      title: t(`icdas.desc.${n}`),
    }));
  }
  return [
    { value: 2, label: t("caries.depth.surface") },
    { value: 4, label: t("caries.depth.dentin") },
    { value: 6, label: t("caries.depth.deep") },
  ];
}

/** CARS-score options for the per-surface secondary-caries picker at a given
 *  granularity mode (defaults to the module setting). simple -> [0,3];
 *  standard -> [0,1,3,6]; full -> [0..6]. Score 0 clears the surface. Pure. */
export function secondaryCariesOptions(
  mode: SecondaryCariesMode = getSecondaryCariesMode(),
): { value: number; label: string }[] {
  const values = mode === "simple" ? [0, 3] : mode === "full" ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 3, 6];
  return values.map((v) => ({ value: v, label: t(SECONDARY_CARS_LABEL_KEY[v]) }));
}

/** Root-caries options at a given mode (defaults to the module setting).
 *  simple -> none / present (present writes the canonical "active-cavitated"
 *  enum — the most-severe value, so simple-mode "present" renders at full
 *  opacity); severity -> the full rootCaries enum. Pure. */
export function rootCariesOptions(mode: RootCariesMode = getRootCariesMode()): { value: string; label: string }[] {
  if (mode === "severity") {
    return Array.from(VALID_ROOT_CARIES).map((v) => ({ value: v, label: t("rootCaries." + kebabToCamel(v)) }));
  }
  return [
    { value: "none", label: t("rootCaries.none") },
    { value: "active-cavitated", label: t("rootCaries.present") },
  ];
}

/** The rootCaries option value to SHOW for a stored value at a given mode
 *  (display-only collapse; never mutates state). */
export function rootCariesDisplayValue(mode: RootCariesMode, stored: string): string {
  if (mode === "simple") return stored && stored !== "none" ? "active-cavitated" : "none";
  return stored || "none";
}

/** Radiographic-depth options at a given mode (defaults to the module setting).
 *  off -> [] (the control is hidden); threeLevel -> none + superficial/middle/
 *  deep buckets (writing the representative E1/D1/D3 codes); detailed -> the
 *  full none/E1/E2/D1/D2/D3 scale. "none" clears the surface. Pure. */
export function radiographicDepthOptions(
  mode: RadiographicDepthMode = getRadiographicDepthMode(),
): { value: string; label: string }[] {
  if (mode === "off") return [];
  if (mode === "threeLevel") {
    return [
      { value: "none", label: t("radiographicDepth.none") },
      { value: "E1", label: t("radiographicDepth.superficial") },
      { value: "D1", label: t("radiographicDepth.middle") },
      { value: "D3", label: t("radiographicDepth.deep") },
    ];
  }
  return ["none", "E1", "E2", "D1", "D2", "D3"].map((v) => ({ value: v, label: t("radiographicDepth." + v) }));
}

/** Set/clear a per-surface CARS secondary-caries score on `map` (score 0 clears). */
export function applySecondaryCariesScore(map: Map<string, number>, surface: string, score: number): void {
  if (score > 0) map.set(surface, score);
  else map.delete(surface);
}

/** The recurrent (secondary) caries transition on a FILLED surface. */
export function applyRecurrentCariesScore(
  state: { caries: Set<string>; cariesSeverity: Map<string, number>; fillingSurfaceMaterials: Map<string, string> },
  surface: string,
  score: number,
): void {
  if (!state.fillingSurfaceMaterials.has(surface)) return;
  const key = `caries-${surface}`;
  if (score > 0) {
    state.caries.add(key);
    state.cariesSeverity.set(surface, score);
  } else {
    state.caries.delete(key);
    state.cariesSeverity.delete(surface);
  }
}

/** Set/clear a per-surface radiographic-depth value on `map` ("none"/empty clears). */
export function applyRadiographicDepth(map: Map<string, string>, surface: string, value: string): void {
  if (value && value !== "none") map.set(surface, value);
  else map.delete(surface);
}

/** Set/clear a per-surface filling-defect value on `map` ("none"/empty clears). */
export function applyFillingDefect(map: Map<string, string>, surface: string, value: string): void {
  if (value && value !== "none") map.set(surface, value);
  else map.delete(surface);
}
