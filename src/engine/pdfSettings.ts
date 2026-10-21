import { notifyStateChange } from "@/state/notify";
import { t } from "@/i18n/useI18n";
import { PDF_PALETTES, DEFAULT_PDF_THEME } from "@/perioPdf";
import type {
  PdfSettings,
  PdfDateFormat,
  PdfToothSpacing,
  PdfBorderThickness,
  PdfToothNumberSize,
  PdfPerioLabelPlacement,
  PdfPerioFontSize,
  PdfSummaryGrouping,
} from "@/engine/types";

export const VALID_PDF_DATE_FORMAT = new Set<PdfDateFormat>(["iso", "dmy", "mdy"]);
export const VALID_PDF_TOOTH_SPACING = new Set<PdfToothSpacing>(["wide", "medium", "close"]);
export const VALID_PDF_BORDER_THICKNESS = new Set<PdfBorderThickness>(["thin", "medium", "thick"]);
export const VALID_PDF_TOOTH_NUMBER_SIZE = new Set<PdfToothNumberSize>(["small", "normal", "xlarge"]);
export const VALID_PDF_PERIO_PLACEMENT = new Set<PdfPerioLabelPlacement>(["center", "edge"]);
export const VALID_PDF_PERIO_FONT_SIZE = new Set<PdfPerioFontSize>(["small", "normal", "xlarge"]);
export const VALID_PDF_SUMMARY_GROUPING = new Set<PdfSummaryGrouping>(["whole", "jaw", "quadrant", "sextant"]);
export const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const pdfSettings: PdfSettings = {
  defaultName: "",
  defaultDob: "",
  showAge: true,
  dateFormat: "iso",
  colorTheme: DEFAULT_PDF_THEME,
  showBone: true,
  showHealthyPulp: true,
  toothSpacing: "medium",
  border: false,
  borderThickness: "medium",
  borderColor: "#000000",
  toothNumberSize: "normal",
  includeOdontogramText: true,
  includeOdontogramTable: true,
  perioToothSpacing: "medium",
  perioShowEmptyRows: false,
  perioLabelPlacement: "center",
  perioFontSize: "normal",
  includePerioTable: true,
  includePerioAbbrev: true,
  showDisclaimer: true,
  disclaimerText: "",
  showGenerator: true,
  summaryGrouping: "jaw",
};

export function getPdfSettings(): PdfSettings {
  return { ...pdfSettings };
}

export function setPdfSettings(patch: Partial<PdfSettings>): void {
  let changed = false;
  const setStr = (k: "defaultName" | "defaultDob" | "disclaimerText") => {
    if (typeof patch[k] === "string" && patch[k] !== pdfSettings[k]) {
      pdfSettings[k] = patch[k] as string;
      changed = true;
    }
  };
  const setBool = (
    k:
      | "showAge"
      | "showBone"
      | "showHealthyPulp"
      | "border"
      | "includeOdontogramText"
      | "includeOdontogramTable"
      | "perioShowEmptyRows"
      | "includePerioTable"
      | "includePerioAbbrev"
      | "showDisclaimer"
      | "showGenerator",
  ) => {
    if (typeof patch[k] === "boolean" && patch[k] !== pdfSettings[k]) {
      pdfSettings[k] = patch[k] as boolean;
      changed = true;
    }
  };
  setStr("defaultName");
  setStr("defaultDob");
  setStr("disclaimerText");
  setBool("showAge");
  setBool("showBone");
  setBool("showHealthyPulp");
  setBool("border");
  setBool("includeOdontogramText");
  setBool("includeOdontogramTable");
  setBool("perioShowEmptyRows");
  setBool("includePerioTable");
  setBool("includePerioAbbrev");
  setBool("showDisclaimer");
  setBool("showGenerator");
  if (patch.dateFormat && VALID_PDF_DATE_FORMAT.has(patch.dateFormat) && patch.dateFormat !== pdfSettings.dateFormat) {
    pdfSettings.dateFormat = patch.dateFormat;
    changed = true;
  }
  if (patch.colorTheme && patch.colorTheme in PDF_PALETTES && patch.colorTheme !== pdfSettings.colorTheme) {
    pdfSettings.colorTheme = patch.colorTheme;
    changed = true;
  }
  if (
    patch.toothSpacing &&
    VALID_PDF_TOOTH_SPACING.has(patch.toothSpacing) &&
    patch.toothSpacing !== pdfSettings.toothSpacing
  ) {
    pdfSettings.toothSpacing = patch.toothSpacing;
    changed = true;
  }
  if (
    patch.borderThickness &&
    VALID_PDF_BORDER_THICKNESS.has(patch.borderThickness) &&
    patch.borderThickness !== pdfSettings.borderThickness
  ) {
    pdfSettings.borderThickness = patch.borderThickness;
    changed = true;
  }
  if (
    patch.toothNumberSize &&
    VALID_PDF_TOOTH_NUMBER_SIZE.has(patch.toothNumberSize) &&
    patch.toothNumberSize !== pdfSettings.toothNumberSize
  ) {
    pdfSettings.toothNumberSize = patch.toothNumberSize;
    changed = true;
  }
  if (
    typeof patch.borderColor === "string" &&
    HEX_COLOR.test(patch.borderColor) &&
    patch.borderColor !== pdfSettings.borderColor
  ) {
    pdfSettings.borderColor = patch.borderColor;
    changed = true;
  }
  if (
    patch.perioToothSpacing &&
    VALID_PDF_TOOTH_SPACING.has(patch.perioToothSpacing) &&
    patch.perioToothSpacing !== pdfSettings.perioToothSpacing
  ) {
    pdfSettings.perioToothSpacing = patch.perioToothSpacing;
    changed = true;
  }
  if (
    patch.perioLabelPlacement &&
    VALID_PDF_PERIO_PLACEMENT.has(patch.perioLabelPlacement) &&
    patch.perioLabelPlacement !== pdfSettings.perioLabelPlacement
  ) {
    pdfSettings.perioLabelPlacement = patch.perioLabelPlacement;
    changed = true;
  }
  if (
    patch.perioFontSize &&
    VALID_PDF_PERIO_FONT_SIZE.has(patch.perioFontSize) &&
    patch.perioFontSize !== pdfSettings.perioFontSize
  ) {
    pdfSettings.perioFontSize = patch.perioFontSize;
    changed = true;
  }
  if (
    patch.summaryGrouping &&
    VALID_PDF_SUMMARY_GROUPING.has(patch.summaryGrouping) &&
    patch.summaryGrouping !== pdfSettings.summaryGrouping
  ) {
    pdfSettings.summaryGrouping = patch.summaryGrouping;
    changed = true;
  }
  if (changed) notifyStateChange();
}

/** Reorder an ISO `YYYY-MM-DD` per the PDF date-format setting. Non-ISO input
 *  (e.g. already-empty) is returned unchanged. */
export function formatPdfDate(iso: string, fmt: PdfDateFormat): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  if (fmt === "dmy") return `${d}-${mo}-${y}`;
  if (fmt === "mdy") return `${mo}-${d}-${y}`;
  return `${y}-${mo}-${d}`;
}

/** Whole-years age from two ISO dates (birth → reference). `null` if malformed. */
export function computeAge(dobIso: string, refIso: string): number | null {
  const d = dobIso.split("-").map(Number);
  const r = refIso.split("-").map(Number);
  if (d.length !== 3 || r.length !== 3 || [...d, ...r].some((n) => !Number.isFinite(n))) return null;
  let age = r[0] - d[0];
  if (r[1] < d[1] || (r[1] === d[1] && r[2] < d[2])) age--;
  return age >= 0 && age <= 200 ? age : null;
}

export function pdfPatientRows(
  cm: { patientName: string | null; patientDob: string | null; examDate: string | null },
  settings: Pick<PdfSettings, "defaultName" | "defaultDob" | "showAge" | "dateFormat">,
  todayIso: string,
): Array<{ label: string; value: string }> {
  const notSpecified = t("pdf.field.notSpecified");
  const placeholder = (v: string) => (v.trim() !== "" ? v : null);
  const realName = cm.patientName && cm.patientName.trim() !== "" ? cm.patientName : null;
  const nameVal = realName ?? placeholder(settings.defaultName) ?? notSpecified;
  const realDob = cm.patientDob ?? null;
  const dobIso = realDob ?? placeholder(settings.defaultDob);
  const examIso = cm.examDate ?? todayIso;
  const dobDisp = dobIso ? formatPdfDate(dobIso, settings.dateFormat) : notSpecified;
  const age = realDob ? computeAge(realDob, examIso) : null;
  return [
    { label: t("pdf.field.patientName"), value: nameVal },
    {
      label: t("pdf.field.patientDob"),
      value: settings.showAge && age !== null ? `${dobDisp} (${age})` : dobDisp,
    },
    { label: t("pdf.field.examDate"), value: formatPdfDate(examIso, settings.dateFormat) },
  ];
}

export const __pdfPatientRowsForTest = pdfPatientRows;

// Concrete value maps
export const ODONTO_PACK: Record<PdfToothSpacing, number> = { wide: 0.85, medium: 0.72, close: 0.6 };
export const TOOTH_NUMBER_SCALE: Record<PdfToothNumberSize, number> = { small: 1.5, normal: 2, xlarge: 2.6 };
export const PDF_BORDER_WIDTH_MM: Record<PdfBorderThickness, number> = { thin: 0.3, medium: 0.7, thick: 1.2 };
export const PDF_BORDER_WIDTH_PX: Record<PdfBorderThickness, number> = { thin: 2, medium: 3.5, thick: 6 };

export const PERIO_FONT_SIZE: Record<PdfPerioFontSize, { fontSize: number; rowHeight: number }> = {
  small: { fontSize: 10, rowHeight: 16 },
  normal: { fontSize: 13, rowHeight: 21 },
  xlarge: { fontSize: 16, rowHeight: 26 },
};

export const PERIO_SPACING_GAP: Record<PdfToothSpacing, number> = { wide: 8, medium: 2, close: -2 };
