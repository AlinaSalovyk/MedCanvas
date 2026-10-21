import { toothState, getChartMode } from "@/state/chart";
import { defaultState, isToothPresent, isUnderGum, isExtraction } from "@/state/payload";
import { t } from "@/i18n/useI18n";
import { surfaceLetter, surfaceLabelKey } from "@/engine/surfaceHelpers";
import { icdasToThreeLevel, rootCariesDisplayValue } from "@/engine/cariesMutations";
import {
  radiographicDepthMode,
  icdasEnabled,
  cariesDepthEnabled,
  rootCariesMode,
} from "@/engine/sessionSettings";
import { activeTooth, selectedTeeth, applyToSelected } from "@/engine/selection";
import type { ActiveCaries, ActiveCariesSurface } from "@/engine/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const CARIES_SURFACE_CELLS: Array<{ value: string; surface: string; pos: string }> = [
  { value: "caries-buccal", surface: "buccal", pos: "buccal" },
  { value: "caries-mesial", surface: "mesial", pos: "mesial" },
  { value: "caries-occlusal", surface: "occlusal", pos: "occlusal" },
  { value: "caries-distal", surface: "distal", pos: "distal" },
  { value: "caries-lingual", surface: "lingual", pos: "lingual" },
];

function cariesSectionVisible(state: Any, isPlan: boolean): boolean {
  const underGum = isUnderGum(state.toothSelection);
  const extraction = isExtraction(state.toothSelection) || (state.toothSelection === "none" && state.extractionWound);
  const selectedArr = selectedTeeth.size > 0 ? Array.from(selectedTeeth) : [];
  const hiddenSelected = selectedArr.length > 0 && selectedArr.some((tn) => {
    const sel = toothState.get(tn)?.toothSelection;
    return sel === "implant" || sel === "none" || sel === "tooth-under-gum" || sel === "no-tooth-after-extraction";
  });
  const hideByBase = state.toothSelection === "implant" || state.toothSelection === "none" || underGum || extraction || hiddenSelected;
  const hideByRadix = state.toothSubstrate === "radix";
  return !(hideByBase || hideByRadix || isPlan);
}

export function getActiveCaries(): ActiveCaries {
  const state = (activeTooth != null ? toothState.get(activeTooth) : null) ?? defaultState();
  const isPlan = getChartMode() === "plan";
  const toothNo = activeTooth ?? null;

  const hasCrown = state.restorationType !== "none";
  const hasRemovable = state.toothSelection === "none"
    && (state.prosthesis === "removable-partial" || state.prosthesis === "removable-full");
  const hasRestoration = hasCrown || hasRemovable;

  const surfaces: ActiveCariesSurface[] = CARIES_SURFACE_CELLS.map((cell) => {
    const code = state.cariesSeverity.get(cell.surface) || 2;
    const radioVal = state.radiographicDepth?.get(cell.surface);
    const radio = (radiographicDepthMode !== "off" && radioVal && radioVal !== "none")
      ? radioVal : null;
    return {
      value: cell.value,
      surface: cell.surface,
      pos: cell.pos,
      letter: surfaceLetter(cell.surface, toothNo),
      label: t(surfaceLabelKey(cell.surface, toothNo)),
      checked: state.caries.has(cell.value),
      disabled: hasRestoration || hasCrown,
      depth: icdasToThreeLevel(code),
      icdas: code,
      isIcdas: icdasEnabled,
      radio,
    };
  });

  return {
    surfaces,
    subcrownChecked: state.caries.has("caries-subcrown"),
    subcrownDisabled: !hasCrown,
    subcrownLabel: t("surface.subcrown"),
    cariesActiveDepth: state.cariesActiveDepth,
    rootCariesDisplay: rootCariesDisplayValue(rootCariesMode, state.rootCaries),
    cariesDepthVisible: cariesDepthEnabled && !isPlan,
    rootCariesVisible: isToothPresent(state.toothSelection) && !isPlan,
    cariesSectionVisible: cariesSectionVisible(state, isPlan),
  };
}

export function setCariesSurfaceForSelection(id: string, on: boolean): void {
  applyToSelected((s: Any)=>{
    if(on){
      s.caries.add(id);
      if(id !== "caries-subcrown") s.cariesSeverity.set(id.replace("caries-", ""), s.cariesActiveDepth);
    }else{
      s.caries.delete(id);
      s.cariesSeverity.delete(id.replace("caries-", ""));
    }
  });
}

export function setCariesActiveDepthForSelection(value: number): void {
  applyToSelected((s: Any)=>{ s.cariesActiveDepth = Number(value); });
}

export function setRootCariesForSelection(value: string): void {
  applyToSelected((s: Any)=>{ s.rootCaries = value; });
}
