import { toothState } from "@/state/chart";
import {
  defaultState,
  serializeState,
  TOOTH_LEVEL_DX_KEYS,
  VALID_DX_OVERRIDE_VALUE,
} from "@/state/payload";
import { notifyStateChange } from "@/state/notify";
import { deriveDentalDiagnoses, isNaturalPresent } from "@/dx/derive";
import { refineWho } from "@/dx/refine";
import { DX_CODES, type DiagnosisKey } from "@/dx/codes";
import { activeTooth, selectedTeeth, applyToSelected } from "@/engine/selection";
import { gateToothEditBatch } from "@/engine/dualStateGate";
import type { ActiveDiagnoses, ActiveDiagnosisRow } from "@/engine/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const DX_REVERSE_MAP: Record<string, (s: Any) => void> = {
  pulpitis: (s) => { s.pulpDx = "irreversible-pulpitis"; },
  pulpNecrosis: (s) => { s.pulpDx = "necrosis"; },
  apicalPeriodontitisAcute: (s) => { s.apicalDx = "symptomatic-apical-periodontitis"; },
  apicalPeriodontitisChronic: (s) => { s.apicalDx = "asymptomatic-apical-periodontitis"; },
  periapicalAbscess: (s) => { s.apicalDx = "acute-apical-abscess"; },
  periapicalAbscessSinus: (s) => { s.apicalDx = "chronic-apical-abscess"; },
  condensingOsteitis: (s) => { s.apicalDx = "condensing-osteitis"; },
  radicularCyst: (s) => { s.apicalDx = "asymptomatic-apical-periodontitis"; s.periapicalType = "cyst"; },
  calculus: (s) => { s.calculus = true; },
  cariesCementum: (s) => { s.rootCaries = "active"; },
  cariesArrested: (s) => { s.rootCaries = "arrested"; },
  resorption: (s) => { s.resorptionType = "internal"; },
  attrition: (s) => { s.wearEdge = "attrition"; },
  erosion: (s) => { s.wearEdge = "erosion"; },
  abrasion: (s) => { s.wearCervical = "abrasion"; },
  abfraction: (s) => { s.wearCervical = "abfraction"; },
  fluorosis: (s) => { s.discoloration = "fluorosis"; },
  tetracyclineStain: (s) => { s.discoloration = "tetracycline"; },
  postEruptiveColour: (s) => { s.discoloration = "other"; },
  toothLoss: (s) => { s.toothSelection = "no-tooth-after-extraction"; },
  retainedRoot: (s) => { s.toothSubstrate = "radix"; },
  toothFracture: (s) => { s.brokenMesial = true; },
};

export const REVERSE_MAPPABLE_KEYS = new Set(Object.keys(DX_REVERSE_MAP));

const DX_CLEAR_MAP: Record<string, (s: Any) => void> = {
  pulpitis: (s) => { s.pulpDx = "normal"; },
  pulpNecrosis: (s) => { s.pulpDx = "normal"; },
  apicalPeriodontitisAcute: (s) => { s.apicalDx = "normal"; },
  apicalPeriodontitisChronic: (s) => { s.apicalDx = "normal"; },
  periapicalAbscess: (s) => { s.apicalDx = "normal"; },
  periapicalAbscessSinus: (s) => { s.apicalDx = "normal"; },
  condensingOsteitis: (s) => { s.apicalDx = "normal"; },
  radicularCyst: (s) => { s.apicalDx = "normal"; s.periapicalType = "none"; },
  calculus: (s) => { s.calculus = false; },
  cariesCementum: (s) => { s.rootCaries = "none"; },
  cariesArrested: (s) => { s.rootCaries = "none"; },
  resorption: (s) => { s.resorptionType = "none"; },
  attrition: (s) => { if(s.wearEdge === "attrition") s.wearEdge = "none"; },
  erosion: (s) => { if(s.wearEdge === "erosion") s.wearEdge = "none"; if(s.wearCervical === "erosion") s.wearCervical = "none"; },
  abrasion: (s) => { if(s.wearCervical === "abrasion") s.wearCervical = "none"; },
  abfraction: (s) => { if(s.wearCervical === "abfraction") s.wearCervical = "none"; },
  fluorosis: (s) => { s.discoloration = "none"; },
  tetracyclineStain: (s) => { s.discoloration = "none"; },
  postEruptiveColour: (s) => { s.discoloration = "none"; },
  toothLoss: (s) => { s.toothSelection = "tooth-base"; },
  retainedRoot: (s) => { s.toothSubstrate = "natural"; },
  toothFracture: (s) => { s.brokenMesial = false; s.brokenIncisal = false; s.brokenDistal = false; },
  caries: (s) => { s.caries = new Set(); s.cariesSeverity = new Map(); },
};

const DX_CLEARABLE_KEYS = new Set(Object.keys(DX_CLEAR_MAP));

export function getActiveDiagnoses(): ActiveDiagnoses {
  const NONE: ActiveDiagnoses = { visible: false, rows: [], addableKeys: [] };
  if(activeTooth == null) return NONE;
  const state = toothState.get(activeTooth);
  if(!state || !isNaturalPresent({ toothSelection: state.toothSelection })) return NONE;

  const overrides: Map<string, string> | undefined = state.dxOverrides;
  const rawRec: Record<string, unknown> = { ...serializeState(state) };
  delete rawRec.dxOverrides;
  const rawItems = deriveDentalDiagnoses({ teeth: { [String(activeTooth)]: rawRec } });
  const rawSet = new Set(rawItems.map((d) => d.key as string));

  const rows: ActiveDiagnosisRow[] = rawItems.map((d) => ({
    key: d.key,
    icd10: refineWho(d.key, d.detail).icd10 ?? "",
    source: "derived",
    suppressed: overrides?.get(d.key) === "suppress",
  }));
  if(overrides){
    for(const [key, mode] of overrides){
      if(mode === "add" && !rawSet.has(key) && TOOTH_LEVEL_DX_KEYS.has(key)){
        rows.push({ key, icd10: DX_CODES[key as DiagnosisKey].icd10 ?? "", source: "added", suppressed: false });
      }
    }
  }
  rows.sort((a, b) => a.icd10.localeCompare(b.icd10));
  const rowKeys = new Set(rows.map((r) => r.key));
  const addableKeys = Array.from(REVERSE_MAPPABLE_KEYS)
    .filter((k) => !rowKeys.has(k))
    .map((k) => ({ key: k, icd10: DX_CODES[k as DiagnosisKey].icd10 ?? "" }))
    .sort((a, b) => a.icd10.localeCompare(b.icd10));

  return { visible: true, rows, addableKeys };
}

export function addDiagnosisToSelection(key: string): void {
  if(!REVERSE_MAPPABLE_KEYS.has(key)) return;
  const apply = DX_REVERSE_MAP[key];
  applyToSelected((s: Any) => apply(s));
}

export function removeDiagnosisFromSelection(key: string): void {
  if(selectedTeeth.size === 0) return;
  const clear = DX_CLEARABLE_KEYS.has(key) ? DX_CLEAR_MAP[key] : null;
  applyToSelected((s: Any) => {
    if(clear) clear(s);
    s.dxOverrides?.delete(key);
  });
}

export function setDxOverrideForSelection(key: string, mode: "add" | "suppress" | null): void {
  if(!TOOTH_LEVEL_DX_KEYS.has(key)) return;
  if(mode !== null && !VALID_DX_OVERRIDE_VALUE.has(mode)) return;
  if(selectedTeeth.size === 0) return;
  const toothNos = Array.from(selectedTeeth) as number[];
  gateToothEditBatch(toothNos, () => {
    for(const n of toothNos){
      let s = toothState.get(n);
      if(!s){ s = defaultState(); toothState.set(n, s); }
      if(mode === null) s.dxOverrides.delete(key);
      else s.dxOverrides.set(key, mode);
    }
    notifyStateChange();
  });
}
