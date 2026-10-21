import { useEffect, useState } from "react";
import {
  destroyOdontogram,
  initOdontogram,
  setNumberingSystem,
  registerPlugins,
  setReadOnly,
} from "@/odontogram";
import { useI18n } from "@/i18n/useI18n";
import { resolveLanguage } from "@/i18n/languages";
import type { NumberingSystem } from "@/utils/numbering";
import { OdontogramUiContext } from "@/context/OdontogramUiContext";
import { useLanguageReady } from "@/context/useLanguageReady";
import { useChartDisplayState } from "@/context/useChartDisplayState";
import { useClinicalSettingsState } from "@/context/useClinicalSettingsState";
import { useFillingsSettingsState } from "@/context/useFillingsSettingsState";
import { usePerioViewState } from "@/context/usePerioViewState";
import { useSettingsBundle } from "@/context/useSettingsBundle";
import type { OdontogramProviderProps, OdontogramUiContextValue } from "@/context/types";

export { OdontogramUiContext, useOdontogramUi } from "@/context/OdontogramUiContext";
export type {
  OdontogramProviderProps,
  TranslateFn,
  OdontogramUiContextValue,
} from "@/context/types";

/**
 * Owns all odontogram shell state, effects, and handlers and provides them to
 * composed surfaces + modals. Renders only the `.odontogram-root` wrapper around
 * `children` — no extra DOM node.
 *
 * Holds its first render until the requested `language` has loaded.
 */
export function OdontogramProvider(props: OdontogramProviderProps) {
  const resolvedLang = props.language !== undefined ? resolveLanguage(props.language) : undefined;
  const ready = useLanguageReady(resolvedLang);
  if (!ready) return null;
  return <OdontogramProviderInner {...props} language={resolvedLang} />;
}

function OdontogramProviderInner({
  children,
  language,
  onLanguageChange,
  numberingSystem,
  onNumberingChange,
  darkMode,
  onDarkModeChange,
  themeConfig,
  plugins,
  readOnly: readOnlyProp,
  enableNotes,
  enableIcdas,
  pulpDetailLevel,
  secondaryCariesMode,
  rootCariesMode,
  radiographicDepthMode,
  cariesDepthEnabled,
  wearDetailLevel,
  discolorationDetailLevel,
  surfaceNotation,
  showStatusCard: showStatusCardProp,
  showOrthoCard: showOrthoCardProp,
  fillingComplexity,
  onFillingComplexityChange,
  fillingDefectEnabled: fillingDefectEnabledProp,
  onFillingDefectEnabledChange,
  fillingMaterialAvailability,
  onFillingMaterialAvailabilityChange,
  fissureSealingEnabled: fissureSealingEnabledProp,
  onFissureSealingEnabledChange,
  screenToothSpacing: screenToothSpacingProp,
  screenToothNumberSize: screenToothNumberSizeProp,
  selectionColor: selectionColorProp,
  selectionBorderStyle: selectionBorderStyleProp,
  toothInfo: toothInfoProp,
}: OdontogramProviderProps) {
  const { lang, setLang, t } = useI18n({ language, onLanguageChange });
  const [internalNumbering, setInternalNumbering] = useState<NumberingSystem>(numberingSystem ?? "FDI");
  const currentNumbering = numberingSystem ?? internalNumbering;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [caseDxOpen, setCaseDxOpen] = useState(false);

  const [exportPngOn, setExportPngOn] = useState<boolean>(true);
  const [exportJpgOn, setExportJpgOn] = useState<boolean>(true);
  const [exportSvgOn, setExportSvgOn] = useState<boolean>(true);
  const [exportPdfOn, setExportPdfOn] = useState<boolean>(true);
  const [importStatusOn, setImportStatusOn] = useState<boolean>(true);
  const [importFhirOn, setImportFhirOn] = useState<boolean>(true);
  const [planModeAvailable, setPlanModeAvailable] = useState<boolean>(true);

  const [showStatusCard, setShowStatusCard] = useState<boolean>(showStatusCardProp ?? true);
  const [showOrthoCard, setShowOrthoCard] = useState<boolean>(showOrthoCardProp ?? true);

  // Dark mode: controlled via prop or standalone via internal state
  const [internalDark, setInternalDark] = useState<boolean>(() => {
    if (darkMode !== undefined) return darkMode;
    if (typeof document !== "undefined") return document.documentElement.classList.contains("dark");
    return false;
  });
  const isDark = darkMode !== undefined ? darkMode : internalDark;

  useEffect(() => {
    if (darkMode === undefined) {
      document.documentElement.classList.toggle("dark", isDark);
    }
  }, [isDark, darkMode]);

  const toggleDark = () => {
    const next = !isDark;
    if (darkMode !== undefined) {
      onDarkModeChange?.(next);
    } else {
      setInternalDark(next);
      onDarkModeChange?.(next);
    }
  };

  const setNumbering = (next: NumberingSystem) => {
    if (numberingSystem) {
      onNumberingChange?.(next);
      return;
    }
    setInternalNumbering(next);
    onNumberingChange?.(next);
  };

  // Engine lifecycle & root configurations
  useEffect(() => {
    initOdontogram();
    return () => {
      destroyOdontogram();
    };
  }, []);

  useEffect(() => {
    setNumberingSystem(currentNumbering);
  }, [currentNumbering]);

  useEffect(() => {
    registerPlugins(plugins ?? []);
  }, [plugins]);

  useEffect(() => {
    setReadOnly(readOnlyProp ?? false);
  }, [readOnlyProp]);

  useEffect(() => {
    setShowStatusCard(showStatusCardProp ?? true);
  }, [showStatusCardProp]);

  useEffect(() => {
    setShowOrthoCard(showOrthoCardProp ?? true);
  }, [showOrthoCardProp]);

  const chartDisplay = useChartDisplayState({
    screenToothSpacingProp,
    screenToothNumberSizeProp,
    selectionColorProp,
    selectionBorderStyleProp,
    toothInfoProp,
    themeConfig,
    lang,
    currentNumbering,
  });

  const clinical = useClinicalSettingsState({
    enableNotes,
    enableIcdas,
    pulpDetailLevel,
    secondaryCariesMode,
    rootCariesMode,
    radiographicDepthMode,
    cariesDepthEnabled,
    wearDetailLevel,
    discolorationDetailLevel,
    surfaceNotation,
  });

  const fillings = useFillingsSettingsState({
    fillingComplexity,
    fillingDefectEnabledProp,
    fillingMaterialAvailability,
    fissureSealingEnabledProp,
  });

  const perioView = usePerioViewState();

  const { settingsState } = useSettingsBundle({
    currentNumbering,
    setNumbering,
    lang,
    setLang,
    isDark,
    toggleDark,
    toothInfoOn: chartDisplay.toothInfoOn,
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
    secondaryMode: clinical.secondaryMode,
    setSecondaryMode: clinical.setSecondaryMode,
    icdasOn: clinical.icdasOn,
    setIcdasOn: clinical.setIcdasOn,
    cariesDepthOn: clinical.cariesDepthOn,
    setCariesDepthOn: clinical.setCariesDepthOn,
    rootMode: clinical.rootMode,
    setRootMode: clinical.setRootMode,
    radiographicMode: clinical.radiographicMode,
    setRadiographicMode: clinical.setRadiographicMode,
    pulpLevel: clinical.pulpLevel,
    setPulpLevel: clinical.setPulpLevel,
    wearLevel: clinical.wearLevel,
    setWearLevel: clinical.setWearLevel,
    discoLevel: clinical.discoLevel,
    setDiscoLevel: clinical.setDiscoLevel,
    notation: clinical.notation,
    setNotation: clinical.setNotation,
    notesOn: clinical.notesOn,
    setNotesOn: clinical.setNotesOn,
    planModeAvailable,
    setPlanModeAvailable,
    screenSpacing: chartDisplay.screenSpacing,
    screenNumberSize: chartDisplay.screenNumberSize,
    toothAnatomy: chartDisplay.toothAnatomy,
    selectionColor: chartDisplay.selectionColor,
    selectionBorderStyle: chartDisplay.selectionBorderStyle,
    perioChartAvailable: perioView.perioChartAvailable,
    setPerioChartAvailable: perioView.setPerioChartAvailable,
    setActiveView: perioView.setActiveView,
    showStatusCard,
    setShowStatusCard,
    showOrthoCard,
    setShowOrthoCard,
    viewMode: perioView.viewMode,
    perioRowVisibility: perioView.perioRowVisibility,
    perioIndexNameMode: perioView.perioIndexNameMode,
    codingPack: clinical.codingPack,
    snomedEnabled: clinical.snomedEnabled,
    fillingDefectOn: fillings.fillingDefectOn,
    setFillingDefectOn: fillings.setFillingDefectOn,
    onFillingDefectEnabledChange,
    fillingComplexityState: fillings.fillingComplexityState,
    setFillingComplexityState: fillings.setFillingComplexityState,
    onFillingComplexityChange,
    fillingMaterialsState: fillings.fillingMaterialsState,
    setFillingMaterialsState: fillings.setFillingMaterialsState,
    onFillingMaterialAvailabilityChange,
    fissureSealingOn: fillings.fissureSealingOn,
    setFissureSealingOn: fillings.setFissureSealingOn,
    onFissureSealingEnabledChange,
  });

  const value: OdontogramUiContextValue = {
    t,
    lang,
    setLang,
    isDark,
    toggleDark,
    currentNumbering,
    setNumbering,
    viewMode: perioView.viewMode,
    activeView: perioView.activeView,
    setActiveView: perioView.setActiveView,
    isPerioView: perioView.isPerioView,
    perioChartAvailable: perioView.perioChartAvailable,
    perioOpen: perioView.perioOpen,
    confirmOpen: perioView.confirmOpen,
    hasPerio: perioView.hasPerio,
    exportPngOn,
    exportJpgOn,
    exportSvgOn,
    exportPdfOn,
    importStatusOn,
    importFhirOn,
    summary: chartDisplay.summary,
    toothInfoOn: chartDisplay.toothInfoOn,
    screenSpacing: chartDisplay.screenSpacing,
    screenNumberSize: chartDisplay.screenNumberSize,
    selectionColor: chartDisplay.selectionColor,
    selectionBorderStyle: chartDisplay.selectionBorderStyle,
    toothAnatomy: chartDisplay.toothAnatomy,
    planModeAvailable,
    showStatusCard,
    showOrthoCard,
    settingsState,
    settingsOpen,
    setSettingsOpen,
    pdfOpen,
    setPdfOpen,
    creditsOpen,
    setCreditsOpen,
    caseDxOpen,
    setCaseDxOpen,
  };

  return (
    <OdontogramUiContext.Provider value={value}>
      <div ref={chartDisplay.themeRootRef} className="odontogram-root" dir="ltr" lang={lang}>
        {children}
      </div>
    </OdontogramUiContext.Provider>
  );
}
