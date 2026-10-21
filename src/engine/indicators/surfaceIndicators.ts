import { icdasEnabled, radiographicDepthMode } from "@/engine/sessionSettings";
import { icdasToThreeLevel } from "@/engine/cariesMutations";
import type { Any } from "@/engine/types";

/**
 * Apply the per-surface caries-depth indicator attributes to one
 * `.surface-cell` (the ICDAS/3-bar `data-depth`/`data-icdas` badge, plus the
 * `data-radio` radiographic-depth attribute) for `cell`'s surface,
 * read off `state`. `radiographicDepth` is a SEPARATE, independent per-surface
 * scale from the unified visual severity `cariesSeverity` — no crosswalk between
 * them; `data-radio` never touches `data-depth`/`data-icdas`/opacity
 * or the SVG-fingerprint render (it lives outside `__renderActiveLayers`).
 * Extracted out of `syncControlsFromState` so it can be exercised without the
 * full DOM/asset-fetch wiring `initOdontogram()` needs (see
 * `__syncSurfaceDepthIndicatorForTest`).
 */
export function syncSurfaceDepthIndicator(cell: Element, state: Any): void {
  const c = cell.querySelector("input[type=checkbox]") as HTMLInputElement | null;
  const ind = cell.querySelector(".surf-depth") as HTMLElement | null;
  if(c && ind){
    const surface = String(c.value).replace("caries-", "");
    const code = state.cariesSeverity.get(surface) || 2;
    ind.setAttribute("data-depth", icdasToThreeLevel(code)); // drives 3-bar CSS
    ind.setAttribute("data-icdas", String(code));            // drives the badge
    ind.classList.toggle("icdas", icdasEnabled);
    ind.textContent = ""; // clear
    if(icdasEnabled){ ind.textContent = String(code); }      // badge number
    else { ind.innerHTML = "<i></i><i></i><i></i>"; }        // 3 bars
    // `data-radio` reflects the surface's `radiographicDepth` value
    // (when set and not "none"), but ONLY when the radiographic-depth mode is on
    // (`!== "off"`). With the mode off (default) the badge is never emitted.
    const radio = state.radiographicDepth?.get(surface);
    if(radiographicDepthMode !== "off" && radio && radio !== "none"){ ind.setAttribute("data-radio", radio); }
    else { ind.removeAttribute("data-radio"); }
  }
}

/**
 * TEST-ONLY: apply `syncSurfaceDepthIndicator`'s per-surface indicator-attribute
 * logic (ICDAS `data-depth`/`data-icdas` badge + `data-radio`) to a
 * single hand-built `.surface-cell` element, without requiring a live grid /
 * `initOdontogram()` (which needs real SVG-asset fetches). Not part of the
 * public API.
 */
export function __syncSurfaceDepthIndicatorForTest(cell: Element, state: Record<string, unknown>): void {
  syncSurfaceDepthIndicator(cell, state as Any);
}

/**
 * Sync the recurrent-caries indicator on ONE filling-surface `.surface-cell`.
 * The `.surf-depth` span is shown by CSS
 * whenever the filling checkbox is checked (a filling exists on the surface),
 * so the picker is always reachable to author recurrent caries. When the
 * surface ALSO carries caries (`caries ∩ fillingSurfaceMaterials` → recurrent /
 * `subcaries-${surface}`) it gets the `.has-subcaries` dark border and shows the
 * CARS severity badge/bars; otherwise it renders a neutral (empty) affordance.
 * Extracted for DOM-free unit testing.
 */
export function syncFillingSubcariesIndicator(cell: Element, state: Any): void {
  const c = cell.querySelector("input[type=checkbox]") as HTMLInputElement | null;
  const ind = cell.querySelector(".surf-depth") as HTMLElement | null;
  if(!c || !ind) return;
  const surface = String(c.value);
  const hasSubcaries = !!state.fillingSurfaceMaterials?.has(surface) && !!state.caries?.has(`caries-${surface}`);
  ind.classList.toggle("has-subcaries", hasSubcaries);
  if(hasSubcaries){
    const code = state.cariesSeverity.get(surface) || 2;
    ind.setAttribute("data-depth", icdasToThreeLevel(code));
    ind.setAttribute("data-icdas", String(code));
    ind.classList.toggle("icdas", icdasEnabled);
    ind.textContent = "";
    if(icdasEnabled){ ind.textContent = String(code); }
    else { ind.innerHTML = "<i></i><i></i><i></i>"; }
  }else{
    // Neutral affordance: no CARS badge, just the faint 3-bar hint to click.
    ind.removeAttribute("data-depth");
    ind.removeAttribute("data-icdas");
    ind.classList.remove("icdas");
    ind.innerHTML = "<i></i><i></i><i></i>";
  }
}

/**
 * TEST-ONLY sibling of {@link __syncSurfaceDepthIndicatorForTest} for the
 * filling-surface recurrent-caries indicator. Not part of the public API.
 */
export function __syncFillingSubcariesIndicatorForTest(cell: Element, state: Record<string, unknown>): void {
  syncFillingSubcariesIndicator(cell, state as Any);
}

/**
 * Sync the LEFT-side structural filling-defect indicator on ONE
 * filling-surface `.surface-cell` (`.surf-defect`, mirroring the RIGHT-side
 * `.surf-depth` / {@link syncFillingSubcariesIndicator}). A surface carries a
 * defect only when it BOTH has a filling (`fillingSurfaceMaterials`) AND a
 * non-"none" `fillingDefect` value — a defect value on an un-filled surface
 * (stale/orphaned state) is defensively ignored. Extracted for DOM-free unit
 * testing.
 */
export function syncFillingDefectIndicator(cell: Element, state: Any): void {
  const c = cell.querySelector("input[type=checkbox]") as HTMLInputElement | null;
  const ind = cell.querySelector(".surf-defect") as HTMLElement | null;
  if(!c || !ind) return;
  const surface = String(c.value);
  const val = state.fillingDefect?.get(surface);
  const hasDefect = !!state.fillingSurfaceMaterials?.has(surface) && !!val && val !== "none";
  ind.classList.toggle("has-defect", hasDefect);
  if(hasDefect) ind.setAttribute("data-defect", String(val));
  else ind.removeAttribute("data-defect");
}

/**
 * TEST-ONLY sibling of {@link __syncFillingSubcariesIndicatorForTest} for the
 * filling-defect indicator. Not part of the public API.
 */
export function __syncFillingDefectIndicatorForTest(cell: Element, state: Record<string, unknown>): void {
  syncFillingDefectIndicator(cell, state as Any);
}
