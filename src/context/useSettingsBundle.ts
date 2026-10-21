import { useState } from "react";
import {
  setNotesEnabled,
  setIcdasEnabled,
  setPulpDetailLevel,
  setSecondaryCariesMode,
  setRootCariesMode,
  setRadiographicDepthMode,
  setCariesDepthEnabled,
  setWearDetailLevel,
  setDiscolorationDetailLevel,
  setSurfaceNotation,
  setPerioViewMode,
  setPerioRowVisibility,
  setPerioIndexNameMode,
  setDiagnosisCodingPack,
  setSnomedEnabled,
  getPdfSettings,
  setPdfSettings,
  closePerioOverlay,
  getChartMode,
  setChartMode,
  setFillingDefectEnabled,
  setFillingComplexity,
  setFissureSealingEnabled,
  setFillingMaterialAvailability,
  setToothAnatomy,
  setScreenToothSpacing,
  setScreenToothNumberSize,
  setSelectionColor,
  setSelectionBorderStyle,
  setToothInfoVisible,
  type PerioRowId,
  type PerioIndexNameMode,
  type ToothAnatomy,
  type PerioViewMode,
} from "@/odontogram";
import type { SettingsState } from "@/SettingsModal";
import type { Language } from "@/i18n/languages";
import type { NumberingSystem } from "@/utils/numbering";
import type { ScreenToothSpacing, ScreenToothNumberSize, SelectionBorderStyle, FillingComplexity } from "@/SettingsModal";

export function useSettingsBundle({
  currentNumbering,
  setNumbering,
  lang,
  setLang,
  isDark,
  toggleDark,
  toothInfoOn,
  exportPngOn,
  setExportPngOn,
  exportJpgOn,
  setExportJpgOn,
  exportSvgOn,
  setExportSvgOn,
  exportPdfOn,
  setExportPdfOn,
  importStatusOn,
  setImportStatusOn,
  importFhirOn,
  setImportFhirOn,
  secondaryMode,
  setSecondaryMode,
  icdasOn,
  setIcdasOn,
  cariesDepthOn,
  setCariesDepthOn,
  rootMode,
  setRootMode,
  radiographicMode,
  setRadiographicMode,
  pulpLevel,
  setPulpLevel,
  wearLevel,
  setWearLevel,
  discoLevel,
  setDiscoLevel,
  notation,
  setNotation,
  notesOn,
  setNotesOn,
  planModeAvailable,
  setPlanModeAvailable,
  screenSpacing,
  screenNumberSize,
  toothAnatomy,
  selectionColor,
  selectionBorderStyle,
  perioChartAvailable,
  setPerioChartAvailable,
  setActiveView,
  showStatusCard,
  setShowStatusCard,
  showOrthoCard,
  setShowOrthoCard,
  viewMode,
  perioRowVisibility,
  perioIndexNameMode,
  codingPack,
  snomedEnabled,
  fillingDefectOn,
  setFillingDefectOn,
  onFillingDefectEnabledChange,
  fillingComplexityState,
  setFillingComplexityState,
  onFillingComplexityChange,
  fillingMaterialsState,
  setFillingMaterialsState,
  onFillingMaterialAvailabilityChange,
  fissureSealingOn,
  setFissureSealingOn,
  onFissureSealingEnabledChange,
}: {
  currentNumbering: NumberingSystem;
  setNumbering: (next: NumberingSystem) => void;
  lang: Language;
  setLang: (lang: Language) => void;
  isDark: boolean;
  toggleDark: () => void;
  toothInfoOn: boolean;
  exportPngOn: boolean;
  setExportPngOn: (v: boolean) => void;
  exportJpgOn: boolean;
  setExportJpgOn: (v: boolean) => void;
  exportSvgOn: boolean;
  setExportSvgOn: (v: boolean) => void;
  exportPdfOn: boolean;
  setExportPdfOn: (v: boolean) => void;
  importStatusOn: boolean;
  setImportStatusOn: (v: boolean) => void;
  importFhirOn: boolean;
  setImportFhirOn: (v: boolean) => void;
  secondaryMode: SettingsState["secondaryCariesMode"];
  setSecondaryMode: (v: SettingsState["secondaryCariesMode"]) => void;
  icdasOn: boolean;
  setIcdasOn: (v: boolean) => void;
  cariesDepthOn: boolean;
  setCariesDepthOn: (v: boolean) => void;
  rootMode: SettingsState["rootCariesMode"];
  setRootMode: (v: SettingsState["rootCariesMode"]) => void;
  radiographicMode: SettingsState["radiographicDepthMode"];
  setRadiographicMode: (v: SettingsState["radiographicDepthMode"]) => void;
  pulpLevel: SettingsState["pulpLevel"];
  setPulpLevel: (v: SettingsState["pulpLevel"]) => void;
  wearLevel: SettingsState["wearDetailLevel"];
  setWearLevel: (v: SettingsState["wearDetailLevel"]) => void;
  discoLevel: SettingsState["discolorationDetailLevel"];
  setDiscoLevel: (v: SettingsState["discolorationDetailLevel"]) => void;
  notation: SettingsState["surfaceNotation"];
  setNotation: (v: SettingsState["surfaceNotation"]) => void;
  notesOn: boolean;
  setNotesOn: (v: boolean) => void;
  planModeAvailable: boolean;
  setPlanModeAvailable: (v: boolean) => void;
  screenSpacing: ScreenToothSpacing;
  screenNumberSize: ScreenToothNumberSize;
  toothAnatomy: ToothAnatomy;
  selectionColor: string;
  selectionBorderStyle: SelectionBorderStyle;
  perioChartAvailable: boolean;
  setPerioChartAvailable: (v: boolean) => void;
  setActiveView: (view: "odontogram" | "dentalChart") => void;
  showStatusCard: boolean;
  setShowStatusCard: (v: boolean) => void;
  showOrthoCard: boolean;
  setShowOrthoCard: (v: boolean) => void;
  viewMode: PerioViewMode;
  perioRowVisibility: Record<PerioRowId, boolean>;
  perioIndexNameMode: PerioIndexNameMode;
  codingPack: string;
  snomedEnabled: boolean;
  fillingDefectOn: boolean;
  setFillingDefectOn: (v: boolean) => void;
  onFillingDefectEnabledChange?: (v: boolean) => void;
  fillingComplexityState: FillingComplexity;
  setFillingComplexityState: (v: FillingComplexity) => void;
  onFillingComplexityChange?: (v: FillingComplexity) => void;
  fillingMaterialsState: Record<string, boolean>;
  setFillingMaterialsState: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onFillingMaterialAvailabilityChange?: (material: string, enabled: boolean) => void;
  fissureSealingOn: boolean;
  setFissureSealingOn: (v: boolean) => void;
  onFissureSealingEnabledChange?: (v: boolean) => void;
}) {
  const [pdfSettings, setPdfSettingsState] = useState(() => getPdfSettings());

  const settingsState: SettingsState = {
    numbering: currentNumbering,
    onNumbering: setNumbering,
    language: lang,
    onLanguage: setLang,
    isDark,
    onToggleDark: toggleDark,
    toothInfo: toothInfoOn,
    onToothInfo: (v) => setToothInfoVisible(v),
    exportPng: exportPngOn,
    onExportPng: (v) => setExportPngOn(v),
    exportJpg: exportJpgOn,
    onExportJpg: (v) => setExportJpgOn(v),
    exportSvg: exportSvgOn,
    onExportSvg: (v) => setExportSvgOn(v),
    exportPdf: exportPdfOn,
    onExportPdf: (v) => setExportPdfOn(v),
    importStatus: importStatusOn,
    onImportStatus: (v) => setImportStatusOn(v),
    importFhir: importFhirOn,
    onImportFhir: (v) => setImportFhirOn(v),
    secondaryCariesMode: secondaryMode,
    onSecondaryCariesMode: (v) => {
      setSecondaryMode(v);
      setSecondaryCariesMode(v);
    },
    icdas: icdasOn,
    onIcdas: (v) => {
      setIcdasOn(v);
      setIcdasEnabled(v);
    },
    cariesDepth: cariesDepthOn,
    onCariesDepth: (v) => {
      setCariesDepthOn(v);
      setCariesDepthEnabled(v);
    },
    rootCariesMode: rootMode,
    onRootCariesMode: (v) => {
      setRootMode(v);
      setRootCariesMode(v);
    },
    radiographicDepthMode: radiographicMode,
    onRadiographicDepthMode: (v) => {
      setRadiographicMode(v);
      setRadiographicDepthMode(v);
    },
    pulpLevel,
    onPulpLevel: (v) => {
      setPulpLevel(v);
      setPulpDetailLevel(v);
    },
    wearDetailLevel: wearLevel,
    onWearDetailLevel: (v) => {
      setWearLevel(v);
      setWearDetailLevel(v);
    },
    discolorationDetailLevel: discoLevel,
    onDiscolorationDetailLevel: (v) => {
      setDiscoLevel(v);
      setDiscolorationDetailLevel(v);
    },
    surfaceNotation: notation,
    onSurfaceNotation: (v) => {
      setNotation(v);
      setSurfaceNotation(v);
    },
    notes: notesOn,
    onNotes: (v) => {
      setNotesOn(v);
      setNotesEnabled(v);
    },
    planModeAvailable,
    onPlanModeAvailable: (v) => {
      setPlanModeAvailable(v);
      if (!v && getChartMode() === "plan") setChartMode("status");
    },
    screenToothSpacing: screenSpacing,
    onScreenToothSpacing: (v) => setScreenToothSpacing(v),
    screenToothNumberSize: screenNumberSize,
    onScreenToothNumberSize: (v) => setScreenToothNumberSize(v),
    toothAnatomy,
    onToothAnatomy: (v) => {
      void setToothAnatomy(v);
    },
    selectionColor,
    onSelectionColor: (v) => setSelectionColor(v),
    selectionBorderStyle,
    onSelectionBorderStyle: (v) => setSelectionBorderStyle(v),
    perioChartAvailable,
    onPerioChartAvailable: (v) => {
      setPerioChartAvailable(v);
      if (!v) {
        setActiveView("odontogram");
        closePerioOverlay();
      }
    },
    showStatusCard,
    onShowStatusCard: (v) => setShowStatusCard(v),
    showOrthoCard,
    onShowOrthoCard: (v) => setShowOrthoCard(v),
    perioViewMode: viewMode,
    onPerioViewMode: (v) => setPerioViewMode(v),
    perioRowVisibility,
    onPerioRowVisibility: (id, v) => setPerioRowVisibility(id, v),
    perioIndexNameMode,
    onPerioIndexNameMode: (v) => setPerioIndexNameMode(v),
    codingPack,
    onDiagnosisCodingPack: (v) => setDiagnosisCodingPack(v),
    snomedEnabled,
    onSnomedEnabled: (v: boolean) => setSnomedEnabled(v),
    fillingDefectEnabled: fillingDefectOn,
    onFillingDefectEnabled: (v) => {
      setFillingDefectOn(v);
      setFillingDefectEnabled(v);
      onFillingDefectEnabledChange?.(v);
    },
    fillingComplexity: fillingComplexityState,
    onFillingComplexity: (v) => {
      setFillingComplexityState(v);
      setFillingComplexity(v);
      onFillingComplexityChange?.(v);
    },
    fillingMaterials: fillingMaterialsState,
    onFillingMaterial: (m, v) => {
      setFillingMaterialsState((prev) => ({ ...prev, [m]: v }));
      setFillingMaterialAvailability(m, v);
      onFillingMaterialAvailabilityChange?.(m, v);
    },
    fissureSealingEnabled: fissureSealingOn,
    onFissureSealingEnabled: (v) => {
      setFissureSealingOn(v);
      setFissureSealingEnabled(v);
      onFissureSealingEnabledChange?.(v);
    },
    pdfSettings,
    onPdfSettings: (patch) => {
      setPdfSettings(patch);
      setPdfSettingsState(getPdfSettings());
    },
  };

  return { settingsState };
}
