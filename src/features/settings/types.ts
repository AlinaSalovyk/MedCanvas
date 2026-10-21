import type { ReactNode } from "react";
import type { Language } from "@/i18n/languages";
import type { NumberingSystem } from "@/utils/numbering";
import type {
  PulpDetailLevel,
  SecondaryCariesMode,
  RootCariesMode,
  RadiographicDepthMode,
  ToothDetailLevel,
  SurfaceNotation,
  PerioViewMode,
  PerioRowId,
  PerioIndexNameMode,
  ToothAnatomy,
  PdfSettings,
  PdfDateFormat,
  PdfToothSpacing,
  PdfBorderThickness,
  PdfToothNumberSize,
  PdfPerioLabelPlacement,
  PdfPerioFontSize,
  PdfSummaryGrouping,
} from "@/odontogram";
import type { PdfColorTheme } from "@/perioPdf";
import type {
  ScreenToothSpacing,
  ScreenToothNumberSize,
  SelectionBorderStyle,
} from "@/state/displaySettings";

export type { ScreenToothSpacing, ScreenToothNumberSize, SelectionBorderStyle };

/** Translation function signature (subset of `useI18n`'s `t`). */
export type TFn = (key: string, params?: Record<string, string | number>) => string;

/** Fillings card complexity — "complex" = per-surface grid (default), "simple" = one toggle. */
export type FillingComplexity = "complex" | "simple";

/** The four filling materials whose availability is configurable. */
export const FILLING_MATERIAL_KEYS = ["amalgam", "composite", "gic", "temporary"] as const;

export type SettingsState = {
  numbering: NumberingSystem;
  onNumbering: (value: NumberingSystem) => void;
  language: Language;
  onLanguage: (value: Language) => void;
  isDark: boolean;
  onToggleDark: () => void;
  toothInfo: boolean;
  onToothInfo: (value: boolean) => void;
  exportPng: boolean;
  onExportPng: (value: boolean) => void;
  exportJpg: boolean;
  onExportJpg: (value: boolean) => void;
  exportSvg: boolean;
  onExportSvg: (value: boolean) => void;
  exportPdf: boolean;
  onExportPdf: (value: boolean) => void;
  importStatus: boolean;
  onImportStatus: (value: boolean) => void;
  importFhir: boolean;
  onImportFhir: (value: boolean) => void;
  codingPack: string;
  onDiagnosisCodingPack: (value: string) => void;
  snomedEnabled: boolean;
  onSnomedEnabled: (value: boolean) => void;
  secondaryCariesMode: SecondaryCariesMode;
  onSecondaryCariesMode: (value: SecondaryCariesMode) => void;
  icdas: boolean;
  onIcdas: (value: boolean) => void;
  cariesDepth: boolean;
  onCariesDepth: (value: boolean) => void;
  rootCariesMode: RootCariesMode;
  onRootCariesMode: (value: RootCariesMode) => void;
  radiographicDepthMode: RadiographicDepthMode;
  onRadiographicDepthMode: (value: RadiographicDepthMode) => void;
  selectionColor: string;
  onSelectionColor: (value: string) => void;
  selectionBorderStyle: SelectionBorderStyle;
  onSelectionBorderStyle: (value: SelectionBorderStyle) => void;
  pulpLevel: PulpDetailLevel;
  onPulpLevel: (value: PulpDetailLevel) => void;
  wearDetailLevel: ToothDetailLevel;
  onWearDetailLevel: (value: ToothDetailLevel) => void;
  discolorationDetailLevel: ToothDetailLevel;
  onDiscolorationDetailLevel: (value: ToothDetailLevel) => void;
  surfaceNotation: SurfaceNotation;
  onSurfaceNotation: (value: SurfaceNotation) => void;
  notes: boolean;
  onNotes: (value: boolean) => void;
  planModeAvailable: boolean;
  onPlanModeAvailable: (value: boolean) => void;
  screenToothSpacing: ScreenToothSpacing;
  onScreenToothSpacing: (value: ScreenToothSpacing) => void;
  screenToothNumberSize: ScreenToothNumberSize;
  onScreenToothNumberSize: (value: ScreenToothNumberSize) => void;
  toothAnatomy: ToothAnatomy;
  onToothAnatomy: (value: ToothAnatomy) => void;
  showStatusCard: boolean;
  onShowStatusCard: (value: boolean) => void;
  showOrthoCard: boolean;
  onShowOrthoCard: (value: boolean) => void;
  perioChartAvailable: boolean;
  onPerioChartAvailable: (value: boolean) => void;
  perioViewMode: PerioViewMode;
  onPerioViewMode: (value: PerioViewMode) => void;
  perioRowVisibility: Record<PerioRowId, boolean>;
  onPerioRowVisibility: (id: PerioRowId, visible: boolean) => void;
  perioIndexNameMode: PerioIndexNameMode;
  onPerioIndexNameMode: (value: PerioIndexNameMode) => void;
  fillingDefectEnabled: boolean;
  onFillingDefectEnabled: (value: boolean) => void;
  fillingComplexity: FillingComplexity;
  onFillingComplexity: (value: FillingComplexity) => void;
  fillingMaterials: Record<string, boolean>;
  onFillingMaterial: (material: string, value: boolean) => void;
  fissureSealingEnabled: boolean;
  onFissureSealingEnabled: (value: boolean) => void;
  pdfSettings: PdfSettings;
  onPdfSettings: (patch: Partial<PdfSettings>) => void;
};

/** Context handed to every tab's `render()`. */
export type TabContext = { t: TFn; s: SettingsState };

/** Declarative tab descriptor. */
export type SettingsTab = {
  id: string;
  titleKey: string;
  render: (ctx: TabContext) => ReactNode;
};

export const NUMBERING_OPTIONS: { value: NumberingSystem; labelKey: string }[] = [
  { value: "FDI", labelKey: "numbering.fdi" },
  { value: "UNIVERSAL", labelKey: "numbering.universal" },
  { value: "PALMER", labelKey: "numbering.palmer" },
];

export const LANGUAGE_OPTIONS: { value: Language; labelKey: string }[] = [
  { value: "en", labelKey: "language.en" },
  { value: "uk", labelKey: "language.uk" },
];

export const DIAGNOSIS_CODING_OPTIONS: { value: string; labelKey: string }[] = [
  { value: "none", labelKey: "settings.diagnosisCoding.none" },
  { value: "bno10", labelKey: "settings.diagnosisCoding.bno10" },
  { value: "icd10cm", labelKey: "settings.diagnosisCoding.icd10cm" },
];

export const SECONDARY_OPTIONS: { value: SecondaryCariesMode; labelKey: string }[] = [
  { value: "simple", labelKey: "settings.secondaryCaries.simple" },
  { value: "standard", labelKey: "settings.secondaryCaries.standard" },
  { value: "full", labelKey: "settings.secondaryCaries.full" },
];

export const ROOT_OPTIONS: { value: RootCariesMode; labelKey: string }[] = [
  { value: "simple", labelKey: "settings.rootCaries.simple" },
  { value: "severity", labelKey: "settings.rootCaries.severity" },
];

export const RADIOGRAPHIC_OPTIONS: { value: RadiographicDepthMode; labelKey: string }[] = [
  { value: "off", labelKey: "settings.radiographic.off" },
  { value: "threeLevel", labelKey: "settings.radiographic.threeLevel" },
  { value: "detailed", labelKey: "settings.radiographic.detailed" },
];

export const PULP_OPTIONS: { value: PulpDetailLevel; labelKey: string }[] = [
  { value: "simple", labelKey: "pulp.level.simple" },
  { value: "aae", labelKey: "pulp.level.aae" },
  { value: "latin", labelKey: "pulp.level.latin" },
];

export const TOOTH_DETAIL_OPTIONS: { value: ToothDetailLevel; labelKey: string }[] = [
  { value: "complex", labelKey: "settings.toothDetail.complex" },
  { value: "simple", labelKey: "settings.toothDetail.simple" },
];

export const SURFACE_NOTATION_OPTIONS: { value: SurfaceNotation; labelKey: string }[] = [
  { value: "full", labelKey: "settings.surfaceNotation.full" },
  { value: "simple", labelKey: "settings.surfaceNotation.simple" },
];

export const PERIO_VIEW_MODE_OPTIONS: { value: PerioViewMode; labelKey: string }[] = [
  { value: "toggle", labelKey: "settings.perioViewMode.toggle" },
  { value: "popup", labelKey: "settings.perioViewMode.popup" },
];

export const SCREEN_SPACING_OPTIONS: { value: ScreenToothSpacing; labelKey: string }[] = [
  { value: "wide", labelKey: "settings.screen.spacing.wide" },
  { value: "normal", labelKey: "settings.screen.spacing.normal" },
  { value: "close", labelKey: "settings.screen.spacing.close" },
];

export const SCREEN_NUMBER_SIZE_OPTIONS: { value: ScreenToothNumberSize; labelKey: string }[] = [
  { value: "small", labelKey: "settings.screen.numberSize.small" },
  { value: "normal", labelKey: "settings.screen.numberSize.normal" },
  { value: "xlarge", labelKey: "settings.screen.numberSize.xlarge" },
];

export const TOOTH_ANATOMY_OPTIONS: { value: ToothAnatomy; labelKey: string }[] = [
  { value: "classic", labelKey: "settings.toothAnatomy.classic" },
  { value: "measured", labelKey: "settings.toothAnatomy.measured" },
];

export const SELECTION_BORDER_OPTIONS: { value: SelectionBorderStyle; labelKey: string }[] = [
  { value: "solid", labelKey: "settings.selection.border.solid" },
  { value: "dashed", labelKey: "settings.selection.border.dashed" },
  { value: "dotted", labelKey: "settings.selection.border.dotted" },
];

export const FILLING_COMPLEXITY_OPTIONS: { value: FillingComplexity; labelKey: string }[] = [
  { value: "complex", labelKey: "settings.filling.complexity.complex" },
  { value: "simple", labelKey: "settings.filling.complexity.simple" },
];

export const FILLING_MATERIAL_LABEL_KEYS: Record<string, string> = {
  amalgam: "filling.option.amalgam",
  composite: "filling.option.composite",
  gic: "filling.option.gic",
  temporary: "filling.option.temporary",
};

export const PERIO_INDEX_NAME_MODE_OPTIONS: { value: PerioIndexNameMode; labelKey: string }[] = [
  { value: "translated", labelKey: "settings.perioIndexNameMode.translated" },
  { value: "canonical", labelKey: "settings.perioIndexNameMode.canonical" },
];

export const PERIO_ROW_GROUPS: { titleKey: string; ids: PerioRowId[] }[] = [
  { titleKey: "settings.perio.group.pocket", ids: ["pd", "gm", "cal", "bop"] },
  { titleKey: "settings.perio.group.hygiene", ids: ["plaque", "pi", "gi"] },
  { titleKey: "settings.perio.group.mucogingival", ids: ["cej", "rootConcavity", "kg", "gt"] },
  { titleKey: "settings.perio.group.support", ids: ["furcation", "mobility", "miller"] },
  { titleKey: "settings.perio.group.periimplant", ids: ["mpi", "mbi"] },
];

export const PDF_DATE_FORMAT_OPTIONS: { value: PdfDateFormat; labelKey: string }[] = [
  { value: "iso", labelKey: "settings.pdf.dateFormat.iso" },
  { value: "dmy", labelKey: "settings.pdf.dateFormat.dmy" },
  { value: "mdy", labelKey: "settings.pdf.dateFormat.mdy" },
];

export const PDF_COLOR_THEME_OPTIONS: { value: PdfColorTheme; labelKey: string }[] = [
  { value: "blue", labelKey: "settings.pdf.theme.blue" },
  { value: "teal", labelKey: "settings.pdf.theme.teal" },
  { value: "amber", labelKey: "settings.pdf.theme.amber" },
  { value: "slate", labelKey: "settings.pdf.theme.slate" },
];

export const PDF_TOOTH_SPACING_OPTIONS: { value: PdfToothSpacing; labelKey: string }[] = [
  { value: "wide", labelKey: "settings.pdf.spacing.wide" },
  { value: "medium", labelKey: "settings.pdf.spacing.medium" },
  { value: "close", labelKey: "settings.pdf.spacing.close" },
];

export const PDF_BORDER_THICKNESS_OPTIONS: { value: PdfBorderThickness; labelKey: string }[] = [
  { value: "thin", labelKey: "settings.pdf.thickness.thin" },
  { value: "medium", labelKey: "settings.pdf.thickness.medium" },
  { value: "thick", labelKey: "settings.pdf.thickness.thick" },
];

export const PDF_TOOTH_NUMBER_SIZE_OPTIONS: { value: PdfToothNumberSize; labelKey: string }[] = [
  { value: "small", labelKey: "settings.pdf.numberSize.small" },
  { value: "normal", labelKey: "settings.pdf.numberSize.normal" },
  { value: "xlarge", labelKey: "settings.pdf.numberSize.xlarge" },
];

export const PDF_SUMMARY_GROUPING_OPTIONS: { value: PdfSummaryGrouping; labelKey: string }[] = [
  { value: "whole", labelKey: "settings.pdf.summaryGrouping.whole" },
  { value: "jaw", labelKey: "settings.pdf.summaryGrouping.jaw" },
  { value: "quadrant", labelKey: "settings.pdf.summaryGrouping.quadrant" },
  { value: "sextant", labelKey: "settings.pdf.summaryGrouping.sextant" },
];

export const PDF_PERIO_PLACEMENT_OPTIONS: { value: PdfPerioLabelPlacement; labelKey: string }[] = [
  { value: "center", labelKey: "settings.pdf.perioPlacement.center" },
  { value: "edge", labelKey: "settings.pdf.perioPlacement.edge" },
];

export const PDF_PERIO_FONT_OPTIONS: { value: PdfPerioFontSize; labelKey: string }[] = [
  { value: "small", labelKey: "settings.pdf.perioFont.small" },
  { value: "normal", labelKey: "settings.pdf.perioFont.normal" },
  { value: "xlarge", labelKey: "settings.pdf.perioFont.xlarge" },
];
