import { useEffect, useRef, useState } from "react";
import {
  getScreenToothSpacing,
  setScreenToothSpacing,
  getScreenToothNumberSize,
  setScreenToothNumberSize,
  getSelectionColor,
  setSelectionColor,
  getSelectionBorderStyle,
  setSelectionBorderStyle,
  getToothInfoVisible,
  setToothInfoVisible,
  getToothAnatomy,
  getOdontogramSummary,
  onStateChange,
  type OdontogramSummary,
  type ToothAnatomy,
} from "@/odontogram";
import type { ScreenToothSpacing, ScreenToothNumberSize, SelectionBorderStyle } from "@/SettingsModal";
import type { Language } from "@/i18n/languages";
import type { NumberingSystem } from "@/utils/numbering";
import { applyThemeConfig, type OdontogramThemeConfig } from "@/theme";

export function useChartDisplayState({
  screenToothSpacingProp,
  screenToothNumberSizeProp,
  selectionColorProp,
  selectionBorderStyleProp,
  toothInfoProp,
  themeConfig,
  lang,
  currentNumbering,
}: {
  screenToothSpacingProp?: ScreenToothSpacing;
  screenToothNumberSizeProp?: ScreenToothNumberSize;
  selectionColorProp?: string;
  selectionBorderStyleProp?: SelectionBorderStyle;
  toothInfoProp?: boolean;
  themeConfig?: OdontogramThemeConfig;
  lang: Language;
  currentNumbering: NumberingSystem;
}) {
  const themeRootRef = useRef<HTMLDivElement | null>(null);

  const [screenSpacing, setScreenSpacing] = useState<ScreenToothSpacing>(() => getScreenToothSpacing());
  const [screenNumberSize, setScreenNumberSize] = useState<ScreenToothNumberSize>(() => getScreenToothNumberSize());
  const [selectionColor, setSelectionColorState] = useState<string>(() => getSelectionColor());
  const [selectionBorderStyle, setSelectionBorderStyleState] = useState<SelectionBorderStyle>(() => getSelectionBorderStyle());
  const [toothInfoOn, setToothInfoOn] = useState<boolean>(() => getToothInfoVisible());
  const [toothAnatomy, setToothAnatomyState] = useState<ToothAnatomy>(() => getToothAnatomy());
  const [summary, setSummary] = useState<OdontogramSummary | null>(null);

  // Apply custom theme config as CSS custom properties
  useEffect(() => {
    applyThemeConfig(themeRootRef.current, themeConfig);
  }, [themeConfig]);

  // Refresh the tooth-information summary while its panel is open
  useEffect(() => {
    if (!toothInfoOn) return;
    const refresh = () => {
      setSummary(getOdontogramSummary());
    };
    refresh();
    return onStateChange(refresh);
  }, [toothInfoOn, lang, currentNumbering]);

  // Mirror the chart display settings
  useEffect(() => {
    const refresh = () => {
      setScreenSpacing(getScreenToothSpacing());
      setScreenNumberSize(getScreenToothNumberSize());
      setSelectionColorState(getSelectionColor());
      setSelectionBorderStyleState(getSelectionBorderStyle());
      setToothInfoOn(getToothInfoVisible());
    };
    refresh();
    return onStateChange(refresh);
  }, []);

  // Display-settings controlled props
  useEffect(() => {
    if (screenToothSpacingProp !== undefined) setScreenToothSpacing(screenToothSpacingProp);
  }, [screenToothSpacingProp]);

  useEffect(() => {
    if (screenToothNumberSizeProp !== undefined) setScreenToothNumberSize(screenToothNumberSizeProp);
  }, [screenToothNumberSizeProp]);

  useEffect(() => {
    if (selectionColorProp !== undefined) setSelectionColor(selectionColorProp);
  }, [selectionColorProp]);

  useEffect(() => {
    if (selectionBorderStyleProp !== undefined) setSelectionBorderStyle(selectionBorderStyleProp);
  }, [selectionBorderStyleProp]);

  useEffect(() => {
    if (toothInfoProp !== undefined) setToothInfoVisible(toothInfoProp);
  }, [toothInfoProp]);

  // Mirror the module-level tooth-anatomy profile
  useEffect(() => {
    const refresh = () => setToothAnatomyState(getToothAnatomy());
    refresh();
    return onStateChange(refresh);
  }, []);

  return {
    themeRootRef,
    screenSpacing,
    screenNumberSize,
    selectionColor,
    selectionBorderStyle,
    toothInfoOn,
    toothAnatomy,
    summary,
  };
}
