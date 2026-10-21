import { type PerioSite } from "@/state/payload";

export const SVG_NS = "http://www.w3.org/2000/svg";

// The two arches in visual left-to-right order.
export const UPPER_ARCH: readonly number[] = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_ARCH: readonly number[] = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

// The buccal and lingual probing sites.
export const BUCCAL_SITES: readonly PerioSite[] = ["MB", "B", "DB"];
export const LINGUAL_SITES: readonly PerioSite[] = ["ML", "L", "DL"];

// The 4 fixed O'Leary surfaces shared by plaque/PI/GI/mPI/mBI.
export const PLAQUE_SURFACES: readonly string[] = ["mesial", "distal", "buccal", "lingual"];
export const SURFACE_LETTER: Record<string, string> = { mesial: "M", distal: "D", buccal: "B", lingual: "L" };

// Compact display faces for categorical/graded rows.
export const FURCATION_ROMAN: readonly string[] = ["–", "I", "II", "III", "IV"];
export const GRADE_FACE: Record<number, string> = { 1: "1", 2: "2", 3: "3" };
export const MOBILITY_FACE: Record<string, string> = { m1: "1", m2: "2", m3: "3" };
export const CEJ_FACE: Record<string, string> = { detectable: "D", "not-detectable": "ND" };
export const ROOT_CONCAVITY_FACE: Record<string, string> = { mild: "Mi", deep: "Dp" };
export const GT_FACE: Record<string, string> = { thin: "Tn", medium: "Md", thick: "Tk" };
export const MILLER_FACE: Record<string, string> = { i: "I", ii: "II", iii: "III", iv: "IV" };

export const LABEL_WIDTH = 150;
export const SECTION_GAP = 6;

export const PERIO_EXPORT_STYLE = `
.perio-curve-cej{ stroke:#e11d48; stroke-width:0.8; opacity:0.85; }
.perio-curve-band{ fill:#3b82f6; fill-opacity:0.18; stroke:none; }
.perio-curve-margin{ fill:none; stroke:#f472b6; stroke-width:0.9; stroke-linejoin:round; stroke-linecap:round; }
.perio-curve-pocket{ fill:none; stroke:#1d4ed8; stroke-width:1.1; stroke-linejoin:round; stroke-linecap:round; }
.perio-mm-line{ stroke:#94a3b8; fill:none; }
.perio-mm-line-minor{ stroke-width:0.35; opacity:0.28; }
.perio-mm-line-major{ stroke-width:0.6; opacity:0.5; }
.perio-mm-label{ fill:#64748b; font-size:5px; font-weight:600; opacity:0.7; dominant-baseline:middle; }
.perio-row-stripe{ fill:#f1f5f9; }
.perio-col-sep{ stroke:#cbd5e1; stroke-width:0.3; opacity:0.55; }
.perio-surface-letter{ fill:#94a3b8; font-weight:700; opacity:0.5; }
`;

export interface PerioExportContext {
  rowHeight: number;
  rowFontSize: number;
  skipEmptyRows: boolean;
  stripeBands: { y: number; w: number }[];
}

/** Trim trailing float noise for readable coordinate strings. */
export function fmt(n: number): string {
  return Number(n.toFixed(3)).toString();
}
