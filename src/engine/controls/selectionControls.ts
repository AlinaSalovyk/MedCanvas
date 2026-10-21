/**
 * Tooth Selection Button & Filter Controls Controller
 *
 * Owns event binding and presentation updates for:
 * - All tooth-selection filter buttons (All, Present, Permanent, Milk, Implants, Missing, Arches, Segments)
 * - Clear selection buttons (panel and chart header)
 * - Filter button visibility updates based on active toothState
 * - Active tooth / selection count label presentation
 *
 * Extracted from `src/odontogram.ts` (Stage 26).
 */

import { ALL_TEETH } from "@/anatomy/profiles";
import { toothState } from "@/state/chart";
import {
  selectedTeeth,
  activeTooth,
  setSelectedTeeth,
  setActiveTooth,
} from "@/engine/selection";
import { toLabel } from "@/utils/numbering";
import { getDisplayedToothNumber, numberingSystem } from "@/state/numbering";
import { t } from "@/i18n/useI18n";
import { $ } from "@/engine/domHelpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export type BindOnceFn = (
  el: Element | null | undefined,
  type: string,
  handler: Any,
) => void;

export interface SelectionControlsDeps {
  bindOnce?: BindOnceFn;
  updateToothTileVisibility: () => void;
  updateSelectionUI: () => void;
}

const fallbackWired = new WeakMap<Element, Set<string>>();

function defaultBindOnce(el: Element | null | undefined, type: string, handler: Any): void {
  if (!el) return;
  let set = fallbackWired.get(el);
  if (!set) {
    set = new Set<string>();
    fallbackWired.set(el, set);
  }
  if (set.has(type)) return;
  set.add(type);
  el.addEventListener(type, handler);
}

/**
 * Updates the `#activeToothLabel` pill reflecting:
 * - Empty selection: "—" (t("selection.none"))
 * - Single selection: formatted displayed tooth number (e.g. "11", "55")
 * - Multi-selection: count summary (t("selection.count", { count }))
 */
export function updateActiveLabel(): void {
  const label = $("#activeToothLabel");
  if (!label) return;
  if (selectedTeeth.size === 0) {
    label.textContent = t("selection.none");
  } else if (selectedTeeth.size === 1) {
    const toothNo = activeTooth ?? Array.from(selectedTeeth)[0];
    label.textContent = toLabel(getDisplayedToothNumber(toothNo), numberingSystem);
  } else {
    label.textContent = t("selection.count", { count: selectedTeeth.size });
  }
}

/**
 * Updates filter button `.is-hidden` visibility based on the existence of
 * matching tooth statuses across `ALL_TEETH` in the active chart (`toothState`).
 */
export function updateSelectionFilterButtons(): void {
  let hasPresent = false;
  let hasMissing = false;
  let hasPermanent = false;
  let hasMilk = false;
  let hasImplant = false;
  for (const toothNo of ALL_TEETH) {
    const sel = toothState.get(toothNo)?.toothSelection;
    if (sel === "none") {
      hasMissing = true;
    } else {
      hasPresent = true;
    }
    if (sel === "tooth-base") hasPermanent = true;
    if (sel === "milktooth") hasMilk = true;
    if (sel === "implant") hasImplant = true;
  }
  $("#btnSelectAllPresent")?.classList.toggle("is-hidden", !hasPresent);
  $("#btnSelectAllMissing")?.classList.toggle("is-hidden", !hasMissing);
  $("#btnSelectPermanent")?.classList.toggle("is-hidden", !hasPermanent);
  $("#btnSelectMilk")?.classList.toggle("is-hidden", !hasMilk);
  $("#btnSelectImplants")?.classList.toggle("is-hidden", !hasImplant);
}

/**
 * Binds click event handlers for the 14 selection filter & clear buttons.
 * Uses `bindOnce` to ensure idempotent registration across repeated surface remounts.
 */
export function bindSelectionControls(deps: SelectionControlsDeps): void {
  const bindOnce = deps.bindOnce ?? defaultBindOnce;
  const { updateToothTileVisibility, updateSelectionUI } = deps;

  bindOnce($("#btnSelectAll"), "click", () => {
    setSelectedTeeth(new Set(ALL_TEETH));
    setActiveTooth(ALL_TEETH[0]);
    updateToothTileVisibility();
  });

  bindOnce($("#btnSelectAllPresent"), "click", () => {
    const present = ALL_TEETH.filter(tn => toothState.get(tn)?.toothSelection !== "none");
    setSelectedTeeth(new Set(present));
    setActiveTooth(present[0] ?? null);
    updateToothTileVisibility();
  });

  bindOnce($("#btnSelectPermanent"), "click", () => {
    const permanent = ALL_TEETH.filter(tn => toothState.get(tn)?.toothSelection === "tooth-base");
    setSelectedTeeth(new Set(permanent));
    setActiveTooth(permanent[0] ?? null);
    updateToothTileVisibility();
  });

  bindOnce($("#btnSelectMilk"), "click", () => {
    const milk = ALL_TEETH.filter(tn => toothState.get(tn)?.toothSelection === "milktooth");
    setSelectedTeeth(new Set(milk));
    setActiveTooth(milk[0] ?? null);
    updateToothTileVisibility();
  });

  bindOnce($("#btnSelectImplants"), "click", () => {
    const implants = ALL_TEETH.filter(tn => toothState.get(tn)?.toothSelection === "implant");
    setSelectedTeeth(new Set(implants));
    setActiveTooth(implants[0] ?? null);
    updateToothTileVisibility();
  });

  bindOnce($("#btnSelectAllMissing"), "click", () => {
    const missing = ALL_TEETH.filter(tn => toothState.get(tn)?.toothSelection === "none");
    setSelectedTeeth(new Set(missing));
    setActiveTooth(missing[0] ?? null);
    updateToothTileVisibility();
  });

  bindOnce($("#btnSelectUpper"), "click", () => {
    setSelectedTeeth(new Set(ALL_TEETH.filter(tn => tn >= 11 && tn <= 28)));
    setActiveTooth(11);
    updateToothTileVisibility();
  });

  bindOnce($("#btnSelectUpperFront"), "click", () => {
    const front = [13, 12, 11, 21, 22, 23];
    setSelectedTeeth(new Set(front));
    setActiveTooth(front[0]);
    updateToothTileVisibility();
  });

  bindOnce($("#btnSelectUpperMolar"), "click", () => {
    const molars = [18, 17, 16, 26, 27, 28];
    setSelectedTeeth(new Set(molars));
    setActiveTooth(molars[0]);
    updateToothTileVisibility();
  });

  bindOnce($("#btnSelectLower"), "click", () => {
    setSelectedTeeth(new Set(ALL_TEETH.filter(tn => tn >= 31 && tn <= 48)));
    setActiveTooth(31);
    updateToothTileVisibility();
  });

  bindOnce($("#btnSelectLowerFront"), "click", () => {
    const front = [43, 42, 41, 31, 32, 33];
    setSelectedTeeth(new Set(front));
    setActiveTooth(front[0]);
    updateToothTileVisibility();
  });

  bindOnce($("#btnSelectLowerMolar"), "click", () => {
    const molars = [38, 37, 36, 46, 47, 48];
    setSelectedTeeth(new Set(molars));
    setActiveTooth(molars[0]);
    updateToothTileVisibility();
  });

  bindOnce($("#btnSelectNone"), "click", () => {
    setSelectedTeeth(new Set());
    setActiveTooth(null);
    updateSelectionUI();
  });

  bindOnce($("#btnSelectNoneChart"), "click", () => {
    setSelectedTeeth(new Set());
    setActiveTooth(null);
    updateSelectionUI();
  });
}
