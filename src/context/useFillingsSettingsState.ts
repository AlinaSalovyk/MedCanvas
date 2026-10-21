import { useEffect, useMemo, useRef, useState } from "react";
import {
  getFillingDefectEnabled,
  setFillingDefectEnabled,
  getFillingComplexity,
  setFillingComplexity,
  getFissureSealingEnabled,
  setFissureSealingEnabled,
  getFillingMaterialAvailability,
  setFillingMaterialAvailability,
} from "@/odontogram";
import type { FillingComplexity } from "@/SettingsModal";

export function useFillingsSettingsState({
  fillingComplexity,
  fillingDefectEnabledProp,
  fillingMaterialAvailability,
  fissureSealingEnabledProp,
}: {
  fillingComplexity?: FillingComplexity;
  fillingDefectEnabledProp?: boolean;
  fillingMaterialAvailability?: Record<string, boolean>;
  fissureSealingEnabledProp?: boolean;
}) {
  const [fillingDefectOn, setFillingDefectOn] = useState<boolean>(
    () => fillingDefectEnabledProp ?? getFillingDefectEnabled(),
  );
  const [fillingComplexityState, setFillingComplexityState] = useState<FillingComplexity>(
    () => fillingComplexity ?? getFillingComplexity(),
  );
  const [fissureSealingOn, setFissureSealingOn] = useState<boolean>(
    () => fissureSealingEnabledProp ?? getFissureSealingEnabled(),
  );
  const [fillingMaterialsState, setFillingMaterialsState] = useState<Record<string, boolean>>(
    () => fillingMaterialAvailability ?? getFillingMaterialAvailability(),
  );

  useEffect(() => {
    if (fillingComplexity !== undefined) {
      setFillingComplexity(fillingComplexity);
      setFillingComplexityState(fillingComplexity);
    }
  }, [fillingComplexity]);

  useEffect(() => {
    if (fillingDefectEnabledProp !== undefined) {
      setFillingDefectEnabled(fillingDefectEnabledProp);
      setFillingDefectOn(fillingDefectEnabledProp);
    }
  }, [fillingDefectEnabledProp]);

  useEffect(() => {
    if (fissureSealingEnabledProp !== undefined) {
      setFissureSealingEnabled(fissureSealingEnabledProp);
      setFissureSealingOn(fissureSealingEnabledProp);
    }
  }, [fissureSealingEnabledProp]);

  const fillingMaterialsKey = useMemo(() => {
    if (fillingMaterialAvailability === undefined) return null;
    const entries = Object.keys(fillingMaterialAvailability).sort().map((m) => [m, !!fillingMaterialAvailability[m]]);
    return JSON.stringify(entries);
  }, [fillingMaterialAvailability]);

  const prevMaterialsRef = useRef<Record<string, boolean> | null>(null);
  useEffect(() => {
    if (fillingMaterialsKey === null) {
      prevMaterialsRef.current = null;
      return;
    }
    const entries = JSON.parse(fillingMaterialsKey) as [string, boolean][];
    const next = Object.fromEntries(entries);
    const prev = prevMaterialsRef.current ?? {};
    for (const [m, on] of entries) {
      if (prev[m] !== on) setFillingMaterialAvailability(m, on);
    }
    prevMaterialsRef.current = next;
    setFillingMaterialsState({ ...next });
  }, [fillingMaterialsKey]);

  return {
    fillingDefectOn,
    setFillingDefectOn,
    fillingComplexityState,
    setFillingComplexityState,
    fissureSealingOn,
    setFissureSealingOn,
    fillingMaterialsState,
    setFillingMaterialsState,
  };
}
