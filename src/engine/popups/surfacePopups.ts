import { activeTooth } from "@/engine/selection";
import { toothState } from "@/state/chart";
import { cariesDepthEnabled } from "@/engine/sessionSettings";
import { surfaceLabelKey } from "@/engine/surfaceHelpers";
import {
  secondaryCariesOptions,
  getCariesDepthOptions,
  radiographicDepthOptions,
  applyRecurrentCariesScore,
  applyRadiographicDepth,
  applyFillingDefect,
} from "@/engine/cariesMutations";
import { el } from "@/engine/domHelpers";
import { t } from "@/i18n/useI18n";
import type { Any } from "@/engine/types";

export type ApplyToSelectedFn = (fn: (state: Any, toothNo?: number) => void) => void;

export function hideCariesDepthPopup(): void {
  const p = document.querySelector(".odon-depth-popup");
  if(p) p.remove();
}

export function showCariesDepthPopup(
  surface: string,
  anchor: HTMLElement,
  toothNo?: number | null,
  applyFn?: ApplyToSelectedFn,
): void {
  hideCariesDepthPopup();
  const rect = anchor.getBoundingClientRect();
  const popup = el("div", { class: "odon-depth-popup" });
  const active = activeTooth != null ? toothState.get(activeTooth) : null;
  // The popup is CONTEXTUAL. A surface that carries a
  // filling is a (potential) recurrent-caries surface → show the CARS group and
  // the "Recurrent caries – {surface}" title; a filling-free surface is primary
  // caries → show the depth group and the "Caries – {surface}" title. Never both.
  const hasFilling = !!active?.fillingSurfaceMaterials?.has(surface);
  const titleKey = hasFilling ? "caries.recurrentTitle" : "caries.primaryTitle";
  popup.appendChild(el("div", { class: "odon-depth-title", text: `${t(titleKey)} – ${t(surfaceLabelKey(surface, toothNo))}` }));
  const addGroup = (
    labelKey: string,
    options: Array<{ value: Any; label: string; title?: string }>,
    current: Any,
    onPick: (value: Any) => void,
  ) => {
    if(!options || options.length === 0) return;
    popup.appendChild(el("div", { class: "odon-depth-group-label", text: t(labelKey) }));
    for(const opt of options){
      const btn = el("button", { class: "odon-depth-option", text: opt.label }) as HTMLButtonElement;
      btn.title = opt.title || "";
      if(current != null && String(opt.value) === String(current)) btn.classList.add("is-active");
      btn.addEventListener("click", (e: Any)=>{
        e.stopPropagation();
        onPick(opt.value);
        hideCariesDepthPopup();
      });
      popup.appendChild(btn);
    }
  };

  // Show exactly ONE severity group by context. Both groups
  // write the single unified `cariesSeverity` (read as ICDAS on a primary
  // surface, CARS on a recurrent one); the context — filling present or not —
  // decides which labels the user sees and which transition a pick performs.
  if(hasFilling){
    // Recurrent (secondary) caries: CARS 0..6 only. Score 0 removes the caries
    // from the surface (revert to a plain filling); score > 0 adds it (→ becomes
    // recurrent, `subcaries-{surface}`). A filling-only surface reaches this via
    // its own dark-border indicator, so recurrent caries can be authored here.
    addGroup("caries.secondaryLabel", secondaryCariesOptions(), active?.cariesSeverity?.get(surface) ?? 0, (value)=>{
      if(applyFn){
        applyFn((s)=>{ applyRecurrentCariesScore(s, surface, Number(value)); });
      }
    });
  }else if(cariesDepthEnabled){
    // Primary caries: visual depth (ICDAS / 3-level) only — gated by
    // `cariesDepthEnabled`. Writes the ICDAS value onto the caried surface.
    addGroup("caries.depthLabel", getCariesDepthOptions(), active?.cariesSeverity?.get(surface), (value)=>{
      if(applyFn){
        applyFn((s)=>{
          if(s.caries.has(`caries-${surface}`)) s.cariesSeverity.set(surface, Number(value));
        });
      }
    });
  }
  // Radiographic depth — only when the mode is on (else options is []).
  addGroup("caries.radiographicLabel", radiographicDepthOptions(), active?.radiographicDepth?.get(surface) ?? "none", (value)=>{
    if(applyFn){
      applyFn((s)=>{ applyRadiographicDepth(s.radiographicDepth, surface, String(value)); });
    }
  });

  document.body.appendChild(popup);
  // Position below-right of the indicator, clamped to the viewport.
  const pw = popup.offsetWidth || 140;
  const left = Math.min(rect.left, window.innerWidth - pw - 8);
  const top = Math.min(rect.bottom + 4, window.innerHeight - popup.offsetHeight - 8);
  popup.style.left = `${Math.max(8, left)}px`;
  popup.style.top = `${Math.max(8, top)}px`;
  // Close on outside click / Escape.
  const onDoc = (e: Any)=>{ if(!popup.contains(e.target)){ cleanup(); } };
  const onKey = (e: Any)=>{ if(e.key === "Escape") cleanup(); };
  function cleanup(){
    hideCariesDepthPopup();
    document.removeEventListener("mousedown", onDoc, true);
    document.removeEventListener("keydown", onKey, true);
  }
  setTimeout(()=>{
    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("keydown", onKey, true);
  }, 0);
}

/** Small dedicated anchored popup to author the structural
 *  filling-defect (`none` | `marginal` | `fracture` | `wear`) on ONE filled
 *  surface, opened from the LEFT-side `.surf-defect` indicator. Reuses
 *  {@link hideCariesDepthPopup}'s shared close/teardown, and the SAME
 *  positioning + outside-click/Escape close registration as
 *  {@link showCariesDepthPopup} — only the option set differs. */
export function showFillingDefectPopup(
  surface: string,
  anchor: HTMLElement,
  toothNo?: number | null,
  applyFn?: ApplyToSelectedFn,
): void {
  hideCariesDepthPopup(); // reuse the shared close/teardown
  const active = activeTooth != null ? toothState.get(activeTooth) : null;
  if(!active?.fillingSurfaceMaterials?.has(surface)) return;
  const rect = anchor.getBoundingClientRect();
  const popup = el("div", { class: "odon-depth-popup" });
  popup.appendChild(el("div", { class: "odon-depth-title", text: `${t("fillingDefect.label")} – ${t(surfaceLabelKey(surface, toothNo))}` }));
  const current = active?.fillingDefect?.get(surface) ?? "none";
  const group = el("div", { class: "odon-depth-group" });
  for(const value of ["none", "marginal", "fracture", "wear"]){
    const btn = el("button", { class: "odon-depth-option" + (value === current ? " is-active" : ""), text: t("fillingDefect." + value) }) as HTMLButtonElement;
    btn.addEventListener("click", (e: Any)=>{
      e.stopPropagation();
      if(applyFn){
        applyFn((s)=>{ applyFillingDefect(s.fillingDefect, surface, value); });
      }
      hideCariesDepthPopup();
    });
    group.appendChild(btn);
  }
  popup.appendChild(group);
  document.body.appendChild(popup);
  // Position below-right of the indicator, clamped to the viewport — same as showCariesDepthPopup.
  const pw = popup.offsetWidth || 140;
  const left = Math.min(rect.left, window.innerWidth - pw - 8);
  const top = Math.min(rect.bottom + 4, window.innerHeight - popup.offsetHeight - 8);
  popup.style.left = `${Math.max(8, left)}px`;
  popup.style.top = `${Math.max(8, top)}px`;
  // Close on outside click / Escape — same registration as showCariesDepthPopup.
  const onDoc = (e: Any)=>{ if(!popup.contains(e.target)){ cleanup(); } };
  const onKey = (e: Any)=>{ if(e.key === "Escape") cleanup(); };
  function cleanup(){
    hideCariesDepthPopup();
    document.removeEventListener("mousedown", onDoc, true);
    document.removeEventListener("keydown", onKey, true);
  }
  setTimeout(()=>{
    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("keydown", onKey, true);
  }, 0);
}
