/** Which PDF sections the user opted into. */
export interface PdfExportOptions {
  patientData: boolean;
  odontogramChart: boolean;
  odontogramDescription: boolean;
  individualNotes: boolean;
  perioStatus: boolean;
  perioDescription: boolean;
}

/** Minimal case-identity shape the PDF header needs (patient name + exam date). */
export interface PdfCaseIdentity {
  patientName: string | null;
  patientDob: string | null;
  examDate: string | null;
}

/** A labelled key/value pair rendered as one row of a colored table. */
export interface PdfRow {
  label: string;
  value: string;
}

/** One abbreviation-glossary entry (bold term + description). */
export interface PdfAbbrev {
  term: string;
  desc: string;
}

/** Grouped dentition table. Tooth numbers are coloured/emphasized by status. */
export interface PdfToothTableCell {
  toothNo: number;
  label: string;
  status: "empty" | "content" | "problem";
}

export interface PdfToothTable {
  columns: { key: string; label: string }[];
  rows: { key: string; label: string; cells: Record<string, PdfToothTableCell[]> }[];
  legend: string;
}

/** End-of-document footer — medical disclaimer + generation/version stamp with attribution links. */
export interface PdfFooter {
  disclaimer: string;
  generated: string;
  repoUrl: string;
  doi: string;
}

/** Pixel dimensions of a rasterized chart. */
export interface PdfImageSize {
  width: number;
  height: number;
}

export type RGB = readonly [number, number, number];

export interface PdfPalette {
  header: RGB;
  headerText: RGB;
  labelBg: RGB;
  rowBg: RGB;
  rowAlt: RGB;
  border: RGB;
  text: RGB;
  muted: RGB;
}

export type PdfColorTheme = "blue" | "teal" | "amber" | "slate";

export const PDF_PALETTES: Record<PdfColorTheme, PdfPalette> = {
  blue:  { header: [37, 99, 235],  headerText: [255, 255, 255], labelBg: [219, 234, 254], rowBg: [255, 255, 255], rowAlt: [244, 248, 253], border: [199, 210, 224], text: [15, 23, 42], muted: [51, 65, 85] },
  teal:  { header: [13, 148, 136], headerText: [255, 255, 255], labelBg: [204, 251, 241], rowBg: [255, 255, 255], rowAlt: [240, 253, 250], border: [178, 213, 207], text: [12, 34, 31], muted: [47, 79, 74] },
  amber: { header: [180, 83, 9],   headerText: [255, 255, 255], labelBg: [254, 243, 199], rowBg: [255, 255, 255], rowAlt: [255, 251, 235], border: [228, 214, 180], text: [41, 30, 12], muted: [92, 71, 40] },
  slate: { header: [51, 65, 85],   headerText: [255, 255, 255], labelBg: [226, 232, 240], rowBg: [255, 255, 255], rowAlt: [248, 250, 252], border: [203, 213, 225], text: [15, 23, 42], muted: [71, 85, 105] },
};

export const DEFAULT_PDF_THEME: PdfColorTheme = "blue";
export const C_PROBLEM: RGB = [190, 40, 40];

export const MARGIN_MM = 15;
export const LINE_HEIGHT_MM = 6;
export const DEFAULT_IMAGE_ASPECT = 0.55;

/** Pre-rendered input for assemblePdf. */
export interface PdfAssembleData {
  hasPerio: boolean;
  reportTitle: string;
  footer: PdfFooter;
  palette: PdfPalette;
  patient: PdfRow[];
  odontogramPng: string;
  odontogramCaption: string;
  toothTable?: PdfToothTable | null;
  odontogramFindings: PdfRow[];
  individualNotes: PdfRow[];
  odontogramImageSize?: PdfImageSize;
  odontogramBorder?: { widthMm: number; color: RGB } | null;
  perioPng: string;
  perioMetrics: PdfRow[];
  perioImageSize?: PdfImageSize;
  abbreviations: PdfAbbrev[];
  fontFamily?: string;
  transformText?: (s: string) => string;
  shapeText?: (s: string) => string;
}

/** The minimal jsPDF surface assemblePdf drives. */
export interface PdfDocLike {
  text: (text: string, x: number, y: number, options?: Record<string, unknown>) => PdfDocLike;
  addImage: (imageData: string, format: string, x: number, y: number, width: number, height: number) => PdfDocLike;
  addPage: (...args: unknown[]) => PdfDocLike;
  setFontSize: (size: number) => PdfDocLike;
  setFont: (fontName: string, fontStyle?: string) => PdfDocLike;
  addFileToVFS?: (fileName: string, data: string) => void;
  addFont?: (fileName: string, fontName: string, fontStyle: string) => void;
  setTextColor: (r: number, g?: number, b?: number) => PdfDocLike;
  setFillColor: (r: number, g?: number, b?: number) => PdfDocLike;
  setDrawColor: (r: number, g?: number, b?: number) => PdfDocLike;
  setLineWidth: (w: number) => PdfDocLike;
  rect: (x: number, y: number, w: number, h: number, style?: string) => PdfDocLike;
  line: (x1: number, y1: number, x2: number, y2: number) => PdfDocLike;
  save: (filename?: string) => void;
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
}
