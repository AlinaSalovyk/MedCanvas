// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Any = any;

import type { DiagnosisKey } from "@/dx/codes";
import type { PerioSite } from "@/state/payload";
import type { PerioExamComparison } from "@/state/examCompare";
import type { FinalPerioClassification } from "@/fhir/toFhirPerio";
import type { PdfColorTheme } from "@/perioPdf";

export type ToothDetailLevel = "simple" | "complex";
export type SurfaceNotation = "simple" | "full";
export type SecondaryCariesMode = "simple" | "standard" | "full";
export type RootCariesMode = "simple" | "severity";
export type RadiographicDepthMode = "off" | "threeLevel" | "detailed";

export type ActiveOrtho = {
  appliance: string;
  drift: string;
  vertical: string;
  rotation: boolean;
  visible: boolean;
};

export type ActiveCariesSurface = {
  value: string;
  surface: string;
  pos: string;
  letter: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  depth: string;
  icdas: number;
  isIcdas: boolean;
  radio: string | null;
};

export type ActiveCaries = {
  surfaces: ActiveCariesSurface[];
  subcrownChecked: boolean;
  subcrownDisabled: boolean;
  subcrownLabel: string;
  cariesActiveDepth: number;
  rootCariesDisplay: string;
  cariesDepthVisible: boolean;
  rootCariesVisible: boolean;
  cariesSectionVisible: boolean;
};

export type ActiveFillingSurface = {
  value: string;
  surface: string;
  pos: string;
  letter: string;
  label: string;
  labelId: string;
  checked: boolean;
  material: string;
  hasSubcaries: boolean;
  subDepth: string;
  subIcdas: number;
  isIcdas: boolean;
  hasDefect: boolean;
  defectValue: string | null;
};

export type ActiveFillings = {
  surfaces: ActiveFillingSurface[];
  fillingMaterial: string;
  fillingOptions: { value: string; label: string }[];
  surfaceGridVisible: boolean;
  defectDisabled: boolean;
  simpleMode: boolean;
  simpleRowVisible: boolean;
  simpleToggleChecked: boolean;
  simpleDefectRowVisible: boolean;
  simpleDefectValue: string;
  simpleDefectOptions: { value: string; label: string }[];
  fissureSealing: boolean;
  fissureRowVisible: boolean;
  fillingSectionVisible: boolean;
  subcariesSummary: string;
  defectSummary: string;
};

export type RootPerioOption = { value: string; label: string };
export type RootPerioOptGroup = { label: string; options: RootPerioOption[] };

export type ActiveRootPerioMod = {
  value: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  hiddenClass: boolean;
  styleHidden: boolean;
};

export type ActiveRootPerio = {
  sectionVisible: boolean;
  rootBlockVisible: boolean;
  perioBlockVisible: boolean;
  pulpEndoValue: string;
  pulpEndoNoneOption: RootPerioOption | null;
  pulpEndoGroups: RootPerioOptGroup[];
  pulpEndoDisabled: boolean;
  apicalDxValue: string;
  apicalDxOptions: RootPerioOption[];
  apicalDxDisabled: boolean;
  apicalDxRowVisible: boolean;
  periapicalTypeValue: string;
  periapicalTypeOptions: RootPerioOption[];
  periapicalRowVisible: boolean;
  resorptionValue: string;
  resorptionOptions: RootPerioOption[];
  resorptionDisabled: boolean;
  resorptionRowVisible: boolean;
  endoResectionChecked: boolean;
  endoResectionDisabled: boolean;
  parapulpalPinChecked: boolean;
  parapulpalPinDisabled: boolean;
  mobilityValue: string;
  mobilityOptions: RootPerioOption[];
  mobilityDisabled: boolean;
  mobilityRowVisible: boolean;
  perioRowVisible: boolean;
  mods: ActiveRootPerioMod[];
  calculusChecked: boolean;
  calculusRowVisible: boolean;
  periImplantValue: string;
  periImplantOptions: RootPerioOption[];
  periImplantRowVisible: boolean;
};

export type ToothDiagnosis = {
  key: DiagnosisKey;
  icd10: string | null;
  icd10Display: string;
  source: "derived" | "added";
};

export type ActiveDiagnosisRow = {
  key: string;
  icd10: string;
  source: "derived" | "added";
  suppressed: boolean;
};

export type ActiveDiagnoses = {
  visible: boolean;
  rows: ActiveDiagnosisRow[];
  addableKeys: { key: string; icd10: string }[];
};

export type ToothDetailsOption = { value: string; label: string; disabled?: boolean };
export type ExtractionPlanParent = "brokenCrownRow" | "bruxismRow" | "crownActionsRow";

export type ActiveToothDetails = {
  toothSelectValue: string;
  toothSelectOptions: ToothDetailsOption[];
  substrateValue: string;
  substrateOptions: ToothDetailsOption[];
  substrateRowVisible: boolean;
  extractionWoundChecked: boolean;
  extractionRowVisible: boolean;
  missingClosedChecked: boolean;
  missingClosedRowVisible: boolean;
  restorationValue: string;
  restorationOptions: ToothDetailsOption[];
  restorationRowVisible: boolean;
  crownLeakageChecked: boolean;
  crownLeakageRowVisible: boolean;
  brokenMesialChecked: boolean;
  brokenIncisalChecked: boolean;
  brokenDistalChecked: boolean;
  brokenCrownRowVisible: boolean;
  contactMesialChecked: boolean;
  contactDistalChecked: boolean;
  contactPointRowVisible: boolean;
  bruxismRowVisible: boolean;
  wearSimple: boolean;
  wearEdgeValue: string;
  wearEdgeOptions: ToothDetailsOption[];
  wearEdgeToggleChecked: boolean;
  wearCervicalValue: string;
  wearCervicalOptions: ToothDetailsOption[];
  wearCervicalToggleChecked: boolean;
  discolorationRowVisible: boolean;
  discoSimple: boolean;
  discolorationValue: string;
  discolorationOptions: ToothDetailsOption[];
  discolorationToggleChecked: boolean;
  crownActionsRowVisible: boolean;
  bridgePillarChecked: boolean;
  bridgePillarRowVisible: boolean;
  extractionPlanChecked: boolean;
  extractionPlanRowVisible: boolean;
  extractionPlanParent: ExtractionPlanParent;
  crownReplaceChecked: boolean;
  crownReplaceRowVisible: boolean;
  crownNeededChecked: boolean;
  crownNeededRowVisible: boolean;
};

export type PlanChange = { toothNo: number; axis: string; from: string; to: string };

export interface ExamComparison {
  changes: PlanChange[];
  perio: PerioExamComparison;
  classification: { from: FinalPerioClassification; to: FinalPerioClassification };
}

export type PerioCellCoord = { toothNo: number; site: PerioSite; row: "pd" | "gm" };

export type PerioViewMode = "toggle" | "popup";

export type PerioOverlayLayer =
  | "none"
  | "pd"
  | "cal"
  | "gr"
  | "cairo"
  | "kg"
  | "plaque"
  | "pi"
  | "gi"
  | "mpi"
  | "mbi"
  | "bop"
  | "pd5"
  | "pd6";

export type PdfDateFormat = "iso" | "dmy" | "mdy";
export type PdfToothSpacing = "wide" | "medium" | "close";
export type PdfBorderThickness = "thin" | "medium" | "thick";
export type PdfToothNumberSize = "small" | "normal" | "xlarge";
export type PdfPerioLabelPlacement = "center" | "edge";
export type PdfPerioFontSize = "small" | "normal" | "xlarge";
export type PdfSummaryGrouping = "whole" | "jaw" | "quadrant" | "sextant";

export interface PdfSettings {
  defaultName: string;
  defaultDob: string;
  showAge: boolean;
  dateFormat: PdfDateFormat;
  colorTheme: PdfColorTheme;
  showBone: boolean;
  showHealthyPulp: boolean;
  toothSpacing: PdfToothSpacing;
  border: boolean;
  borderThickness: PdfBorderThickness;
  borderColor: string;
  toothNumberSize: PdfToothNumberSize;
  includeOdontogramText: boolean;
  includeOdontogramTable: boolean;
  perioToothSpacing: PdfToothSpacing;
  perioShowEmptyRows: boolean;
  perioLabelPlacement: PdfPerioLabelPlacement;
  perioFontSize: PdfPerioFontSize;
  includePerioTable: boolean;
  includePerioAbbrev: boolean;
  showDisclaimer: boolean;
  disclaimerText: string;
  showGenerator: boolean;
  summaryGrouping: PdfSummaryGrouping;
}

export type OdontogramSummarySection = {
  key: "caries" | "fillings" | "endo" | "diagnoses" | "wear" | "discoloration" | "orthodontics" | "prosthetics";
  heading: string;
  items: string[];
  emptyText: string;
};

export type ToothTableStatus = "empty" | "content" | "problem";

export interface ToothTableCell {
  toothNo: number;
  label: string;
  status: ToothTableStatus;
}

export interface OdontogramToothTable {
  columns: { key: string; label: string }[];
  rows: { key: string; label: string; cells: Record<string, ToothTableCell[]> }[];
  legend: string;
}

export type OdontogramSummary = {
  overview: string;
  permanentList: string | null;
  missingList: string | null;
  toothTable: OdontogramToothTable;
  periodontalHasFindings: boolean;
  sections: OdontogramSummarySection[];
  implants: { heading: string; text: string } | null;
  periodontalTitle: string;
  periodontalText: string;
  plannedChanges: PlanChange[];
  individualNotes: { heading: string; items: string[] } | null;
};
