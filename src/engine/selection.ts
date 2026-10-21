import { toothState } from "@/state/chart";
import { defaultState } from "@/state/payload";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export let activeTooth: number | null = null;
export let selectedTeeth: Set<number> = new Set<number>();

let applyToSelectedHandler: ((fn: (s: Any, toothNo: number) => void) => void) | null = null;
let clearSelectionHandler: (() => void) | null = null;

/**
 * Register the engine's apply-to-selected mutation runner.
 */
export function setApplyToSelectedHandler(handler: (fn: (s: Any, toothNo: number) => void) => void): void {
  applyToSelectedHandler = handler;
}

/**
 * Register the UI cleanup handler called when clearSelection() runs.
 */
export function setClearSelectionHandler(handler: () => void): void {
  clearSelectionHandler = handler;
}

/**
 * Set the currently active tooth.
 */
export function setActiveTooth(toothNo: number | null): void {
  activeTooth = toothNo;
}

/**
 * Set the currently selected teeth set.
 */
export function setSelectedTeeth(teeth: Iterable<number>): void {
  selectedTeeth = new Set(teeth);
}

/**
 * Clear the current tooth selection and reset the active tooth.
 */
export function clearSelection(): void {
  selectedTeeth = new Set();
  activeTooth = null;
  clearSelectionHandler?.();
}

/**
 * The currently selected teeth, as FDI numbers, in the order they were added.
 */
export function getSelectedTeeth(): number[] {
  return Array.from(selectedTeeth) as number[];
}

/**
 * Apply a mutation callback across all currently selected teeth.
 */
export function applyToSelected(fn: (s: Any, toothNo: number) => void): void {
  if(applyToSelectedHandler){
    applyToSelectedHandler(fn);
  }
}

/**
 * TEST-ONLY: set the active tooth (and lazily vivify its state).
 */
export function __setActiveToothForTest(toothNo: number | null): void {
  activeTooth = toothNo;
  if(toothNo != null && !toothState.get(toothNo)) toothState.set(toothNo, defaultState());
}

/**
 * TEST-ONLY: seed the current selection (and active tooth).
 */
export function __setSelectionForTest(toothNos: number[]): void {
  selectedTeeth = new Set(toothNos);
  activeTooth = toothNos.length > 0 ? toothNos[0] : null;
  for(const tn of toothNos){ if(!toothState.get(tn)) toothState.set(tn, defaultState()); }
}
