/**
 * Core SVG tooth presentation renderer (Design B).
 *
 * Owns the imperative SVG DOM painting pipeline for individual teeth:
 * - `applyStateToSvgSingle`: applies active clinical state to a tooth's SVG DOM node.
 * - `applyProposedStyling`, `clearProposedStyling`, `markProposed`: dashed+tint treatment for Plan additions.
 * - `collectActiveLayers`: document-order active layer fingerprint extraction.
 * - `setPulpInflamPaths`: diseased pulp flame sublayer toggling.
 * - `inflammationHome`: element-keyed WeakMap for periapical inflammation z-order reparenting and restoration.
 *
 * Pure structural extraction from `odontogram.ts` — zero clinical, styling, or timing changes.
 */

import { charts, toothState, chartMode, planInitialized } from "@/state/chart";
import { defaultState, isToothPresent, isUnderGum, isExtraction } from "@/state/payload";
import { DISCOLORATION_TINT, discolorationAllowed, orthoAllowed } from "@/state/pulpApical";
import { allClearLayers } from "@/registry/svgLayers";
import { applyFlagLayers, buildFlagCtx } from "@/registry/svgActivate";
import { composeRestorationLayers } from "@/registry/restorations";
import { getBrokenCrownVariant } from "@/engine/clinicalOptions";
import { FISSURE_ALLOWED, BROKEN_VARIANTS, RESTORATION_WRAPPER_GROUP } from "@/engine/constants";
import { showBase, showHealthyPulp } from "@/engine/displayGlobals";
import { svgGetById, setActive } from "@/engine/domHelpers";
import { icdasTier } from "@/engine/cariesMutations";
import { cariesDepthEnabled } from "@/engine/sessionSettings";
import type { Any } from "@/engine/types";

export type StateWarningCallback = (state: Any) => void;

export interface ToothPainterOptions {
  onStateWarning?: StateWarningCallback;
}

// Original DOM position of each SVG's "inflammation" group, so it can be
// restored after being temporarily lifted above the tooth (see z-order fix
// in applyStateToSvgSingle). Keyed by the group node itself.
export const inflammationHome: WeakMap<Element, { parent: Node; next: Node | null }> = new WeakMap();

// Proposed-layer styling constants. In Plan mode, a layer that is active in the PLAN
// chart but NOT in the STATUS chart (a "plan add" — e.g. a crown
// proposed on a tooth that is sound in status) gets a distinct dashed+tinted
// look, so a plan reads as PROPOSED treatment rather than as-if-already-done
// findings.
export const PROPOSED_DASH = "4 2";
export const PROPOSED_TINT = "#5b7a9d";

// Symmetrically set the 8 flame sublayers (and their "-N1" variants) of the
// tooth-inflam-pulp / milktooth-inflam-pulp group to
// `active`. The mild (reversible) tier turns them OFF, every other diseased
// tier turns them ON. Must be called unconditionally on every diseased-pulp
// render — the live app reuses one persistent SVG DOM node per tooth, so a
// one-directional (deactivate-only) helper left the flames stuck off after a
// mild render even when a later render is full-severity. Missing ids no-op
// (setActive tolerates null), so teeth without the full set are unaffected.
export function setPulpInflamPaths(svg: Any, active: boolean): void {
  for(let n = 1; n <= 8; n++){
    setActive(svgGetById(svg, "pulp-inflam-path-" + n), active);
    setActive(svgGetById(svg, "pulp-inflam-path-" + n + "1"), active);
  }
}

/**
 * Apply clinical state to a single tooth SVG root.
 *
 * @param toothNo - FDI tooth number
 * @param svg - SVG root element to paint
 * @param state - Clinical state (defaults to live active-chart toothState)
 * @param optionsOrWarningCb - Optional warning callback or options object with onStateWarning
 */
export function applyStateToSvgSingle(
  toothNo: Any,
  svg: Any,
  stateOrOpts?: Any,
  optionsOrWarningCb?: ToothPainterOptions | StateWarningCallback
): void {
  let state: Any;
  let opts: ToothPainterOptions | StateWarningCallback | undefined;

  if (typeof stateOrOpts === "function" || (stateOrOpts && typeof stateOrOpts === "object" && "onStateWarning" in stateOrOpts)) {
    state = toothState.get(toothNo);
    opts = stateOrOpts;
  } else {
    state = stateOrOpts !== undefined ? stateOrOpts : toothState.get(toothNo);
    opts = optionsOrWarningCb;
  }

  if(!state || !svg) return;

  // 0) Start from a clean baseline: turn OFF all switchables, then apply ON flags.
  // (Base stays as in SVG; we don't toggle #base)
  const switchable = ["mods","tooth-variants","endos","surfaces","restorations","tooth"];
  for(const gId of switchable){
    const g = svgGetById(svg, gId);
    if(!g) continue;
    // Keep group itself active; we toggle children by id
    // But for simplicity, if group has data-active, keep at 1 so children can show.
    if(g.hasAttribute("data-active")) g.setAttribute("data-active","1");
  }

  // Turn OFF all known switchable layers (derived from the registry + fixed non-axis set).
  for (const id of allClearLayers()) setActive(svgGetById(svg, id), false);

  const hasCrown = state.restorationType !== "none";
  const brokenVariant = state.toothSubstrate === "broken" ? getBrokenCrownVariant(state) : null;
  const isImplant = state.toothSelection === "implant";
  const isMilktooth = state.toothSelection === "milktooth";
  const underGum = isUnderGum(state.toothSelection);
  const extraction = isExtraction(state.toothSelection) || (state.toothSelection === "none" && state.extractionWound);
  const hasRemovable = state.toothSelection === "none"
    && (state.prosthesis === "removable-partial" || state.prosthesis === "removable-full");
  const isNone = state.toothSelection === "none";
  const hasRestoration = hasCrown || hasRemovable;
  // Occlusal-view SVGs are the only templates carrying `*-onlay` layers; the
  // presence of one tells composeRestorationLayers to include occlusal-only types.
  const restorationView: "front" | "occlusal" = svg.querySelector('[id$="-onlay"]') ? "occlusal" : "front";

  const flagDeps = {
    setActive, svgGetById, isToothPresent, isUnderGum, isExtraction,
    fissureAllowedTeeth: FISSURE_ALLOWED, brokenVariants: BROKEN_VARIANTS,
  };
  applyFlagLayers(svg, state, buildFlagCtx(state, toothNo, flagDeps), flagDeps);

  // resorptionType (enum). applyFlagLayers only auto-activates boolean-kind
  // axes' svgLayer, so this enum axis needs explicit activation here. Both
  // "internal" and "external-cervical" render the SAME endo-resorption layer
  // (visually identical; only the data model distinguishes them).
  if(state.resorptionType !== "none" && isToothPresent(state.toothSelection)){
    setActive(svgGetById(svg, "endo-resorption"), true);
  }

  // Tooth wear (per location; reuses the two existing wear layers).
  const wearAllowed = state.toothSelection === "tooth-base" && state.restorationType === "none" && state.toothSubstrate === "natural";
  if(wearAllowed){
    if(state.wearEdge !== "none") setActive(svgGetById(svg, "tooth-bruxism-wear"), true);
    if(state.wearCervical !== "none") setActive(svgGetById(svg, "tooth-bruxism-neck-wear"), true);
  }

  // rootCaries (enum) wires the `caries-root` artwork layer, present only in the
  // 4 main-view templates (11/13/14/16), never in the 2 occlusal templates. Same
  // enum-explicit-activation pattern as resorptionType above: applyFlagLayers
  // only auto-activates boolean-kind axes, so this enum axis (appliesWhen:
  // toothPresent) needs an explicit setActive here. Additionally gated on
  // restorationView === "front" (the same occlusal-vs-main-view detection
  // composeRestorationLayers uses) since the occlusal templates carry no
  // caries-root artwork at all.
  if(state.rootCaries !== "none" && isToothPresent(state.toothSelection) && restorationView === "front"){
    const rootEl = svgGetById(svg, "caries-root") as SVGElement | null;
    setActive(rootEl, true);
    // Severity-based opacity, same style.opacity mechanism as the
    // caries-surface / subcaries opacity above. `active-cavitated` is the most
    // severe (fully opaque); `active` is the least severe (most translucent).
    // Simple-mode "present" is stored canonically as `active-cavitated` (see
    // rootCariesOptions), so it renders at full opacity like severity mode's
    // most-severe option.
    if(rootEl){
      rootEl.style.opacity = state.rootCaries === "active" ? "0.5"
        : state.rootCaries === "arrested" ? "0.7"
        : "1";
    }
  }

  // Peri-implant disease (implants only). mucositis = soft-tissue inflammation
  // (reuse the existing `parodontal` gum glyph); peri-implantitis adds crestal bone
  // loss at severity-scaled opacity. Set both the active flag and opacity every
  // render (the live app reuses one SVG DOM node per tooth).
  if(isImplant && state.periImplant !== "none"){
    setActive(svgGetById(svg, "parodontal"), true);
    const boneEl = svgGetById(svg, "peri-implant-bone-loss") as SVGElement | null;
    const boneOpacity = state.periImplant === "peri-implantitis-mild" ? "0.4"
      : state.periImplant === "peri-implantitis-moderate" ? "0.7"
      : state.periImplant === "peri-implantitis-severe" ? "1"
      : ""; // mucositis → no bone loss
    setActive(boneEl, boneOpacity !== "");
    if(boneEl && boneOpacity !== "") boneEl.style.opacity = boneOpacity;
  }

  // Any non-"normal" pulpDx value is clinically "diseased pulp" for rendering
  // purposes. The bespoke milktooth/permanent split + showHealthyPulp gating
  // below distinguishes the glyph variants.
  const pulpDiseased = state.pulpDx !== "normal";

  // Reversible pulpitis (and its Latin equivalent, hyperaemia pulpae) is a mild,
  // reversible state — render a reduced glyph (the base inflamed-pulp shape
  // without the flame sublayers). Every other diseased state renders the full
  // glyph. Checking both fields keeps this correct in aae and latin modes
  // regardless of the Latin->AAE parent mapping.
  const pulpTierMild = state.pulpDx === "reversible-pulpitis" || state.pulpLatin === "hyperaemia-pulpae";
  // A root-treated tooth has no vital pulp — its endo artwork represents the
  // canal, so suppress both pulp glyphs.
  const endoTreated = state.endo !== "none";

  // base visibility toggle
  setActive(svgGetById(svg, "base"), showBase);

  // 1) Tooth selection
  setActive(svgGetById(svg, "implant"), isImplant);
  setActive(svgGetById(svg, "milktooth"), isMilktooth);

  if(isImplant){
    setActive(svgGetById(svg, "implant-base"), true);
  }else if(isMilktooth){
    setActive(svgGetById(svg, "milktooth-base"), true);
    setActive(svgGetById(svg, "milktooth-beauty"), true);
    if(pulpDiseased){
      if(!endoTreated){
        setActive(svgGetById(svg, "milktooth-inflam-pulp"), true);
        setPulpInflamPaths(svg, !pulpTierMild);
      }
    }else if(showHealthyPulp){
      setActive(svgGetById(svg, "milktooth-healthy-pulp"), true);
    }
  }else if(isToothPresent(state.toothSelection)){
    if(state.toothSelection === "tooth-base"){
      setActive(svgGetById(svg, "tooth-base"), true);
      // Gloss only on an intact natural crown — not on broken/radix/prepared
      // substrates or a prosthetic restoration.
      setActive(svgGetById(svg, "tooth-base-beauty"), state.toothSubstrate === "natural" && state.restorationType === "none");
    }else{
      setActive(svgGetById(svg, state.toothSelection), true);
    }
    if(!underGum && !extraction){
      // Pulpa: a diseased-pulp glyph is suppressed on an endodontically treated
      // tooth (the endo artwork represents the filled canal). The healthy-pulp
      // glyph is unchanged (legacy behaviour — a treated tooth may still show it
      // under the endo layer).
      if(pulpDiseased){
        if(!endoTreated){
          setActive(svgGetById(svg, "tooth-inflam-pulp"), true);
          setPulpInflamPaths(svg, !pulpTierMild);
        }
      }else if(showHealthyPulp){
        setActive(svgGetById(svg, "tooth-healthy-pulp"), true);
      }
    }
  }
  if(brokenVariant && state.toothSelection === "tooth-base"){
    setActive(svgGetById(svg, "tooth-base"), false);
    setActive(svgGetById(svg, brokenVariant), true);
  }
  if(state.toothSubstrate === "radix" && state.toothSelection === "tooth-base"){
    setActive(svgGetById(svg, "tooth-base"), false);
    setActive(svgGetById(svg, "tooth-radix"), true);
  }
  // "Prepared for crown" is a substrate state on a permanent tooth: hide the
  // natural crown and show the crown-prep layer. Its properties mirror "broken".
  if(state.toothSubstrate === "crownprep" && state.toothSelection === "tooth-base"){
    setActive(svgGetById(svg, "tooth-base"), false);
    setActive(svgGetById(svg, "tooth-crownprep"), true);
  }
  if(state.toothSelection === "none" && state.extractionWound){
    setActive(svgGetById(svg, "no-tooth-after-extraction"), true);
  }

  // Discoloration — tint the shown natural crown's fill. Symmetric: reset
  // BOTH crown paths every render so a reused per-tooth node never keeps a stale
  // tint (permanent<->milk switch, or cleared). Fill isn't fingerprinted (parity-safe).
  //
  // IMPORTANT: each crown path carries its base color ONLY as an inline `style`
  // attribute baked into the SVG asset (e.g. tooth-base: "fill: #ebebeb; ...";
  // milktooth-base: "fill: #fff; ..."); no CSS rule supplies it. Setting
  // `el.style.fill = ""` DELETES the inline `fill` longhand (CSSOM), it does NOT
  // revert to the asset's original color — the crown falls back to the SVG
  // initial value (black). Since this block runs on every render and
  // `discoloration` defaults to "none", clearing to "" would blacken every
  // tooth's crown on first render. Instead, capture each element's own
  // asset-original fill ONCE (this block is the sole writer of these elements'
  // `.style.fill` — verified via grep) and restore THAT on every non-tinted
  // render. The capture is stashed in a `data-base-fill` attribute so it
  // survives the reused-node lifecycle; that attribute is not part of the
  // parity fingerprint (collectActiveLayers only reads id/opacity/class).
  {
    const tintOn = discolorationAllowed(state) && state.discoloration !== "none";
    const tint = tintOn ? (DISCOLORATION_TINT[state.discoloration] || "") : "";
    const activeId = state.toothSelection === "milktooth" ? "milktooth-base" : "tooth-base";
    for(const id of ["tooth-base", "milktooth-base"]){
      const el = svgGetById(svg, id) as SVGElement | null;
      if(!el) continue;
      if(el.getAttribute("data-base-fill") === null){
        el.setAttribute("data-base-fill", el.style.fill || "");
      }
      const base = el.getAttribute("data-base-fill") || "";
      el.style.fill = (tintOn && id === activeId) ? tint : base;
    }
  }

  // Orthodontic glyphs. Explicit + symmetric; null-guarded (occlusal templates
  // lack ring/bracket/up/down — 4 of the 7 ids — so every lookup must be
  // guarded). Gate: present natural tooth (orthoAllowed).
  //
  // extrusion/intrusion <-> arrow-up/arrow-down binding (verified from 11.svg geometry,
  // viewBox "0 0 39.2 62.7"): the crown/incisal edge sits at LARGER y (e.g. crown-needed
  // spans y~34.5-61, near the bottom of the 62.7-tall canvas) and the root/apex at
  // SMALLER y. Group "arrow-up" has its 2-line chevron vertex (tip) at y~60.2-60.3 with
  // the shaft's tail at y~53.6 — tip toward LARGER y (incisal edge) => this glyph visually
  // points toward the crown => extrusion. Group "arrow-down" has its chevron vertex at
  // y~54.5-54.7 with the shaft's tail at y~61.2 — tip toward SMALLER y (apex) => this
  // glyph visually points toward the root => intrusion. (The layer *ids* arrow-up/
  // arrow-down don't literally match their visual direction; binding by drawn geometry,
  // not by id text, per Step 1's instruction.)
  {
    const ok = orthoAllowed(state);
    const set = (id: string, on: boolean) => { const el = svgGetById(svg, id); if(el) setActive(el, on); };
    set("ortho-bracket", ok && state.orthoAppliance === "bracket");
    set("ortho-ring",    ok && state.orthoAppliance === "band");
    set("arrow-mesial",  ok && state.orthoDrift === "mesial");
    set("arrow-distal",  ok && state.orthoDrift === "distal");
    set("arrow-up",      ok && state.orthoVertical === "extrusion");
    set("arrow-down",    ok && state.orthoVertical === "intrusion");
    set("arrow-rotation",ok && state.orthoRotation === true);
  }

  // 2) Mods — periapical glyph.
  // On a PRESENT tooth the `apicalDx` clinical axis (not `mods.inflammation`)
  // drives the periapical glyph. On a NON-present tooth (missing / implant)
  // `mods.inflammation` retains its SECOND, PERIODONTAL role and still drives the
  // glyph — the label switches to "periodontal inflammation" in
  // updateInflammationSection, but the glyph is unchanged. `periapicalType`
  // selects the lesion subtype glyph; when it is unset, apicalDx suggests
  // abscess-vs-granuloma. An implant shows no periapical glyph — its inflammation
  // is expressed via the periImplant axis. Missing / extraction-socket teeth keep
  // the mods.inflammation-driven periapical/residual glyph.
  const periapicalGlyphActive = isToothPresent(state.toothSelection)
    ? state.apicalDx !== "normal"
    : (state.toothSelection === "implant" ? false : state.mods.has("inflammation"));
  if(periapicalGlyphActive){
    // The `inflammation` container group is the glyph's parent; collectActiveLayers
    // hides any child whose ancestor is inactive. On the non-present path it is
    // already activated by applyFlagLayers via the `mods.inflammation` set entry;
    // on the present (apicalDx) path — where migration has stripped that mod —
    // we must activate the group here so the glyph is not hidden. Idempotent when
    // both fire, so the collected layers stay byte-identical to the old render.
    setActive(svgGetById(svg, "inflammation"), true);
    const glyph = state.periapicalType === "cyst" ? "cysta"
      : (state.periapicalType === "abscess"
          || state.apicalDx === "acute-apical-abscess"
          || state.apicalDx === "chronic-apical-abscess") ? "abscess"
      : "granuloma"; // default incl. "none" and "granuloma"
    setActive(svgGetById(svg, glyph), true);
  } else if(isImplant){
    // applyFlagLayers (the generic mods-set pass) unconditionally activates
    // the shared "inflammation" container for ANY tooth carrying a legacy/imported
    // `mods.inflammation` entry, independent of periapicalGlyphActive above. Since
    // an implant's periapical glyph is retired (finding now expressed via
    // periImplant), explicitly retire the container too, so a stray implant
    // mods.inflammation entry renders no glyph at all instead of an orphaned
    // empty-of-children-but-active "inflammation" group.
    setActive(svgGetById(svg, "inflammation"), false);
  }
  // mobilityRowHidden() also hides the mobility control on an implant
  // (osseointegrated, no PDL) — gate the render the same way. The stored value
  // is deliberately left untouched, just not drawn/summarized on an implant.
  if(state.mobility !== "none" && state.toothSelection !== "none" && !extraction && !isImplant){
    setActive(svgGetById(svg, "mobility"), true);
  }

  // 3) Endo exclusivity (only if tooth present)
  if(isToothPresent(state.toothSelection) && !underGum && !extraction){
    if(state.endo === "endo-medical-filling"){
      setActive(svgGetById(svg, "endo-medical-filling"), true);
    } else if(state.endo === "endo-filling"){
      setActive(svgGetById(svg, "endo-filling"), true);
    } else if(state.endo === "endo-glass-pin"){
      setActive(svgGetById(svg, "endo-filling"), true);
      setActive(svgGetById(svg, "endo-glass-pin"), true);
    } else if(state.endo === "endo-filling-incomplete"){
      setActive(svgGetById(svg, "endo-filling-incomplete"), true);
    } else if(state.endo === "endo-metal-pin"){
      setActive(svgGetById(svg, "endo-filling"), true);
      setActive(svgGetById(svg, "endo-metal-pin"), true);
    }
  }

  // 4) Removable prosthesis
  if(hasRemovable){
    setActive(svgGetById(svg, "prosthesis"), true);
    setActive(svgGetById(svg, "prosthesis-crown"), true);
    setActive(svgGetById(svg, "prosthesis-connector"), true);
  }

  // Implant attachments (healing-abutment / locator / bar) — rendered off the
  // dedicated `prosthesis` axis. Fixed implant crowns/bridges are first-class in
  // the restoration model: only the connector is implant-specific here — the
  // crown/bridge material layers themselves flow through the shared restoration
  // composition below (same as non-implant teeth).
  if(isImplant){
    if(state.prosthesis === "healing-abutment"){
      setActive(svgGetById(svg, "implant-healing-abutment"), true);
    } else if(state.restorationType === "crown" || state.restorationType === "bridge"){
      setActive(svgGetById(svg, "implant-connector"), true);
    } else if(state.prosthesis === "locator"){
      setActive(svgGetById(svg, "restorations"), true);
      setActive(svgGetById(svg, "implant"), true);
      setActive(svgGetById(svg, "implant-connector"), true);
      setActive(svgGetById(svg, "implant-locator-screw"), true);
    } else if(state.prosthesis === "locator-denture"){
      setActive(svgGetById(svg, "restorations"), true);
      setActive(svgGetById(svg, "implant"), true);
      setActive(svgGetById(svg, "implant-connector"), true);
      setActive(svgGetById(svg, "implant-locator-screw"), true);
      setActive(svgGetById(svg, "prosthesis-implant"), true);
      setActive(svgGetById(svg, "prosthesis-implant-crown"), true);
      setActive(svgGetById(svg, "prosthesis-implant-gum"), true);
    } else if(state.prosthesis === "bar"){
      setActive(svgGetById(svg, "restorations"), true);
      setActive(svgGetById(svg, "implant"), true);
      setActive(svgGetById(svg, "implant-connector"), true);
      setActive(svgGetById(svg, "implant-locator-screw"), true);
      setActive(svgGetById(svg, "implant-bar"), true);
    } else if(state.prosthesis === "bar-denture"){
      setActive(svgGetById(svg, "restorations"), true);
      setActive(svgGetById(svg, "implant"), true);
      setActive(svgGetById(svg, "implant-connector"), true);
      setActive(svgGetById(svg, "implant-locator-screw"), true);
      setActive(svgGetById(svg, "implant-bar"), true);
      setActive(svgGetById(svg, "prosthesis-implant"), true);
      setActive(svgGetById(svg, "prosthesis-implant-crown"), true);
      setActive(svgGetById(svg, "prosthesis-implant-gum"), true);
    }
  }
  if(isNone){
    setActive(svgGetById(svg, "restorations"), true);
    // Removable/bar prosthesis on a gap — rendered off the `prosthesis` axis.
    // Fixed bridge values flow through the composition below. This branch's layer
    // set intentionally differs from the isImplant "bar"/"bar-denture" branch
    // above (no connector/locator-screw on a gap tooth).
    if(state.prosthesis === "bar"){
      setActive(svgGetById(svg, "implant"), true);
      setActive(svgGetById(svg, "implant-bar"), true);
    } else if(state.prosthesis === "bar-denture"){
      setActive(svgGetById(svg, "implant"), true);
      setActive(svgGetById(svg, "implant-bar"), true);
      setActive(svgGetById(svg, "prosthesis-implant"), true);
      setActive(svgGetById(svg, "prosthesis-implant-crown"), true);
      setActive(svgGetById(svg, "prosthesis-implant-gum"), true);
    }
  }

  // Restoration composition (crown / inlay / onlay / veneer / bridge × material).
  // composeRestorationLayers is the single source of truth for which SVG layer
  // ids activate; the chosen material's wrapper <g> is turned on so its children
  // (cleared to off in the clear-set) become visible. `restorations` stays on.
  if(state.restorationType !== "none" && state.restorationMaterial !== "none"){
    const wrapper = RESTORATION_WRAPPER_GROUP[state.restorationMaterial];
    const ids = composeRestorationLayers(state.restorationType, state.restorationMaterial, restorationView);
    if(wrapper && ids.length){
      setActive(svgGetById(svg, "restorations"), true);
      setActive(svgGetById(svg, wrapper), true);
      for(const id of ids) setActive(svgGetById(svg, id), true);
    }
  }

  // 5) Surfaces
  if(!isImplant && !underGum && !extraction && state.toothSelection !== "none"){
    // Caries: if any restoration active => disable surface caries (except subcrown allowed)
    for(const id of state.caries){
      if(id === "caries-subcrown"){
        if(hasCrown){
          setActive(svgGetById(svg, "caries-subcrown"), true);
        }
        continue;
      }
      if(hasRestoration || hasCrown) continue;
      // Per-surface caries STATE MACHINE. A caried surface is either
      // PRIMARY caries (no filling) or RECURRENT/secondary caries (a filling on
      // the same surface). Recurrence is DERIVED from the filling — never a
      // separate stored flag — so a surface is NEVER both `caries-X` and
      // `subcaries-X`. The single `state.cariesSeverity` score (default 2) is
      // read as CARS when a filling is present and as ICDAS otherwise.
      const surface = id.replace("caries-", ""); // e.g. caries-mesial -> mesial
      const hasFilling = state.fillingSurfaceMaterials.has(surface);
      const sev = state.cariesSeverity.get(surface) ?? 2; // ICDAS-2 / CARS-2 representative
      if(hasFilling){
        // Recurrent path: the `subcaries-{surface}` layer, opacity encodes the
        // CARS score (score 1 -> 0.30 … score 6 -> 1.0). The primary
        // `caries-{surface}` layer is deliberately NOT activated here.
        const subEl = svgGetById(svg, `subcaries-${surface}`) as SVGElement | null;
        setActive(subEl, true);
        if(subEl && sev > 0){
          const carsOpacity = 0.30 + ((sev - 1) / 5) * 0.70;
          subEl.style.opacity = String(Math.round(carsOpacity * 100) / 100);
        }
      }else{
        const surfEl = svgGetById(svg, id) as SVGElement | null;
        setActive(surfEl, true);
        // Primary caries depth: opacity encodes the ICDAS depth; "deep" recolors
        // the contour. The whole depth-tier encoding is gated by the
        // `cariesDepthEnabled` setting — with it OFF, caried surfaces render at
        // the SVG default (no opacity/contour tier).
        if(surfEl && cariesDepthEnabled){
          const tier = icdasTier(sev);
          surfEl.style.opacity = tier === 3 ? "1" : tier === 2 ? "0.7" : "0.45";
          surfEl.classList.toggle("caries-deep", tier === 3);
        }
      }
    }

    // Fillings: each surface rendered with its own material
    if(state.fillingSurfaceMaterials.size > 0 && !hasCrown){
      for(const [s, mat] of state.fillingSurfaceMaterials){
        setActive(svgGetById(svg, `filling-${mat}-${s}`), true);
      }
    }

    // Per-surface filling defect — activate the defect-{surface} marker on a
    // filled surface with a recorded defect. Generic
    // marker (type lives in the data / summary), no opacity. Independent of
    // secondary caries (both may be active on the same surface).
    if(state.fillingDefect && state.fillingDefect.size > 0 && !hasCrown){
      for(const [s, val] of state.fillingDefect){
        if(val && val !== "none" && state.fillingSurfaceMaterials.has(s)){
          setActive(svgGetById(svg, `defect-${s}`), true);
        }
      }
    }

  }

  // Periapical inflammation lives in the `mods` group, which paints beneath the
  // `tooth` group — so an active endo-resection or endo-resorption layer (both
  // inside `tooth`) would cover the glyph. ONLY when inflammation coincides with
  // one of those two layers, lift the inflammation group to the end of the SVG
  // so the glyph stays on top; in every other case keep its original position.
  const inflammation = svgGetById(svg, "inflammation");
  if(inflammation){
    if(!inflammationHome.has(inflammation) && inflammation.parentElement){
      inflammationHome.set(inflammation, { parent: inflammation.parentElement, next: inflammation.nextSibling });
    }
    const resectionActive = state.endoResection && isToothPresent(state.toothSelection) && !underGum && !extraction;
    const resorptionActive = state.resorptionType !== "none" && isToothPresent(state.toothSelection);
    // The lift keys off the SAME `periapicalGlyphActive` predicate that gates the
    // glyph render above. Both resection/resorption are toothPresent-gated, so
    // this reduces to `apicalDx !== "normal"` on a present tooth.
    const lift = (resectionActive || resorptionActive) && periapicalGlyphActive;
    if(lift){
      // Move inflammation to the END of the `tooth` group's own parent, so it
      // paints in front of the whole tooth group (including the endo-resection /
      // endo-resorption layers, and the `endos` root-filling group that usually
      // accompanies a resection). Using tooth's parent — not the svg root —
      // keeps the glyph inside the lower-tooth mirroring <g transform> wrapper,
      // so it stays correctly positioned.
      const toothGroup = svgGetById(svg, "tooth");
      const container = (toothGroup && toothGroup.parentElement) || svg;
      if(container.lastElementChild !== inflammation){
        container.appendChild(inflammation);
      }
    }else{
      const home = inflammationHome.get(inflammation);
      if(home && home.parent){
        const ref = home.next && home.next.parentElement === home.parent ? home.next : null;
        if(inflammation.parentElement !== home.parent || inflammation.nextSibling !== ref){
          home.parent.insertBefore(inflammation, ref);
        }
      }
    }
  }

  const onStateWarning = typeof opts === "function"
    ? opts
    : opts?.onStateWarning;
  onStateWarning?.(state);
}

/**
 * Restore every previously-marked layer in `svg` to its captured base style,
 * then drop the `data-proposed` marker. Runs FIRST on every
 * `applyProposedStyling` call (symmetric reset, like the discoloration tint
 * block's capture-once pattern above): this is what un-dashes a layer when
 * switching plan -> status, or when a plan edit is reverted back to match
 * status.
 */
export function clearProposedStyling(svg: Any): void {
  const marked = svg.querySelectorAll ? svg.querySelectorAll('[data-proposed="1"]') : [];
  for(const el of Array.from(marked) as Any[]){
    if(el.getAttribute("data-base-dash") !== null){ el.style.strokeDasharray = el.getAttribute("data-base-dash") || ""; }
    if(el.getAttribute("data-base-pstroke") !== null){ el.style.stroke = el.getAttribute("data-base-pstroke") || ""; }
    el.removeAttribute("data-proposed");
  }
}

/**
 * Mark `el` as a proposed (plan-only) layer: capture its base
 * strokeDasharray/stroke ONCE (data-base-dash/data-base-pstroke — mirrors
 * the `data-base-fill` capture pattern so a reused node's second render doesn't
 * capture an already-tinted value as "base"), then apply the dashed+tint
 * treatment. Neither captured/written attribute is part of the SVG
 * fingerprint (`collectActiveLayers` reads only id/opacity/class).
 */
export function markProposed(el: Any): void {
  if(el.getAttribute("data-proposed") === "1") return;
  if(el.getAttribute("data-base-dash") === null) el.setAttribute("data-base-dash", el.style.strokeDasharray || "");
  if(el.getAttribute("data-base-pstroke") === null) el.setAttribute("data-base-pstroke", el.style.stroke || "");
  el.style.strokeDasharray = PROPOSED_DASH;
  el.style.stroke = PROPOSED_TINT;
  el.setAttribute("data-proposed", "1");
}

/**
 * Compute which of `svg`'s currently-active layers (already painted with
 * the ACTIVE chart's state by the caller — see `applyStateToSvg`) are
 * present in the PLAN chart but absent from the STATUS chart, and mark only
 * those as "proposed". Always resets first (symmetric — see
 * `clearProposedStyling`), then gates on Plan mode being active. The
 * `charts.status.get(toothNo) ?? defaultState()` fallback is required: an
 * absent status tooth passed as `undefined` makes `applyStateToSvgSingle`
 * early-return, which would leave the clone showing the (already-painted)
 * PLAN layers — collapsing statusIds to planIds and marking nothing.
 */
export function applyProposedStyling(
  toothNo: Any,
  svg: Any,
  _optionsOrWarningCb?: ToothPainterOptions | StateWarningCallback
): void {
  clearProposedStyling(svg);
  if(chartMode !== "plan" || !planInitialized) return;
  const planIds = new Set(collectActiveLayers(svg).map((l) => l.id));
  const clone = svg.cloneNode(true); // detached; getElementById/querySelectorAll work on the clone's own subtree
  applyStateToSvgSingle(toothNo, clone, charts.status.get(toothNo) ?? defaultState());
  const statusIds = new Set(collectActiveLayers(clone).map((l) => l.id));
  for(const id of planIds){
    if(statusIds.has(id)) continue;
    const el = svgGetById(svg, id);
    if(el) markProposed(el);
  }
}

/**
 * Collect, IN DOCUMENT ORDER (not sorted — order captures z-order/re-parenting),
 * one entry per id'd element that is visible after render: self and every ancestor
 * have data-active !== "0", excluding <defs> and non-visual defs elements. Each
 * entry also carries the element's inline `opacity` (parsed from the style
 * attribute, "" if none) and its `class` ("" if none), so per-surface caries-depth
 * encoding (style.opacity / classList "caries-deep") is visible to the fingerprint.
 */
export function collectActiveLayers(svg: Any): { id: string; opacity: string; cls: string }[] {
  const NONVISUAL = new Set(["defs","linearGradient","radialGradient","stop","clipPath","mask","style","title","desc","metadata"]);
  const localName = (el: Element) => el.tagName.replace(/^.*:/, "").toLowerCase();
  const out: { id: string; opacity: string; cls: string }[] = [];
  for (const n of Array.from(svg.querySelectorAll("[id]")) as Element[]) {
    if (NONVISUAL.has(localName(n))) continue;
    let inDefs = false, hidden = false;
    for (let cur: Element | null = n; cur && cur !== (svg.parentElement as Element | null); cur = cur.parentElement) {
      if (localName(cur) === "defs") { inDefs = true; break; }
      if (cur.getAttribute && cur.getAttribute("data-active") === "0") { hidden = true; break; }
    }
    if (inDefs || hidden) continue;
    const style = n.getAttribute("style") || "";
    const m = style.match(/opacity:\s*([0-9.]+)/);
    out.push({ id: n.getAttribute("id") as string, opacity: m ? m[1] : "", cls: n.getAttribute("class") || "" });
  }
  return out; // document order — NOT sorted
}
