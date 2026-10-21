import { useEffect, useState } from "react";
import {
  getPerioViewMode,
  getPerioRowVisibility,
  getPerioIndexNameMode,
  isDualStateConfirmPending,
  hasAnyPerioData,
  isPerioOverlayOpen,
  onStateChange,
  type PerioViewMode,
  type PerioRowId,
  type PerioIndexNameMode,
} from "@/odontogram";

export function usePerioViewState() {
  const [hasPerio, setHasPerio] = useState(false);
  const [perioOpen, setPerioOpen] = useState(false);
  const [viewMode, setViewMode] = useState<PerioViewMode>(() => getPerioViewMode());
  const [activeView, setActiveView] = useState<"odontogram" | "dentalChart">("odontogram");
  const [perioChartAvailable, setPerioChartAvailable] = useState<boolean>(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [perioRowVisibility, setPerioRowVisibilityState] = useState<Record<PerioRowId, boolean>>(
    () => getPerioRowVisibility(),
  );
  const [perioIndexNameMode, setPerioIndexNameModeState] = useState<PerioIndexNameMode>(
    () => getPerioIndexNameMode(),
  );

  const isPerioView = viewMode === "toggle" && activeView === "dentalChart";

  // Mirror perio-data presence into React state
  useEffect(() => {
    const refresh = () => setHasPerio(hasAnyPerioData());
    refresh();
    return onStateChange(refresh);
  }, []);

  // Mirror the module-level perio-overlay flag into React state
  useEffect(() => {
    const refresh = () => setPerioOpen(isPerioOverlayOpen());
    refresh();
    return onStateChange(refresh);
  }, []);

  // Mirror the module-level perioViewMode flag into React state
  useEffect(() => {
    const refresh = () => setViewMode(getPerioViewMode());
    refresh();
    return onStateChange(refresh);
  }, []);

  // Mirror the module-level perioRowVisibility/perioIndexNameMode flags
  useEffect(() => {
    const refresh = () => {
      setPerioRowVisibilityState(getPerioRowVisibility());
      setPerioIndexNameModeState(getPerioIndexNameMode());
    };
    refresh();
    return onStateChange(refresh);
  }, []);

  // Mirror the pending-confirm flag into React state
  useEffect(() => {
    return onStateChange(() => setConfirmOpen(isDualStateConfirmPending()));
  }, []);

  return {
    hasPerio,
    perioOpen,
    viewMode,
    activeView,
    setActiveView,
    isPerioView,
    perioChartAvailable,
    setPerioChartAvailable,
    confirmOpen,
    perioRowVisibility,
    perioIndexNameMode,
  };
}
