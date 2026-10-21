import { toothState, getChartMode } from "@/state/chart";
import { defaultState, isToothPresent, isUnderGum, isExtraction, perioRowHidden } from "@/state/payload";
import { t } from "@/i18n/useI18n";
import { optionsFor } from "@/registry/uiOptions";
import {
  getApicalDxOptions,
  getResorptionOptions,
  getPulpOptions,
  getEndoOptions,
  pulpEndoDisplayValue,
  pulpEndoOnSelect,
  isEndoValue,
  periapicalRowVisible,
} from "@/state/pulpApical";
import {
  getPeriapicalTypeOptions,
  getMobilityOptions,
  getPeriImplantOptions,
  mobilityDisabled,
  mobilityRowHidden,
  applyPeriImplantSelection,
} from "@/engine/clinicalOptions";
import { activeTooth, selectedTeeth, applyToSelected } from "@/engine/selection";
import type {
  ActiveRootPerio,
  ActiveRootPerioMod,
  RootPerioOption,
  RootPerioOptGroup,
} from "@/engine/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const MOD_OPTIONS = optionsFor("mods");

export function getActiveRootPerio(): ActiveRootPerio {
  const state = (activeTooth != null ? toothState.get(activeTooth) : null) ?? defaultState();
  const isPlan = getChartMode() === "plan";
  const isMilktooth = state.toothSelection === "milktooth";
  const isImplant = state.toothSelection === "implant";
  const present = isToothPresent(state.toothSelection);
  const underGum = isUnderGum(state.toothSelection);
  const extraction = isExtraction(state.toothSelection) || (state.toothSelection === "none" && state.extractionWound);

  const apicalDxOptions = getApicalDxOptions();
  if(!apicalDxOptions.some(o => o.value === state.apicalDx)) state.apicalDx = apicalDxOptions[0]?.value ?? "normal";
  const periapicalTypeOptions = getPeriapicalTypeOptions();
  if(!periapicalTypeOptions.some(o => o.value === state.periapicalType)) state.periapicalType = periapicalTypeOptions[0]?.value ?? "none";
  const resorptionOptions = getResorptionOptions();
  if(!resorptionOptions.some(o => o.value === state.resorptionType)) state.resorptionType = resorptionOptions[0]?.value ?? "none";
  const mobilityOptions = getMobilityOptions();
  if(!mobilityOptions.some(o => o.value === state.mobility)) state.mobility = mobilityOptions[0]?.value ?? "none";
  const periImplantOptions = getPeriImplantOptions();
  if(!periImplantOptions.some(o => o.value === state.periImplant)) state.periImplant = periImplantOptions[0]?.value ?? "none";

  const pulpEndoSelected = pulpEndoDisplayValue(state);
  let pulpEndoNoneOption: RootPerioOption | null = null;
  let pulpEndoGroups: RootPerioOptGroup[];
  let pulpEndoValue: string;
  if(!isPlan){
    pulpEndoGroups = [
      { label: t("pulpEndo.groupVital"), options: getPulpOptions() },
      { label: t("pulpEndo.groupTreated"), options: getEndoOptions(isMilktooth).filter(o => o.value !== "none") },
    ];
    pulpEndoValue = pulpEndoSelected;
  }else{
    const endoOpts = getEndoOptions(isMilktooth);
    const none = endoOpts.find(o => o.value === "none");
    pulpEndoNoneOption = none ?? null;
    pulpEndoGroups = [
      { label: t("pulpEndo.groupTreated"), options: endoOpts.filter(o => o.value !== "none") },
    ];
    pulpEndoValue = isEndoValue(pulpEndoSelected) ? pulpEndoSelected : "none";
  }

  const endoDisabled = !present || underGum || extraction;

  const selectedArr = selectedTeeth.size > 0 ? Array.from(selectedTeeth) : [];
  const hiddenSelected = selectedArr.length > 0 && selectedArr.some(tn => {
    const sel = toothState.get(tn)?.toothSelection;
    return sel === "implant" || sel === "none" || sel === "tooth-under-gum" || sel === "no-tooth-after-extraction";
  });
  const noneSelected = selectedArr.length > 0 && selectedArr.some(tn => toothState.get(tn)?.toothSelection === "none");
  const hideByBase = isImplant || state.toothSelection === "none" || underGum || extraction || hiddenSelected;
  const hideByNone = state.toothSelection === "none" || noneSelected;

  const mods: ActiveRootPerioMod[] = MOD_OPTIONS.map((opt) => {
    if(opt.value === "parodontal"){
      return {
        value: "parodontal",
        label: t("mods.parodontal"),
        checked: state.mods.has("parodontal"),
        disabled: extraction,
        hiddenClass: isImplant,
        styleHidden: extraction,
      };
    }
    return {
      value: "inflammation",
      label: extraction ? t("mods.periodontalInflammation") : t("mods.periapicalInflammation"),
      checked: state.mods.has("inflammation"),
      disabled: false,
      hiddenClass: isImplant || (present && !extraction),
      styleHidden: false,
    };
  });

  return {
    sectionVisible: !(hideByBase && (hideByNone || isPlan)),
    rootBlockVisible: !hideByBase,
    perioBlockVisible: !(hideByNone || isPlan),
    pulpEndoValue,
    pulpEndoNoneOption,
    pulpEndoGroups,
    pulpEndoDisabled: endoDisabled,
    apicalDxValue: state.apicalDx,
    apicalDxOptions,
    apicalDxDisabled: endoDisabled,
    apicalDxRowVisible: !isPlan,
    periapicalTypeValue: state.periapicalType,
    periapicalTypeOptions,
    periapicalRowVisible: periapicalRowVisible(state) && !isPlan,
    resorptionValue: state.resorptionType,
    resorptionOptions,
    resorptionDisabled: endoDisabled,
    resorptionRowVisible: !isPlan,
    endoResectionChecked: !!state.endoResection,
    endoResectionDisabled: endoDisabled,
    parapulpalPinChecked: !!state.parapulpalPin,
    parapulpalPinDisabled: endoDisabled,
    mobilityValue: state.mobility,
    mobilityOptions,
    mobilityDisabled: mobilityDisabled(state),
    mobilityRowVisible: !mobilityRowHidden(state),
    perioRowVisible: !perioRowHidden(state),
    mods,
    calculusChecked: !!state.calculus,
    calculusRowVisible: activeTooth != null && (state.toothSelection === "tooth-base" || state.toothSelection === "milktooth"),
    periImplantValue: state.periImplant,
    periImplantOptions,
    periImplantRowVisible: isImplant,
  };
}

export function setPulpEndoForSelection(value: string): void {
  applyToSelected((s: Any)=>{ pulpEndoOnSelect(s, value); });
}

export function setApicalDxForSelection(value: string): void {
  applyToSelected((s: Any)=>{
    s.apicalDx = value;
    if(value !== "symptomatic-apical-periodontitis" && value !== "asymptomatic-apical-periodontitis"){
      s.periapicalType = "none";
    }
  });
}

export function setPeriapicalTypeForSelection(value: string): void {
  applyToSelected((s: Any)=>{ s.periapicalType = value; });
}

export function setResorptionForSelection(value: string): void {
  applyToSelected((s: Any)=>{ s.resorptionType = value; });
}

export function setEndoResectionForSelection(on: boolean): void {
  applyToSelected((s: Any)=>{ s.endoResection = on; });
}

export function setParapulpalPinForSelection(on: boolean): void {
  applyToSelected((s: Any)=>{ s.parapulpalPin = on; });
}

export function setMobilityForSelection(value: string): void {
  applyToSelected((s: Any)=>{ s.mobility = value; });
}

export function setModForSelection(id: string, on: boolean): void {
  applyToSelected((s: Any)=>{ if(on) s.mods.add(id); else s.mods.delete(id); });
}

export function setCalculusForSelection(on: boolean): void {
  applyToSelected((s: Any)=>{ s.calculus = on; });
}

export function setPeriImplantForSelection(value: string): void {
  applyToSelected((s: Any)=>{ applyPeriImplantSelection(s, value); });
}
