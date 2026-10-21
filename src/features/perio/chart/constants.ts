import type { PerioSite, PerioOverlayLayer, PerioRowId } from "@/odontogram";
import type { PerioSummaryData, PerioSiteData } from "./types";

// Width of the sticky left-hand row-label column (px). The arch graphic and
// every number row share ONE CSS grid whose first track is this label column,
// so the tooth columns (tracks 2..N+1) start at the same x in every row.
export const ROW_LABEL_WIDTH = 220;

// Provisional per-tooth column width (px) used until the tooth-template cache
// loads and the real, per-tooth arch-layout widths are applied
// (`applyArchColumns`).
export const PROVISIONAL_COL_WIDTH = 46;

export const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Mirrors `ALL_TEETH` in odontogram.ts (not exported).
// Array-adjacent == visually adjacent within an arch; the two arches never mix.
export const UPPER_ARCH: readonly number[] = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_ARCH: readonly number[] = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

// Canonical MB/B/DB/ML/L/DL subsets
export const BUCCAL_SITES: readonly PerioSite[] = ["MB", "B", "DB"];
export const LINGUAL_SITES: readonly PerioSite[] = ["ML", "L", "DL"];

// The 4 fixed O'Leary plaque-index surfaces
export const PLAQUE_SURFACES: readonly string[] = ["mesial", "distal", "buccal", "lingual"];

// Single-letter surface tag shown as a faint watermark behind each marker square
export const SURFACE_LETTER: Record<string, string> = { mesial: "M", distal: "D", buccal: "B", lingual: "L" };

// Glickman furcation grade -> Roman-numeral face on the cycle control
export const FURCATION_ROMAN = ["–", "I", "II", "III", "IV"];

// cejVisibility / rootConcavity cycle-button value order + compact face glyphs
export const CEJ_VISIBILITY_CYCLE: readonly string[] = ["none", "detectable", "not-detectable"];
export const CEJ_VISIBILITY_FACE: Record<string, string> = { none: "–", detectable: "D", "not-detectable": "ND" };
export const ROOT_CONCAVITY_CYCLE: readonly string[] = ["none", "mild", "deep"];
export const ROOT_CONCAVITY_FACE: Record<string, string> = { none: "–", mild: "Mi", deep: "Dp" };

// gingivalThickness (GT) / millerClass cycle-button value order + compact face glyphs
export const GINGIVAL_THICKNESS_CYCLE: readonly string[] = ["unknown", "thin", "medium", "thick"];
export const GINGIVAL_THICKNESS_FACE: Record<string, string> = { unknown: "–", thin: "Tn", medium: "Md", thick: "Tk" };
export const MILLER_CLASS_CYCLE: readonly string[] = ["none", "i", "ii", "iii", "iv"];
export const MILLER_CLASS_FACE: Record<string, string> = { none: "–", i: "I", ii: "II", iii: "III", iv: "IV" };

// PI/GI per-surface graded (0-3) cycle face
export const GRADE_FACE: readonly string[] = ["–", "1", "2", "3"];

export const EMPTY_PERIO: PerioSiteData = { pd: {}, gm: {}, bop: [], sup: [] };
export const EMPTY_SUMMARY: PerioSummaryData = {
  chartedSites: 0,
  bleedingSites: 0,
  bopPercent: 0,
  worstCal: null,
  worstCalTooth: null,
  maxPd: null,
  avgPd: null,
  avgCal: null,
  maxFurcation: null,
  plaquePercent: 0,
  piScore: null,
  giScore: null,
  kgDeficientTeeth: 0,
  gtDistribution: { thin: 0, medium: 0, thick: 0 },
  millerDistribution: { i: 0, ii: 0, iii: 0, iv: 0 },
  mpiScore: null,
  mbiScore: null,
};

// Allowance subtracted from the measured scroll container width before fitting columns
export const GRID_SCROLLBAR_ALLOWANCE = 2;

// The overlay layers offered by the switch row, in display order
export const SWITCHER_LAYERS: readonly PerioOverlayLayer[] = [
  "none", "pd", "cal", "gr", "cairo", "kg", "bop", "plaque", "pi", "gi", "mpi", "mbi", "pd5", "pd6",
];

// The subset of overlay layers that correspond 1:1 to a toggleable Dental Chart index row
export const OVERLAY_LAYER_TO_ROW: Partial<Record<PerioOverlayLayer, PerioRowId>> = {
  pd: "pd",
  cal: "cal",
  bop: "bop",
  plaque: "plaque",
  pi: "pi",
  gi: "gi",
  kg: "kg",
  mpi: "mpi",
  mbi: "mbi",
};
