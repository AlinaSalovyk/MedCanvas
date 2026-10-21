import { charts, chartMode, planInitialized } from "@/state/chart";
import { defaultState, serializeState, hydrateState } from "@/state/payload";
import { setToothEditGate } from "@/state/perio";
import { notifyStateChange } from "@/state/notify";

const planEditedTeeth = new Set<number>();

let pendingDualStateConfirm: { apply: () => void; revert: () => void } | null = null;
let revertControlsHandler: (() => void) | null = null;

/**
 * Register the engine's control revert hook used when a dual-state confirm is cancelled.
 */
export function setRevertControlsHandler(fn: () => void): void {
  revertControlsHandler = fn;
}

/**
 * Deep-copy tooth `toothNo`'s STATUS state into the PLAN chart via the proven
 * serializeState -> hydrateState round-trip (fresh Maps/Sets, no shared refs —
 * same guarantee as `cloneChart`).
 */
export function mirrorStatusToPlan(toothNo: number): void {
  charts.plan.set(toothNo, hydrateState(serializeState(charts.status.get(toothNo) ?? defaultState()), false));
}

/**
 * Central edit GATE for a SINGLE interactive per-tooth edit.
 */
export function gateToothEdit(toothNo: number, applyFn: () => boolean | void): void {
  if(chartMode === "plan"){
    if(applyFn() !== false) planEditedTeeth.add(toothNo);
    return;
  }
  if(!planInitialized || !planEditedTeeth.has(toothNo)){
    const changed = applyFn() !== false;
    if(planInitialized && changed) mirrorStatusToPlan(toothNo);
    return;
  }
  requestDualStateConfirm(
    () => { applyFn(); },
    () => { revertControlsHandler?.(); },
  );
}

// Wire the perio API to this same gate
setToothEditGate(gateToothEdit);

/**
 * Central edit GATE for a BATCH interactive edit spanning several teeth.
 */
export function gateToothEditBatch(toothNos: number[], applyFn: () => void): void {
  if(chartMode === "plan"){
    applyFn();
    for(const toothNo of toothNos) planEditedTeeth.add(toothNo);
    return;
  }
  if(!planInitialized){
    applyFn();
    return;
  }
  const mirrorUnplanned = () => {
    for(const toothNo of toothNos){
      if(!planEditedTeeth.has(toothNo)) mirrorStatusToPlan(toothNo);
    }
  };
  if(toothNos.some(toothNo => planEditedTeeth.has(toothNo))){
    requestDualStateConfirm(
      () => { applyFn(); mirrorUnplanned(); },
      () => { revertControlsHandler?.(); },
    );
    return;
  }
  applyFn();
  mirrorUnplanned();
}

/**
 * Store a deferred confirm (apply/revert) and notify so the host opens the modal.
 */
export function requestDualStateConfirm(apply: () => void, revert: () => void): void {
  if(pendingDualStateConfirm) return;
  pendingDualStateConfirm = { apply, revert };
  notifyStateChange();
}

/**
 * Whether a status-vs-plan divergence confirm is awaiting the user's choice.
 */
export function isDualStateConfirmPending(): boolean {
  return pendingDualStateConfirm !== null;
}

/**
 * User accepted the divergence: run the deferred edit.
 */
export function acceptDualStateConfirm(): void {
  const pending = pendingDualStateConfirm;
  pendingDualStateConfirm = null;
  if(pending) pending.apply();
  notifyStateChange();
}

/**
 * User cancelled: do NOT apply the edit; re-sync active tooth's controls.
 */
export function cancelDualStateConfirm(): void {
  const pending = pendingDualStateConfirm;
  pendingDualStateConfirm = null;
  if(pending) pending.revert();
  notifyStateChange();
}

export function clearPendingDualStateConfirm(): void {
  pendingDualStateConfirm = null;
}

/**
 * Clear the set of plan-edited teeth (called on re-init, import, plan chart replacement).
 */
export function clearPlanEditedTeeth(): void {
  planEditedTeeth.clear();
}

/**
 * Add a tooth to the plan-edited set (for testing or batch updates).
 */
export function addPlanEditedTooth(toothNo: number): void {
  planEditedTeeth.add(toothNo);
}

/**
 * TEST-ONLY inspection hook for plan-edited teeth.
 */
export function __planEditedTeethForTest(): number[] {
  return Array.from(planEditedTeeth);
}
