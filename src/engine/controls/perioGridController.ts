/**
 * Periodontal 6-Site Grid Controller
 *
 * Owns the imperative 6-site probing grid DOM construction, live input synchronization,
 * and derived CAL/BOP read-out presentation for the active tooth.
 *
 * Extracted from `src/odontogram.ts` (Stage 17).
 */

import { t } from "@/i18n/useI18n";
import type { Any } from "@/engine/types";
import { $, el } from "@/engine/domHelpers";
import { setDisabled } from "@/engine/controls/controlPresentation";
import { activeTooth } from "@/engine/selection";
import { toothState } from "@/state/chart";
import {
  PERIO_SITES,
  perioRowHidden,
} from "@/state/payload";
import {
  getToothPerio,
  getToothCal,
  setPerioSite,
} from "@/state/perio";

/**
 * Sync the #perioRow six-site PD/GM/BOP/SUP grid (built once by
 * `buildPerioGrid`) + the live derived read-out (per-site CAL, tooth
 * %BOP) for `toothNo`. Values are read via the SAME public
 * getToothPerio()/getToothCal() API the write path (buildPerioGrid's change
 * listeners) and the FHIR/export paths use — this never re-derives CAL or
 * %BOP itself, it only formats what those functions already return. The row
 * is hidden via `perioRowHidden` (missing/implant/under-gum/
 * extraction-socket teeth have no probing site to chart); when hidden (or
 * `toothNo` is unset — e.g. no active tooth yet) the per-input sync is
 * skipped, mirroring syncToothDetailControls' small-standalone-sync shape.
 * Null-safe throughout (no-op when the grid/row/readout elements aren't
 * mounted — e.g. a DOM-free test harness), exactly like every other small
 * sync helper called from syncControlsFromState.
 */
export function syncPerioRow(state: Any, toothNo: Any = activeTooth): void {
  const row = $("#perioRow");
  const hidden = perioRowHidden(state);
  if(row) row.classList.toggle("hidden", hidden);
  if(hidden || toothNo == null) return;
  const perio = getToothPerio(toothNo);
  const cal = getToothCal(toothNo);
  for(const site of PERIO_SITES){
    const pdInput = $(`#perio-pd-${site}`) as HTMLInputElement | null;
    if(!pdInput) continue; // grid not built (e.g. DOM-free test harness)
    const gmInput = $(`#perio-gm-${site}`) as HTMLInputElement;
    const bopInput = $(`#perio-bop-${site}`) as HTMLInputElement;
    const supInput = $(`#perio-sup-${site}`) as HTMLInputElement;
    const charted = Object.prototype.hasOwnProperty.call(perio.pd, site);
    pdInput.value = charted ? String(perio.pd[site]) : "";
    gmInput.value = (charted && Object.prototype.hasOwnProperty.call(perio.gm, site)) ? String(perio.gm[site]) : "";
    bopInput.checked = perio.bop.includes(site);
    supInput.checked = perio.sup.includes(site);
    // GM/BOP/SUP only ever apply to an already-charted site (see
    // setPerioSite's own contract) — disable them until PD is set, so an
    // edit there can never be a silent no-op the user doesn't understand.
    setDisabled(gmInput, !charted);
    setDisabled(bopInput, !charted);
    setDisabled(supInput, !charted);
  }
  const readoutEl = $("#perioReadout");
  if(readoutEl){
    const chartedSites = (PERIO_SITES as readonly string[]).filter((s) => Object.prototype.hasOwnProperty.call(perio.pd, s));
    if(chartedSites.length === 0){
      readoutEl.textContent = t("perio.readout.empty");
    }else{
      const calStr = chartedSites.map((s) => `${s} ${t("perio.cal")} ${cal.get(s)}`).join("   ");
      const bopCount = perio.bop.length;
      const pct = Math.round((bopCount / chartedSites.length) * 1000) / 10;
      readoutEl.textContent = `${calStr}   ${t("perio.bopPercent")} ${pct}% (${bopCount}/${chartedSites.length})`;
    }
  }
}

/**
 * Build the static 6-site PD/GM/BOP/SUP grid ONCE — site
 * identities never change across teeth, mirroring buildSurfaceCross/
 * buildChecks building their option lists once in wireControls(); per-tooth
 * VALUES are synced separately by `syncPerioRow` (called from
 * syncControlsFromState on tooth select), exactly like the caries/filling
 * surface checkboxes' `.checked` is synced from state while the surface list
 * itself is built once. Two site-group rows in PERIO_SITES' own canonical
 * order (buccal MB/B/DB, then lingual/palatal ML/L/DL). Every control calls
 * setPerioSite(activeTooth, site, patch) DIRECTLY — NOT applyToSelected():
 * perio is inherently single-tooth, per-site data, not a bulk-across-
 * selection axis like mobility/caries — then re-syncs the row immediately,
 * since setPerioSite deliberately never touches DOM/SVG itself (see its own
 * doc comment).
 */
export function buildPerioGrid(container: Any): void {
  if(!container || container.childElementCount > 0) return;
  container.innerHTML = "";
  const buildSiteRow = (sites: readonly string[], rowClass: string) => {
    const rowEl = el("div", { class: `perio-site-row ${rowClass}` });
    for(const site of sites){
      const cell = el("div", { class: "perio-site-cell", "data-site": site }, [
        el("div", { class: "perio-site-label", title: t(`perio.site.${site}`), text: site }),
      ]);

      const pdInput = el("input", { type: "number", id: `perio-pd-${site}`, "data-site": site, "data-field": "pd", min: "1", max: "15", step: "1" });
      cell.appendChild(el("label", { class: "perio-field" }, [ el("span", { text: t("perio.pd") }), pdInput ]));

      const gmInput = el("input", { type: "number", id: `perio-gm-${site}`, "data-site": site, "data-field": "gm", min: "-10", max: "20", step: "1" });
      cell.appendChild(el("label", { class: "perio-field" }, [ el("span", { text: t("perio.gm") }), gmInput ]));

      const bopInput = el("input", { type: "checkbox", id: `perio-bop-${site}`, "data-site": site, "data-field": "bop" });
      cell.appendChild(el("label", { class: "perio-check" }, [ bopInput, el("span", { text: t("perio.bop") }) ]));

      const supInput = el("input", { type: "checkbox", id: `perio-sup-${site}`, "data-site": site, "data-field": "sup" });
      cell.appendChild(el("label", { class: "perio-check" }, [ supInput, el("span", { text: t("perio.sup") }) ]));

      const resync = () => {
        if(activeTooth == null) return;
        syncPerioRow(toothState.get(activeTooth), activeTooth);
      };
      pdInput.addEventListener("change", ()=>{
        if(activeTooth == null) return;
        const raw = pdInput.value.trim();
        setPerioSite(activeTooth, site, { pd: raw === "" ? null : Number(raw) });
        resync();
      });
      gmInput.addEventListener("change", ()=>{
        if(activeTooth == null) return;
        const raw = gmInput.value.trim();
        if(raw === "") return; // no explicit gm edit -> no-op (gm has no "unset" signal)
        setPerioSite(activeTooth, site, { gm: Number(raw) });
        resync();
      });
      bopInput.addEventListener("change", ()=>{
        if(activeTooth == null) return;
        setPerioSite(activeTooth, site, { bop: bopInput.checked });
        resync();
      });
      supInput.addEventListener("change", ()=>{
        if(activeTooth == null) return;
        setPerioSite(activeTooth, site, { sup: supInput.checked });
        resync();
      });

      rowEl.appendChild(cell);
    }
    container.appendChild(rowEl);
  };
  buildSiteRow(PERIO_SITES.slice(0, 3), "perio-buccal-row");
  buildSiteRow(PERIO_SITES.slice(3, 6), "perio-lingual-row");
}

/** TEST-ONLY: apply `syncPerioRow` to a hand-built #perioRow DOM
 *  fragment for a given `toothNo`, without requiring a live initOdontogram()
 *  or a real `activeTooth`. Mirrors __syncToothDetailControlsForTest /
 *  __syncInflammationModVisibilityForTest. */
export function __syncPerioRowForTest(state: Record<string, unknown>, toothNo: number): void {
  syncPerioRow(state, toothNo);
}

/** TEST-ONLY: apply `buildPerioGrid` to a hand-built container, without
 *  requiring a live initOdontogram(). */
export function __buildPerioGridForTest(container: Element): void {
  buildPerioGrid(container);
}
