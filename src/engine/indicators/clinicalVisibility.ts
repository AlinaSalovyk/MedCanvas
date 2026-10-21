import { isToothPresent, isExtraction } from "@/state/payload";
import type { Any } from "@/engine/types";

/**
 * Hide the `mods.inflammation`
 * checkbox's row (built by buildChecks() as a <label> wrapping the checkbox
 * input) inside `#modsChecks` for a PRESENT tooth (tooth-base/milktooth) —
 * apicalDx now drives the periapical glyph there, so the checkbox would be a
 * redundant/confusing second control — AND for an implant, where the
 * dedicated `periImplant` axis (peri-implantitis) already covers implant
 * inflammation, making this toggle redundant there too. It stays VISIBLE for
 * a missing tooth (`toothSelection === "none"`) and for an extraction-socket
 * (`toothSelection === "no-tooth-after-extraction"`), where it marks
 * periodontal inflammation in the socket — a finding neither `apicalDx` nor
 * `periImplant` cover there (the label itself swaps to "periodontal
 * inflammation" for that case — see the `#lbl-inflammation` relabel in
 * syncControlsFromState()). MUST run AFTER syncPeriImplantVisibility() in
 * syncControlsFromState(): that function's implant-only loop also toggles
 * this same checkbox's `.hidden` class, so whichever of the two runs last
 * wins for the inflammation checkbox specifically — this one is the
 * authoritative, final word.
 */
export function syncInflammationModVisibility(container: Element | null, toothSelection: Any): void {
  if(!container) return;
  const inflChk = container.querySelector('input[value="inflammation"]') as HTMLInputElement | null;
  if(!inflChk) return;
  const inflLabel = inflChk.closest("label") || inflChk.parentElement;
  // Hidden for a present tooth or an implant; visible for missing/socket.
  // isToothPresent() alone can't express the socket case: it returns true for
  // "no-tooth-after-extraction" (neither "none" nor "implant"), so isExtraction()
  // carves that value back out of the "present" bucket to keep it visible.
  const hidden = toothSelection === "implant"
    || (isToothPresent(toothSelection) && !isExtraction(toothSelection));
  if(inflLabel) inflLabel.classList.toggle("hidden", hidden);
}

/**
 * TEST-ONLY: apply `syncInflammationModVisibility` to a hand-built
 * `#modsChecks` DOM fragment, without requiring a live initOdontogram(). Not
 * part of the public API.
 */
export function __syncInflammationModVisibilityForTest(container: Element, toothSelection: string): void {
  syncInflammationModVisibility(container, toothSelection);
}

/**
 * On an implant, the dedicated `periImplant` axis supersedes the
 * parodontal/inflammation mods (they're migrated away for implants — see
 * hydrateState's implant-mods migration), so show `#periImplantRow` only for
 * an implant and hide BOTH mod checkboxes' rows there. Composes with
 * `syncInflammationModVisibility` for the `parodontal` checkbox (order
 * doesn't matter there — nothing else touches it). For `inflammation`,
 * though, this function's blanket implant-only rule (visible for EVERY
 * non-implant selection, including a present tooth) is deliberately
 * overridden by syncInflammationModVisibility's more specific present/socket
 * rule — syncControlsFromState() calls this function FIRST and
 * syncInflammationModVisibility() AFTER, so the latter always has the final
 * say for `inflammation`.
 */
export function syncPeriImplantVisibility(periImplantRow: Element | null, modsContainer: Element | null, toothSelection: Any): void {
  const isImplantSel = toothSelection === "implant";
  if(periImplantRow) periImplantRow.classList.toggle("hidden", !isImplantSel);
  if(!modsContainer) return;
  for(const val of ["parodontal", "inflammation"]){
    const chk = modsContainer.querySelector(`input[value="${val}"]`) as HTMLInputElement | null;
    const lbl = chk ? (chk.closest("label") || chk.parentElement) : null;
    if(lbl) lbl.classList.toggle("hidden", isImplantSel);
  }
}

/**
 * TEST-ONLY: apply `syncPeriImplantVisibility` to hand-built DOM
 * fragments, without requiring a live initOdontogram(). Not part of the
 * public API.
 */
export function __syncPeriImplantVisibilityForTest(periImplantRow: Element | null, modsContainer: Element | null, toothSelection: string): void {
  syncPeriImplantVisibility(periImplantRow, modsContainer, toothSelection);
}
