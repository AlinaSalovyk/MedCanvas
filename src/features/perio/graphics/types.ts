export type TemplateNo = 11 | 12 | 13 | 14 | 15 | 16 | 17 | 31 | 46;
export type TemplateDocCache = Map<TemplateNo, Document>;

export type IsImplantFn = (toothNo: number) => boolean;
export type PerioArtworkKind = "missing" | "milktooth" | "implant" | "normal";
export type ToothKindFn = (toothNo: number) => PerioArtworkKind;

/** One tooth's horizontal footprint within an arch row (row-local x). */
export interface ArchToothLayout {
  toothNo: number;
  x: number;
  width: number;
}

/** The full geometric layout of one arch row. */
export interface ArchLayout {
  cejY: number;
  totalWidth: number;
  teeth: ArchToothLayout[];
}

export interface PerioCurveSite {
  site?: string;
  pd?: number | null;
  gm?: number | null;
}

export interface CurvePoint {
  x: number;
  y: number;
}

export interface PerioCurveResult {
  cejY: number;
  marginPts: (CurvePoint | null)[];
  pocketPts: (CurvePoint | null)[];
}

export interface OverlayMark {
  x: number;
  y: number;
  kind: "bop" | "plaque" | "pd5" | "pd6" | "heat-shallow" | "heat-moderate" | "heat-deep" | "rt1" | "rt2" | "rt3";
}

export interface PerioOverlaySite {
  x: number;
  pd?: number | null;
  gm?: number | null;
  bop?: boolean;
  cal?: number | null;
}

export type SiteOverlayLayer = "bop" | "pd5" | "pd6";
export type MmHeatBucket = "shallow" | "moderate" | "deep";
export type MmHeatOverlayLayer = "pd" | "cal" | "gr";

export interface PerioPlaqueTooth {
  x: number;
  width: number;
  surfaces: readonly string[];
}

export interface PerioCairoTooth {
  x: number;
  width: number;
  rt: "none" | "rt1" | "rt2" | "rt3";
}

export interface PerioGradeTooth {
  x: number;
  width: number;
  grades: Partial<Record<"mesial" | "distal" | "buccal" | "lingual", 0 | 1 | 2 | 3>>;
}

export interface PerioKgTooth {
  x: number;
  width: number;
  kg: number | null;
}
