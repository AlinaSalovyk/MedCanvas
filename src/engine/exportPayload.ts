import { charts, planInitialized, getChartMode, setActiveChartMode, setPlanInitialized } from "@/state/chart";
import { ALL_TEETH } from "@/anatomy/profiles";
import { defaultState, serializeState, hydrateState, isLegacyPayloadVersion } from "@/state/payload";
import { caseMeta, caseMetaIsEmpty, serializeCaseMeta, hydrateCaseMeta } from "@/state/caseMeta";
import { buildFhirBundle } from "@/fhir/toFhir";
import { resolveCodingPack } from "@/dx/packs";
import { diagnosisCodingPack, snomedEnabled } from "@/engine/sessionSettings";
import {
  wisdomVisible,
  showBase,
  occlusalVisible,
  showHealthyPulp,
  edentulous,
} from "@/engine/displayGlobals";
import { clearPlanEditedTeeth, clearPendingDualStateConfirm } from "@/engine/dualStateGate";
import type { FhirExportOptions } from "@/fhir/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let planRepaintHook: (() => void) | null = null;

export function setPlanRepaintHook(hook: () => void): void {
  planRepaintHook = hook;
}

export function downloadJson(payload: Any, filenamePrefix: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `${filenamePrefix}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Per-tooth serialize loop across a chart map.
 */
export function collectTeeth(chart: Map<Any, Any>): Record<string, Any> {
  const teeth: Record<string, Any> = {};
  for(const toothNo of ALL_TEETH){
    const s = chart.get(toothNo) ?? defaultState();
    teeth[toothNo] = serializeState(s);
  }
  return teeth;
}

/**
 * Current global settings shared across payload shapes.
 */
export function collectGlobals(): Record<string, boolean> {
  return {
    wisdomVisible,
    showBase,
    occlusalVisible,
    showHealthyPulp,
    edentulous,
  };
}

/**
 * Build the complete exported payload object.
 */
export function collectExportPayload(): Any {
  const statusTeeth = collectTeeth(charts.status);
  const planTeeth = planInitialized ? collectTeeth(charts.plan) : null;
  const planDiffers = planTeeth !== null && JSON.stringify(planTeeth) !== JSON.stringify(statusTeeth);
  return {
    version: "2.22",
    globals: collectGlobals(),
    teeth: statusTeeth,
    ...(caseMetaIsEmpty(caseMeta) ? {} : { case: serializeCaseMeta(caseMeta) }),
    ...(planDiffers ? { plan: planTeeth } : {}),
  };
}

export function __collectExportPayloadForTest(): Any {
  return collectExportPayload();
}

/**
 * Export the STATUS chart's payload.
 */
export function getStatusChart(): Any {
  return collectExportPayload();
}

/**
 * Export the PLAN chart's payload alone.
 */
export function getPlanChart(): Any {
  return {
    version: "2.22",
    globals: collectGlobals(),
    teeth: collectTeeth(charts.plan),
    ...(caseMetaIsEmpty(caseMeta) ? {} : { case: serializeCaseMeta(caseMeta) }),
  };
}

/**
 * Hydrate payload.teeth into the PLAN chart only.
 */
export function setPlanChart(payload: Any): void {
  if(!payload || typeof payload !== "object") return;
  const inferLegacySecondaryCaries = isLegacyPayloadVersion(payload.version);
  const teeth = payload.teeth || {};
  for(const toothNo of ALL_TEETH){
    const raw = teeth[toothNo];
    charts.plan.set(toothNo, hydrateState(raw, inferLegacySecondaryCaries));
  }
  setPlanInitialized(true);
  clearPlanEditedTeeth();
  clearPendingDualStateConfirm();
  if(getChartMode() === "plan"){
    planRepaintHook?.();
  }
}

/**
 * Data-only hydration of imported status and plan charts.
 */
export function hydrateImportedCharts(data: Any): void {
  const inferLegacySecondaryCaries = isLegacyPayloadVersion(data.version);
  const teeth = data.teeth || {};
  for(const toothNo of ALL_TEETH){
    const raw = teeth[toothNo];
    charts.status.set(toothNo, hydrateState(raw, inferLegacySecondaryCaries));
  }
  hydrateCaseMeta(data.case);
  if(data.plan && typeof data.plan === "object"){
    for(const toothNo of ALL_TEETH){
      const raw = data.plan[toothNo];
      charts.plan.set(toothNo, hydrateState(raw, inferLegacySecondaryCaries));
    }
    setPlanInitialized(true);
  }else{
    charts.plan.clear();
    setPlanInitialized(false);
  }
  clearPlanEditedTeeth();
  clearPendingDualStateConfirm();
}

/**
 * Force the active chart back to STATUS after import.
 */
export function resetActiveChartToStatusAfterImport(): void {
  setActiveChartMode("status");
}

export function exportStatus(): void {
  downloadJson(collectExportPayload(), "odontogram-status");
}

export function exportFhir(options?: FhirExportOptions): Any {
  const merged: FhirExportOptions = {
    ...options,
    codingPack: options?.codingPack ?? resolveCodingPack(diagnosisCodingPack),
    snomed: options?.snomed ?? snomedEnabled,
  };
  const bundle = buildFhirBundle(collectExportPayload(), merged);
  downloadJson(bundle, "odontogram-fhir");
  return bundle;
}

export function __hydrateImportedChartsForTest(data: Any): void {
  hydrateImportedCharts(data);
}

export function __importStatusForTest(data: Any): void {
  if(!data || typeof data !== "object") return;
  hydrateImportedCharts(data);
  resetActiveChartToStatusAfterImport();
}
