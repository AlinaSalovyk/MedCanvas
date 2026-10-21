import { toothState } from "@/state/chart";
import { defaultState, isUnderGum, isExtraction } from "@/state/payload";
import { t } from "@/i18n/useI18n";
import { surfaceLetter, surfaceLabelKey } from "@/engine/surfaceHelpers";
import { icdasToThreeLevel, applyFillingDefect } from "@/engine/cariesMutations";
import { getFillingOptions, fillingDefectOptions } from "@/engine/clinicalOptions";
import {
  computeFillingSubcariesSummaryLine,
  computeFillingDefectSummaryLine,
} from "@/engine/fillingSummary";
import {
  icdasEnabled,
  fillingComplexity,
  fillingDefectEnabled,
  fissureSealingEnabled,
} from "@/engine/sessionSettings";
import { FISSURE_ALLOWED } from "@/engine/constants";
import { activeTooth, selectedTeeth, applyToSelected } from "@/engine/selection";
import type { ActiveFillings, ActiveFillingSurface } from "@/engine/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const FILLING_SURFACE_CELLS: Array<{ value: string; surface: string; pos: string }> = [
  { value: "buccal", surface: "buccal", pos: "buccal" },
  { value: "mesial", surface: "mesial", pos: "mesial" },
  { value: "occlusal", surface: "occlusal", pos: "occlusal" },
  { value: "distal", surface: "distal", pos: "distal" },
  { value: "lingual", surface: "lingual", pos: "lingual" },
];

export function getActiveFillings(): ActiveFillings {
  const realState = activeTooth != null ? toothState.get(activeTooth) : null;
  const state = realState ?? defaultState();
  const toothNo = activeTooth ?? null;

  const isMilktooth = state.toothSelection === "milktooth";
  const fillingOptions = getFillingOptions(isMilktooth);

  let fillingMaterial = state.fillingMaterial;
  if(!fillingOptions.some(o => o.value === fillingMaterial)){
    fillingMaterial = fillingOptions[0]?.value ?? "none";
    if(realState) realState.fillingMaterial = fillingMaterial;
  }

  const surfaces: ActiveFillingSurface[] = FILLING_SURFACE_CELLS.map((cell) => {
    const surface = cell.surface;
    const filled = state.fillingSurfaceMaterials.has(surface);
    const hasSubcaries = filled && state.caries.has(`caries-${surface}`);
    const code = state.cariesSeverity.get(surface) || 2;
    const defVal = state.fillingDefect?.get(surface);
    const hasDefect = filled && !!defVal && defVal !== "none";
    return {
      value: cell.value,
      surface,
      pos: cell.pos,
      letter: surfaceLetter(surface, toothNo),
      label: t(surfaceLabelKey(surface, toothNo)),
      labelId: `lbl-${surface}`,
      checked: filled,
      material: state.fillingSurfaceMaterials.get(surface) || "",
      hasSubcaries,
      subDepth: icdasToThreeLevel(code),
      subIcdas: code,
      isIcdas: icdasEnabled,
      hasDefect,
      defectValue: hasDefect ? String(defVal) : null,
    };
  });

  const hasCrown = state.restorationType !== "none";
  const showFillingSurfaces = fillingMaterial !== "none" && !hasCrown;
  const simpleMode = fillingComplexity === "simple";
  const filledCount = state.fillingSurfaceMaterials.size;
  const firstSurf = [...state.fillingSurfaceMaterials.keys()][0];
  const simpleDefectValue = firstSurf ? (state.fillingDefect?.get(firstSurf) ?? "none") : "none";

  const selectedArr = selectedTeeth.size > 0 ? Array.from(selectedTeeth) : [];
  const selectedList = selectedArr.length > 0 ? selectedArr : (activeTooth != null ? [activeTooth] : []);
  const fissureAllowed = selectedList.length > 0 && selectedList.every(tn => {
    const s = toothState.get(tn);
    return !!s && s.toothSelection === "tooth-base" && FISSURE_ALLOWED.has(tn as number);
  });
  const fissureRowVisible = selectedList.length === 0 ? true : (fissureAllowed && fissureSealingEnabled);

  const underGum = isUnderGum(state.toothSelection);
  const extraction = isExtraction(state.toothSelection) || (state.toothSelection === "none" && state.extractionWound);
  const hiddenSelected = selectedArr.length > 0 && selectedArr.some(tn => {
    const sel = toothState.get(tn)?.toothSelection;
    return sel === "implant" || sel === "none" || sel === "tooth-under-gum" || sel === "no-tooth-after-extraction";
  });
  const hideByBase = state.toothSelection === "implant" || state.toothSelection === "none" || underGum || extraction || hiddenSelected;
  const hideFillingsByCrown = state.toothSelection === "tooth-base" && hasCrown;

  return {
    surfaces,
    fillingMaterial,
    fillingOptions,
    surfaceGridVisible: showFillingSurfaces && !simpleMode,
    defectDisabled: !fillingDefectEnabled,
    simpleMode,
    simpleRowVisible: showFillingSurfaces && simpleMode,
    simpleToggleChecked: filledCount > 0,
    simpleDefectRowVisible: showFillingSurfaces && simpleMode && fillingDefectEnabled && filledCount > 0,
    simpleDefectValue,
    simpleDefectOptions: fillingDefectOptions(),
    fissureSealing: !!state.fissureSealing,
    fissureRowVisible,
    fillingSectionVisible: !(hideByBase || hideFillingsByCrown),
    subcariesSummary: computeFillingSubcariesSummaryLine(selectedArr as number[], (tn) => toothState.get(tn)),
    defectSummary: computeFillingDefectSummaryLine(selectedArr as number[], (tn) => toothState.get(tn)),
  };
}

export function setFillingMaterialForSelection(mat: string): void {
  applyToSelected((s: Any)=>{
    s.fillingMaterial = mat;
    if(mat === "none"){
      s.fillingSurfaces.clear();
      s.fillingSurfaceMaterials.clear();
    }
  });
}

export function setFillingSurfaceForSelection(surf: string, on: boolean): void {
  applyToSelected((s: Any)=>{
    if(on && s.fillingMaterial !== "none"){
      s.fillingSurfaces.add(surf);
      s.fillingSurfaceMaterials.set(surf, s.fillingMaterial);
    }else{
      s.fillingSurfaces.delete(surf);
      s.fillingSurfaceMaterials.delete(surf);
    }
  });
}

export function setFillingSimpleToggleForSelection(on: boolean): void {
  applyToSelected((s: Any)=>{
    if(on){
      const mat = s.fillingMaterial !== "none" ? s.fillingMaterial : "composite";
      for(const surf of ["buccal", "mesial", "occlusal", "distal", "lingual"]){
        s.fillingSurfaceMaterials.set(surf, mat);
        s.fillingSurfaces.add(surf);
      }
    }else{
      s.fillingSurfaceMaterials.clear();
      s.fillingSurfaces.clear();
      s.fillingDefect.clear();
    }
  });
}

export function setFillingSimpleDefectForSelection(value: string): void {
  applyToSelected((s: Any)=>{
    for(const surf of (s.fillingSurfaceMaterials as Map<string, string>).keys()){
      applyFillingDefect(s.fillingDefect, surf, value);
    }
  });
}

export function setFissureSealingForSelection(on: boolean): void {
  applyToSelected((s: Any)=>{ s.fissureSealing = on; });
}
