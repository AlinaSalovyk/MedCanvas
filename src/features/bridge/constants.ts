export const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * The two dental arches, in visual left-to-right order (mirrors `ALL_TEETH` in
 * `odontogram.ts`). Array-adjacent == visually adjacent WITHIN an arch. The two
 * arches are scanned independently so a span never joins across the 28|48
 * boundary.
 */
export const UPPER_ARCH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_ARCH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
export const ARCHES: readonly (readonly number[])[] = [UPPER_ARCH, LOWER_ARCH];

// Saddle bar geometry (fractions of the tile box). Shared by the live overlay
// and the export pass so both stay byte-consistent.
/** Vertical center of the saddle bar, as a fraction of tile height (gum line), for an UPPER-arch tile. */
export const SADDLE_Y_FRACTION = 0.72;

/**
 * Vertical center of the saddle bar for a LOWER-arch tile. Lower-arch tiles are
 * rendered rotated 180°, so the anatomically-correct position is the TRUE
 * mirror of the upper value about the tile mid-line: `1 - SADDLE_Y_FRACTION`.
 */
export const SADDLE_Y_FRACTION_LOWER = 1 - SADDLE_Y_FRACTION;

/** Thickness of the saddle bar, as a fraction of tile height. */
export const SADDLE_THICKNESS = 0.09;

/** How far the bar overlaps into each adjacent tile, as a fraction of tile width. */
export const SADDLE_OVERLAP = 0.12;

/**
 * Default material -> solid color map for the saddle bar, mirroring the fill of
 * the per-tooth `{material}-bridge-connector` layers in the tooth SVGs.
 */
export const DEFAULT_MATERIAL_COLORS: Record<string, string> = {
  emax: "#e9e1d2",
  gold: "#ece614",
  gradia: "#55ff98",
  zircon: "#feffbf",
  metal: "#0051bf",
  "metal-ceramic": "#c9ccd1",
  telescope: "#0051bf",
  temporary: "#ffffff",
};

/** The class marking the single engine-owned overlay SVG. */
export const BRIDGE_OVERLAY_CLASS = "bridge-overlay";

/** The class marking each saddle bar rect (live + export). */
export const BRIDGE_BAR_CLASS = "bridge-overlay-bar";
