import type { OverlayMark } from "./types";

export {
  CLASSIC_CEJ_Y as CEJ_Y,
  CLASSIC_IMPLANT_CEJ_Y as IMPLANT_CEJ_Y,
  CLASSIC_MILKTOOTH_CEJ_Y as MILKTOOTH_CEJ_Y,
} from "@/anatomy/profiles";

export const SVG_NS = "http://www.w3.org/2000/svg";

/** Layers that must NEVER appear in a cloned tooth-base group — only the
 *  tooth's own crown/root outline (`#tooth-base`) belongs in this read-only
 *  chart graphic; gum/bone context, the healthy-pulp glyph, the enamel
 *  "beauty" highlight, and the milk-tooth variant are all odontogram-tile
 *  concerns, not perio-row concerns. */
export const EXCLUDED_TOOTH_BASE_IDS: readonly string[] = [
  "gum-base",
  "bone-base",
  "tooth-healthy-pulp",
  "tooth-base-beauty",
  "milktooth-base",
];

/** Canine (FDI position 3) root-elongation factor — position 3 renders
 *  `scale(1, CANINE_ROOT_SCALE)` anchored at `CEJ_Y`, so the CEJ itself
 *  (the transform's fixed point) never moves — only the crown/root
 *  proportions around it change. `K > 1`; the exact value is a first-pass
 *  aesthetic choice (canines have a visibly longer root than incisors) —
 *  confirm/tune in a browser. */
export const CANINE_ROOT_SCALE = 1.3;

/** Lateral incisor (FDI position 2) width factor — narrower than the
 *  central incisor sharing the same tpl-11 template. */
export const LATERAL_INCISOR_WIDTH_SCALE = 0.8;

/** Row-local y-coordinate the shared CEJ baseline is placed at, for every
 *  tooth in a buccal row (arbitrary but fixed — just needs to leave enough
 *  margin above for the tallest crown and below for the longest root; see
 *  `bandViewBox`'s viewBox sizing). Exported so the curve overlay uses the SAME
 *  baseline the arch teeth are laid out on. */
export const ROW_BASELINE_Y = 40;

/** mm -> pixel (row-local unit) scale for the curve overlay: how far one
 *  millimetre of probing depth / gingival recession moves the curve away from
 *  the CEJ baseline. Chosen so a clinically deep pocket (~10 mm) plus its
 *  recession still lands within the drawn root region below `ROW_BASELINE_Y`
 *  (roots reach row-y ~79, canines ~90) rather than overshooting into the
 *  mirrored palatal band. Named constant, not a magic literal — visual scale
 *  is confirmed in a browser. */
export const PERIO_MM_PX = 3;

/** How many 1-mm guide lines the background mm grid draws below the CEJ
 *  baseline toward the root (n = 1..PERIO_MM_GRID_MAX). 15 mm covers the full
 *  clinical probing-depth range (PD is clamped to 1–15 in the P1 API), so a
 *  charted pocket's curve point always has a numbered guide line to read
 *  against; every 5th line (5/10/15) is emphasized + labelled. */
export const PERIO_MM_GRID_MAX = 15;

/** Row-local x the mm-grid numeric labels ("5"/"10"/"15") are anchored at — a
 *  small left inset so the digits sit at the arch's leading edge rather than
 *  under the teeth. */
export const MM_LABEL_X = 2;

/** Fixed horizontal footprint (template viewBox width + gap) reused as the
 *  per-tooth cursor advance — approximate, uniform spacing. */
export const TOOTH_GAP = 2;

/** Display magnification (px per row-local viewBox unit) the perio chart
 *  renders the teeth at. The arch <svg> carries NO intrinsic pixel size (it
 *  fills its container via CSS `width:100%`, see `buildBandSvg`); the
 *  number-row grid columns are widened by this factor (`applyArchColumns` in
 *  `PerioChart.tsx`), and since the SVG fills the cell those columns span,
 *  every viewBox unit ends up rendered at this scale — so the teeth read larger
 *  while the columns stay locked to them (one shared `archToothLayout`).
 *
 *  `applyArchColumns` no longer uses this FIXED value at runtime — it computes
 *  a per-render `fillScale` via {@link computeFillScale} so the chart fills the
 *  available container width instead of leaving empty space on a wide screen.
 *  This constant remains the reference/floor value (`MIN_FILL_SCALE` below is
 *  set equal to it, so a narrow container reproduces the fixed layout) and is
 *  still exported for modules/tests that reference it as the base display
 *  scale. */
export const PERIO_DISPLAY_SCALE = 1.5;

/** Floor for the dynamic fill-scale — below this the teeth would read
 *  uncomfortably small, so a narrow container instead relies on
 *  `.perio-fullgrid-scroll`'s horizontal scrollbar rather than shrinking
 *  further. Equal to `PERIO_DISPLAY_SCALE` so a narrow/unmeasured container
 *  (including jsdom, which reports `clientWidth === 0`) renders with the fixed
 *  layout. */
export const MIN_FILL_SCALE = PERIO_DISPLAY_SCALE;

/** Ceiling for the dynamic fill-scale — caps how large the teeth/number cells
 *  grow on an ultra-wide monitor so they don't become absurdly oversized. */
export const MAX_FILL_SCALE = 2.6;

/** Vertical padding (row-local units) added above/below a band's own content
 *  in its viewBox, so the deepest crown/root tips (the elongated canine root)
 *  are never clipped. */
export const ARCH_VIEWBOX_PAD = 14;

/**
 * Half-height (row-local units) reserved above/below the shared CEJ baseline
 * for ONE independently-viewBoxed band's own content. The worst-case
 * single-band content span is the position-3 canine's `CANINE_ROOT_SCALE`-
 * elongated root: `CANINE_ROOT_SCALE * (tpl-13 root length)` = `1.3 * (71.0 -
 * CEJ_Y[13])` = `1.3 * 38.6` ≈ 50.2 — comfortably bigger than the tallest
 * crown (`max(CEJ_Y)` ≈ 32.4) and the mm-grid's 15-line reach
 * (`PERIO_MM_GRID_MAX * PERIO_MM_PX` = 45), so a single symmetric half-span
 * safely bounds either band (buccal-flipped or palatal raw — mirror images
 * about `ROW_BASELINE_Y`) without clipping. Rounded up slightly for margin.
 */
export const BAND_CONTENT_HALF_SPAN = 51;

/** Per-kind marker radius (row-local units). BOP dots read small + crisp; the
 *  pocket-threshold heat spots are larger fills; plaque sits between. The
 *  Cairo RT badges scale with severity, mirroring the heat-bucket ramp. */
export const OVERLAY_MARK_RADIUS: Record<OverlayMark["kind"], number> = {
  bop: 2,
  plaque: 2.6,
  pd5: 3.4,
  pd6: 4,
  "heat-shallow": 2.4,
  "heat-moderate": 3.2,
  "heat-deep": 4.2,
  rt1: 2.8,
  rt2: 3.5,
  rt3: 4.2,
};

/** Trim trailing float noise for readable transform strings (purely
 *  cosmetic — does not change the value). */
export function fmt(n: number): string {
  return Number(n.toFixed(3)).toString();
}
