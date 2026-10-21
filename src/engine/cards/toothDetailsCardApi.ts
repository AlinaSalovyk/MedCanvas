import { toothState, getChartMode } from "@/state/chart";
import {
  defaultState,
  isUnderGum,
  isExtraction,
} from "@/state/payload";
import { MILKTOOTH_BLOCKED, BROKEN_VARIANTS } from "@/engine/constants";
import {
  getToothSelectOptions,
  getSubstrateOptions,
  getRestorationOptions,
  restorationViewFor,
  restorationRowHidden,
  applyRestorationSelection,
} from "@/engine/clinicalOptions";
import {
  getWearEdgeOptions,
  getWearCervicalOptions,
  getDiscolorationOptions,
  wearRowAllowed,
  discolorationAllowed,
} from "@/state/pulpApical";
import {
  getWearDetailLevel,
  getDiscolorationDetailLevel,
} from "@/engine/sessionSettings";
import { activeTooth, selectedTeeth, applyToSelected } from "@/engine/selection";
import type {
  ActiveToothDetails,
  ToothDetailsOption,
  ExtractionPlanParent,
} from "@/engine/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let edentulousResetter: (() => void) | null = null;
let resetToothHandler: (() => void) | null = null;

export function setEdentulousResetter(fn: () => void): void {
  edentulousResetter = fn;
}

export function setResetToothHandler(fn: () => void): void {
  resetToothHandler = fn;
}

function toothSelectOptionsForCard(): ToothDetailsOption[] {
  const selectedArr = selectedTeeth.size > 0 ? Array.from(selectedTeeth) : [];
  const anyBlocked = selectedArr.length > 0
    ? selectedArr.some(tn => MILKTOOTH_BLOCKED.has(Number(tn)))
    : (activeTooth ? MILKTOOTH_BLOCKED.has(activeTooth) : false);
  return getToothSelectOptions().map(o => o.value === "milktooth" ? { ...o, disabled: anyBlocked } : o);
}

export function getActiveToothDetails(): ActiveToothDetails {
  const isPlan = getChartMode() === "plan";
  const toothSelectOptions = toothSelectOptionsForCard();
  const substrateOptions = getSubstrateOptions();
  const wearEdgeOptions = getWearEdgeOptions();
  const wearCervicalOptions = getWearCervicalOptions();
  const discolorationOptions = getDiscolorationOptions();
  const restoView = restorationViewFor(activeTooth);

  const hasActive = activeTooth != null;

  if(!hasActive){
    const d = defaultState();
    const restorationOptions = getRestorationOptions(restoView, { isImplant: false, toothSelection: d.toothSelection });
    return {
      toothSelectValue: d.toothSelection,
      toothSelectOptions,
      substrateValue: d.toothSubstrate,
      substrateOptions,
      substrateRowVisible: true,
      extractionWoundChecked: false,
      extractionRowVisible: true,
      missingClosedChecked: false,
      missingClosedRowVisible: true,
      restorationValue: `${d.restorationType}|${d.restorationMaterial}`,
      restorationOptions,
      restorationRowVisible: true,
      crownLeakageChecked: false,
      crownLeakageRowVisible: false,
      brokenMesialChecked: false,
      brokenIncisalChecked: false,
      brokenDistalChecked: false,
      brokenCrownRowVisible: true,
      contactMesialChecked: false,
      contactDistalChecked: false,
      contactPointRowVisible: true,
      bruxismRowVisible: true,
      wearSimple: false,
      wearEdgeValue: d.wearEdge,
      wearEdgeOptions,
      wearEdgeToggleChecked: false,
      wearCervicalValue: d.wearCervical,
      wearCervicalOptions,
      wearCervicalToggleChecked: false,
      discolorationRowVisible: true,
      discoSimple: false,
      discolorationValue: d.discoloration,
      discolorationOptions,
      discolorationToggleChecked: false,
      crownActionsRowVisible: true,
      bridgePillarChecked: false,
      bridgePillarRowVisible: true,
      extractionPlanChecked: false,
      extractionPlanRowVisible: true,
      extractionPlanParent: "crownActionsRow",
      crownReplaceChecked: false,
      crownReplaceRowVisible: true,
      crownNeededChecked: false,
      crownNeededRowVisible: true,
    };
  }

  const state = (toothState.get(activeTooth) ?? defaultState()) as Any;
  const isMilktooth = state.toothSelection === "milktooth";
  const isImplant = state.toothSelection === "implant";
  const underGum = isUnderGum(state.toothSelection);
  const extraction = isExtraction(state.toothSelection) || (state.toothSelection === "none" && state.extractionWound);

  if(!wearEdgeOptions.some(o => o.value === state.wearEdge)) state.wearEdge = wearEdgeOptions[0]?.value ?? "none";
  if(!wearCervicalOptions.some(o => o.value === state.wearCervical)) state.wearCervical = wearCervicalOptions[0]?.value ?? "none";
  if(!discolorationOptions.some(o => o.value === state.discoloration)) state.discoloration = discolorationOptions[0]?.value ?? "none";
  if(!substrateOptions.some(o => o.value === state.toothSubstrate)) state.toothSubstrate = substrateOptions[0]?.value ?? "natural";

  const restorationOptions = getRestorationOptions(restoView, { isImplant, toothSelection: state.toothSelection });
  const restoSelected = state.prosthesis && state.prosthesis !== "none"
    ? `prosthesis|${state.prosthesis}`
    : `${state.restorationType}|${state.restorationMaterial}`;
  let restorationValue = restorationOptions.some(o => o.value === restoSelected)
    ? restoSelected
    : (restorationOptions[0]?.value ?? "");
  if(restorationValue.startsWith("prosthesis|")){
    const p = restorationValue.slice("prosthesis|".length);
    if(state.prosthesis !== p){ state.prosthesis = p; }
    state.restorationType = "none";
    state.restorationMaterial = "none";
  }else{
    const [selType, selMat] = restorationValue.split("|");
    if(selType !== state.restorationType || selMat !== state.restorationMaterial){
      state.restorationType = selType || "none";
      state.restorationMaterial = selMat || "none";
    }
    if(state.prosthesis !== "none"){ state.prosthesis = "none"; }
  }
  if(isMilktooth || underGum || extraction || state.toothSubstrate === "radix"){
    state.restorationType = "none";
    state.restorationMaterial = "none";
    restorationValue = "none|none";
  }
  if(state.toothSelection !== "tooth-base"){
    state.toothSubstrate = "natural";
  }

  const selectedArr = selectedTeeth.size > 0 ? Array.from(selectedTeeth) : [];
  const selectedList = selectedArr.length > 0 ? selectedArr : (activeTooth ? [activeTooth] : []);
  const hideRestorationRow = restorationRowHidden(state);
  const hideSubstrateRow = state.toothSelection !== "tooth-base";
  const contactAllowed = selectedList.length > 0 && selectedList.every(tn => {
    const s = toothState.get(tn);
    const allowedBase = s && (s.toothSelection === "tooth-base" || s.toothSelection === "milktooth" || BROKEN_VARIANTS.has(s.toothSelection));
    if(!allowedBase) return false;
    if(s.toothSelection === "tooth-base" && s.restorationType !== "none") return false;
    return true;
  });
  const bruxismAllowed = !isPlan && selectedList.length > 0 && selectedList.every(tn => {
    const s = toothState.get(tn);
    return s && wearRowAllowed(s);
  });
  const discolorationRowAllowed = !isPlan && selectedList.length > 0 && selectedList.every(tn => {
    const s = toothState.get(tn);
    return s && discolorationAllowed(s);
  });
  const extractionPlanAllowed = selectedList.length > 0 && selectedList.every(tn => {
    const s = toothState.get(tn);
    return s && ["tooth-base","milktooth","implant","tooth-under-gum"].includes(s.toothSelection);
  });
  const crownReplaceAllowed = selectedList.length > 0 && selectedList.every(tn => {
    const s = toothState.get(tn);
    return s && s.toothSelection === "tooth-base" && s.restorationType !== "none";
  });
  const crownNeededAllowed = selectedList.length > 0 && selectedList.every(tn => {
    const s = toothState.get(tn);
    return s && s.toothSelection === "tooth-base" && s.restorationType === "none" && ["natural","broken","crownprep"].includes(s.toothSubstrate);
  });
  const missingClosedAllowed = selectedList.length > 0 && selectedList.every(tn => {
    const s = toothState.get(tn);
    return s && s.toothSelection === "none";
  });
  const restorationRowCurrentlyHidden = hideRestorationRow;
  const bridgePillarAllowed = !restorationRowCurrentlyHidden && state.restorationType !== "none";
  const crownLeakageAllowed = !restorationRowCurrentlyHidden && (state.restorationType === "crown" || state.restorationType === "bridge");

  const brokenMode = state.toothSubstrate === "broken" && state.toothSelection === "tooth-base";
  let extractionPlanParent: ExtractionPlanParent;
  let crownActionsRowVisible: boolean;
  if(brokenMode){
    extractionPlanParent = "brokenCrownRow";
    crownActionsRowVisible = false;
  }else if(bruxismAllowed){
    extractionPlanParent = "bruxismRow";
    crownActionsRowVisible = false;
  }else{
    extractionPlanParent = "crownActionsRow";
    crownActionsRowVisible = extractionPlanAllowed;
  }

  return {
    toothSelectValue: state.toothSelection,
    toothSelectOptions,
    substrateValue: state.toothSubstrate,
    substrateOptions,
    substrateRowVisible: !hideSubstrateRow,
    extractionWoundChecked: !!state.extractionWound,
    extractionRowVisible: state.toothSelection === "none",
    missingClosedChecked: !!state.missingClosed,
    missingClosedRowVisible: missingClosedAllowed,
    restorationValue,
    restorationOptions,
    restorationRowVisible: !hideRestorationRow,
    crownLeakageChecked: !!state.crownLeakage,
    crownLeakageRowVisible: crownLeakageAllowed,
    brokenMesialChecked: !!state.brokenMesial,
    brokenIncisalChecked: !!state.brokenIncisal,
    brokenDistalChecked: !!state.brokenDistal,
    brokenCrownRowVisible: !(state.toothSubstrate !== "broken" || hideSubstrateRow),
    contactMesialChecked: !!state.contactMesial,
    contactDistalChecked: !!state.contactDistal,
    contactPointRowVisible: contactAllowed,
    bruxismRowVisible: bruxismAllowed,
    wearSimple: getWearDetailLevel() === "simple",
    wearEdgeValue: state.wearEdge,
    wearEdgeOptions,
    wearEdgeToggleChecked: state.wearEdge !== "none",
    wearCervicalValue: state.wearCervical,
    wearCervicalOptions,
    wearCervicalToggleChecked: state.wearCervical !== "none",
    discolorationRowVisible: discolorationRowAllowed,
    discoSimple: getDiscolorationDetailLevel() === "simple",
    discolorationValue: state.discoloration,
    discolorationOptions,
    discolorationToggleChecked: state.discoloration !== "none",
    crownActionsRowVisible,
    bridgePillarChecked: !!state.bridgePillar,
    bridgePillarRowVisible: bridgePillarAllowed,
    extractionPlanChecked: !!state.extractionPlan,
    extractionPlanRowVisible: extractionPlanAllowed,
    extractionPlanParent,
    crownReplaceChecked: !!state.crownReplace,
    crownReplaceRowVisible: crownReplaceAllowed,
    crownNeededChecked: !!state.crownNeeded,
    crownNeededRowVisible: crownNeededAllowed,
  };
}

export function setToothSelectionForSelection(value: string): void {
  applyToSelected((s: Any, toothNo: number)=>{
    if(value === "milktooth" && MILKTOOTH_BLOCKED.has(toothNo)){
      return;
    }
    const next = defaultState();
    next.toothSelection = value;
    if(!["tooth-base","milktooth","implant","tooth-under-gum"].includes(value)){
      next.extractionPlan = false;
    }
    if(value !== "none"){
      next.extractionWound = false;
    }
    if(value === "implant" || value === "none"){
      next.caries.clear();
      next.endo = "none";
      next.pulpDx = "normal";
      next.fillingMaterial = "none";
      next.fillingSurfaces.clear();
    }
    toothState.set(toothNo, next);
  });
  if(value !== "none") edentulousResetter?.();
}

export function setSubstrateForSelection(value: string): void {
  applyToSelected((s: Any)=>{
    s.toothSubstrate = value;
    if(value !== "broken"){
      s.brokenMesial = false;
      s.brokenIncisal = false;
      s.brokenDistal = false;
    }
    if(!["natural","broken","crownprep"].includes(value) || s.restorationType !== "none"){
      s.crownNeeded = false;
    }
  });
  edentulousResetter?.();
}

export function setRestorationForSelection(value: string): void {
  const v = String(value);
  applyToSelected((s: Any)=>{ applyRestorationSelection(s, v); });
  edentulousResetter?.();
}

export function setExtractionWoundForSelection(on: boolean): void { applyToSelected((s: Any)=>{ s.extractionWound = on; }); }
export function setExtractionPlanForSelection(on: boolean): void { applyToSelected((s: Any)=>{ s.extractionPlan = on; }); }
export function setCrownReplaceForSelection(on: boolean): void { applyToSelected((s: Any)=>{ s.crownReplace = on; }); }
export function setCrownNeededForSelection(on: boolean): void { applyToSelected((s: Any)=>{ s.crownNeeded = on; }); }
export function setCrownLeakageForSelection(on: boolean): void { applyToSelected((s: Any)=>{ s.crownLeakage = on; }); }
export function setMissingClosedForSelection(on: boolean): void { applyToSelected((s: Any)=>{ s.missingClosed = on; }); }
export function setContactMesialForSelection(on: boolean): void { applyToSelected((s: Any)=>{ s.contactMesial = on; }); }
export function setContactDistalForSelection(on: boolean): void { applyToSelected((s: Any)=>{ s.contactDistal = on; }); }
export function setBridgePillarForSelection(on: boolean): void { applyToSelected((s: Any)=>{ s.bridgePillar = on; }); }
export function setBrokenMesialForSelection(on: boolean): void { applyToSelected((s: Any)=>{ s.brokenMesial = on; }); }
export function setBrokenIncisalForSelection(on: boolean): void { applyToSelected((s: Any)=>{ s.brokenIncisal = on; }); }
export function setBrokenDistalForSelection(on: boolean): void { applyToSelected((s: Any)=>{ s.brokenDistal = on; }); }
export function setWearEdgeForSelection(value: string): void { applyToSelected((s: Any)=>{ s.wearEdge = value; }); }
export function setWearCervicalForSelection(value: string): void { applyToSelected((s: Any)=>{ s.wearCervical = value; }); }
export function setDiscolorationForSelection(value: string): void { applyToSelected((s: Any)=>{ s.discoloration = value; }); }
export function setWearEdgeToggleForSelection(on: boolean): void { applyToSelected((s: Any)=>{ s.wearEdge = on ? "attrition" : "none"; }); }
export function setWearCervicalToggleForSelection(on: boolean): void { applyToSelected((s: Any)=>{ s.wearCervical = on ? "abrasion" : "none"; }); }
export function setDiscolorationToggleForSelection(on: boolean): void { applyToSelected((s: Any)=>{ s.discoloration = on ? "other" : "none"; }); }

export function resetTooth(): void {
  resetToothHandler?.();
}
