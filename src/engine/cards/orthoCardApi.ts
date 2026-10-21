import { toothState } from "@/state/chart";
import { defaultState } from "@/state/payload";
import {
  getOrthoApplianceOptions,
  getOrthoDriftOptions,
  getOrthoVerticalOptions,
  orthoAllowed,
} from "@/state/pulpApical";
import { activeTooth, selectedTeeth, applyToSelected } from "@/engine/selection";
import type { ActiveOrtho } from "@/engine/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export function getActiveOrtho(): ActiveOrtho | null {
  if(activeTooth == null) return null;
  const state = toothState.get(activeTooth) ?? defaultState();
  const applianceOpts = getOrthoApplianceOptions();
  if(!applianceOpts.some(o => o.value === state.orthoAppliance)) state.orthoAppliance = applianceOpts[0]?.value ?? "none";
  const driftOpts = getOrthoDriftOptions();
  if(!driftOpts.some(o => o.value === state.orthoDrift)) state.orthoDrift = driftOpts[0]?.value ?? "none";
  const verticalOpts = getOrthoVerticalOptions();
  if(!verticalOpts.some(o => o.value === state.orthoVertical)) state.orthoVertical = verticalOpts[0]?.value ?? "none";
  const selectedList = selectedTeeth.size > 0 ? Array.from(selectedTeeth) : [activeTooth];
  const visible = selectedList.length > 0 && selectedList.every(tn => {
    const s = toothState.get(tn);
    return s && orthoAllowed(s);
  });
  return {
    appliance: state.orthoAppliance,
    drift: state.orthoDrift,
    vertical: state.orthoVertical,
    rotation: state.orthoRotation === true,
    visible,
  };
}

export function setOrthoApplianceForSelection(value: string): void {
  applyToSelected((s: Any)=>{ s.orthoAppliance = value; });
}

export function setOrthoDriftForSelection(value: string): void {
  applyToSelected((s: Any)=>{ s.orthoDrift = value; });
}

export function setOrthoVerticalForSelection(value: string): void {
  applyToSelected((s: Any)=>{ s.orthoVertical = value; });
}

export function setOrthoRotationForSelection(on: boolean): void {
  applyToSelected((s: Any)=>{ s.orthoRotation = on; });
}
