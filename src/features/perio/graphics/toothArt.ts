import { activeAnatomyProfile } from "@/anatomy/profiles";
import type { PerioArtworkKind, TemplateDocCache, TemplateNo } from "./types";
import {
  CANINE_ROOT_SCALE,
  EXCLUDED_TOOTH_BASE_IDS,
  fmt,
  LATERAL_INCISOR_WIDTH_SCALE,
  SVG_NS,
} from "./constants";

/** The baseline anchor a tooth's graphic aligns on: the implant platform anchor
 *  for an implant, the milk-tooth anchor for a deciduous rendering, else the
 *  natural CEJ. */
export function anchorFor(tplNo: TemplateNo, kind: PerioArtworkKind): number {
  const profile = activeAnatomyProfile();
  if (kind === "implant") return profile.implantCejY[tplNo];
  if (kind === "milktooth") return profile.milktoothCejY[tplNo];
  return profile.cejY[tplNo];
}

/**
 * The template a tooth's perio graphic is drawn from, honouring the deciduous
 * variant where the profile has one.
 *
 * Every caller MUST go through this. The artwork group, its baseline anchor and
 * its column width are computed in three different places, and a deciduous
 * molar is both shorter AND wider than the permanent premolar whose position it
 * occupies (template 74 is 42.9 units wide against 34's 39.8) — so a caller
 * that resolved the template on its own would align the milk tooth on the wrong
 * CEJ anchor, or reserve the wrong column and overlap its neighbour.
 *
 * Returns the permanent entry for every kind but `milktooth`, and for every
 * profile without a deciduous set — so nothing changes for the classic profile.
 */
export function perioTemplateFor(
  toothNo: number,
  kind: PerioArtworkKind = "normal",
): { tpl: number; rot: number; mirror: boolean } | undefined {
  const profile = activeAnatomyProfile();
  if (kind === "milktooth") {
    const primary = profile.primaryToothTemplate?.get(toothNo);
    if (primary) return primary;
  }
  return profile.toothTemplate.get(toothNo);
}

let cachedPromise: Promise<TemplateDocCache> | null = null;

/**
 * Parse each of the 4 tooth templates ONCE into a cached `Document` (never
 * re-parsed per tooth — the returned promise is memoized at module scope so
 * concurrent/repeated calls all await the same settled load). `TEMPLATES` now
 * holds inlined SVG *text* (from `odontogram.ts`'s `?raw` imports), so this
 * parses the markup directly — no `fetch()`. Keeps its OWN cache — the live
 * grid's `tplCache` (inside `buildGrid()`) is a function-local variable, not
 * exported/reachable from here.
 */
export async function loadTemplateCache(): Promise<TemplateDocCache> {
  if (!cachedPromise) {
    cachedPromise = (async () => {
      const cache: TemplateDocCache = new Map();
      const profile = activeAnatomyProfile();
      // The deciduous templates go into the SAME cache: their numbers (51-75)
      // cannot collide with the permanent ones (11-38), and a milk tooth on a
      // profile that has them renders from its own drawing rather than from the
      // permanent template's `#milktooth-base` layer — the same choice the live
      // grid makes, so the two views cannot disagree about a milk tooth.
      const entries = Object.entries({ ...profile.templates, ...(profile.primaryTemplates ?? {}) }) as [string, string][];
      for (const [tplNoStr, svgText] of entries) {
        const tplNo = Number(tplNoStr) as TemplateNo;
        if (!svgText) throw new Error(`perioGraphic: missing template SVG for ${tplNoStr}`);
        cache.set(tplNo, new DOMParser().parseFromString(svgText, "image/svg+xml"));
      }
      return cache;
    })().catch((err) => {
      // Let a failed parse be retried on the next call rather than sticking
      // forever on a rejected promise.
      cachedPromise = null;
      throw err;
    });
  }
  return cachedPromise;
}

/** Drop the memoized template cache so the next `loadTemplateCache()` re-parses
 *  from the (now possibly different) active anatomy profile's templates. Called
 *  when the tooth-anatomy profile switches, so the perio chart tracks it. */
export function resetTemplateCache(): void {
  cachedPromise = null;
}

export function viewBoxOf(doc: Document): { w: number; h: number } {
  const raw = doc.documentElement.getAttribute("viewBox") || "0 0 40 71";
  const parts = raw.trim().split(/\s+/).map(Number);
  return { w: parts[2] ?? 40, h: parts[3] ?? 71 };
}

/** FDI last digit (tooth "position" within its quadrant: 1=central incisor
 *  ... 8=third molar), independent of quadrant/arch. */
export function fdiPosition(toothNo: number): number {
  return toothNo % 10;
}

/** Collect every gradient id referenced via `url(#id)` in `fill`/`style`
 *  anywhere within `root`'s subtree (inclusive of `root` itself). */
export function collectReferencedGradientIds(root: Element): Set<string> {
  const ids = new Set<string>();
  const re = /url\(#([^)]+)\)/g;
  const scan = (el: Element) => {
    const src = `${el.getAttribute("fill") || ""} ${el.getAttribute("style") || ""}`;
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(src))) ids.add(m[1]);
    for (let i = 0; i < el.children.length; i++) scan(el.children[i]);
  };
  scan(root);
  return ids;
}

/** Clone every referenced gradient (`<linearGradient>`/`<radialGradient>`)
 *  out of the template's `<defs>` into a fresh `<defs>` — WITHOUT this, a
 *  cloned tooth-base path with `fill="url(#linear-gradient-...)"` resolves
 *  against nothing once moved into a different document/subtree and renders
 *  solid black. Returns `null` when nothing is referenced (true for all 4
 *  current templates' flat-fill `#tooth-base` — then a documented no-op, not
 *  a bug). */
export function cloneReferencedDefs(doc: Document, referencedIds: Set<string>): SVGDefsElement | null {
  if (referencedIds.size === 0) return null;
  const defs = document.createElementNS(SVG_NS, "defs") as unknown as SVGDefsElement;
  let found = false;
  for (const id of referencedIds) {
    // Direct id concatenation (no CSS.escape — matches the existing
    // `svgGetById` fallback's `$("#"+id, root)` precedent in odontogram.ts;
    // every id in these assets is a simple hyphenated alphanumeric token).
    const src = doc.querySelector(`#${id}`);
    if (src) {
      defs.appendChild(src.cloneNode(true));
      found = true;
    }
  }
  return found ? defs : null;
}

/** Remove any descendant (or self) whose id is in `EXCLUDED_TOOTH_BASE_IDS`
 *  — belt-and-braces: `#tooth-base` is a single leaf `<path>` in all 4
 *  current templates (so this is currently a no-op), but a future template
 *  revision could nest excluded layers under it — this keeps the exclusion
 *  guarantee robust to that. */
export function stripExcludedLayers(root: Element, ids: readonly string[] = EXCLUDED_TOOTH_BASE_IDS): void {
  const excluded = new Set(ids);
  if (excluded.has(root.getAttribute("id") || "")) {
    root.remove();
    return;
  }
  const toRemove: Element[] = [];
  root.querySelectorAll("[id]").forEach((el) => {
    if (excluded.has(el.getAttribute("id") || "")) toRemove.push(el);
  });
  for (const el of toRemove) el.remove();
}

/**
 * Build ONE tooth's crown/root artwork group for the perio row: a clone of
 * that tooth's `#tooth-base` (+ any gradients it references), oriented
 * (horizontal mirror only) and size-transformed for its FDI position.
 *
 * Orientation: `TOOTH_TEMPLATE.get(toothNo)` gives `{tpl, rot, mirror}`. This
 * reads only `tpl`/`mirror` and IGNORES `rot` — using the odontogram's own
 * per-tooth `.rot` (0 for upper-mapped, 180 for lower-mapped entries in the
 * SAME `tpl`) would give the upper and lower halves of one perio row OPPOSITE
 * vertical orientation (a 180° rotation flips both axes) — wrong for a perio
 * chart, which wants every tooth crown-up, uniformly, in both arches.
 *
 * Every template's raw/un-rotated artwork is root-up / crown-down (the crown/
 * incisal edge sits at LARGER y, the root/apex at SMALLER y). So a uniformly
 * crown-up row still needs a vertical flip — just ONE fixed, uniform flip
 * applied to every tooth alike (never the per-tooth conditional `.rot`), which
 * is what step 1 below is.
 */
export function getToothBaseGroupFromCache(
  cache: TemplateDocCache,
  toothNo: number,
  opts: { implant?: boolean; milktooth?: boolean } = {},
): SVGGElement {
  // A milk tooth prefers its own deciduous drawing where the profile has one
  // (positions 1-5); everywhere else — and on every profile without a
  // deciduous set — it stays the permanent template, whose `#milktooth-base`
  // layer is selected below.
  const map = perioTemplateFor(
    toothNo,
    opts.milktooth === true && opts.implant !== true ? "milktooth" : "normal",
  );
  if (!map) throw new Error(`perioGraphic: no TOOTH_TEMPLATE entry for tooth ${toothNo}`);
  const tplNo = map.tpl as TemplateNo;
  const doc = cache.get(tplNo);
  if (!doc) throw new Error(`perioGraphic: template ${tplNo} not loaded in the given cache (tooth ${toothNo})`);

  // An implant tooth renders the fixture body (`#implant-base`) instead of the
  // natural crown/root outline (`#tooth-base`) — the SAME layer the live
  // odontogram activates for a plain implant (see odontogram.ts's
  // `applyStateToSvgSingle`: `#implant` container un-hidden + `#implant-base`
  // active; the attachment sub-layers — locator/bar/healing-abutment — and the
  // peri-implant overlays stay inactive, so `#implant-base` alone is the visible
  // plain-implant body). Everything downstream (clone-referenced-defs, uniform
  // flip, horizontal mirror, per-position size, baseline align) is identical for
  // both — only the source layer id and the baseline anchor differ.
  const implant = opts.implant === true;
  // A milk tooth only exists in the primary positions (1–5, templates 11/13/14);
  // molar templates carry no `#milktooth-base`. If a milktooth is requested on a
  // template that lacks it (malformed/imported state on a molar), fall back to
  // the natural tooth artwork rather than throwing — robustness over a crash.
  const milktooth = opts.milktooth === true && !implant && !!doc.querySelector("#milktooth-base");
  const kind: PerioArtworkKind = implant ? "implant" : milktooth ? "milktooth" : "normal";
  const layerId = implant ? "implant-base" : milktooth ? "milktooth-base" : "tooth-base";
  const baseLayer = doc.querySelector(`#${layerId}`);
  if (!baseLayer) throw new Error(`perioGraphic: #${layerId} not found in template ${tplNo}`);
  const baseClone = baseLayer.cloneNode(true) as SVGElement;
  // Never strip the layer we are extracting (milktooth-base is itself in the
  // exclusion list, since it must be stripped OUT of a natural tooth-base clone).
  stripExcludedLayers(baseClone, EXCLUDED_TOOTH_BASE_IDS.filter((id) => id !== layerId));

  const referenced = collectReferencedGradientIds(baseClone);
  const defsClone = cloneReferencedDefs(doc, referenced);

  const { w, h } = viewBoxOf(doc);
  const cejY = anchorFor(tplNo, kind);

  const outer = document.createElementNS(SVG_NS, "g") as unknown as SVGGElement;
  outer.setAttribute("data-tooth", String(toothNo));
  outer.setAttribute("data-tpl", String(tplNo));
  if (implant) outer.setAttribute("data-implant", "1");
  if (milktooth) outer.setAttribute("data-milktooth", "1");

  if (defsClone) outer.appendChild(defsClone);

  // 1) Uniform vertical flip: root-up/crown-down (raw) -> crown-up (row
  //    convention), applied unconditionally — see the doc comment above.
  //    matrix(1 0 0 -1 0 h): y' = -y + h = h - y; x unchanged.
  const flipGroup = document.createElementNS(SVG_NS, "g") as unknown as SVGGElement;
  flipGroup.setAttribute("transform", `matrix(1 0 0 -1 0 ${fmt(h)})`);
  flipGroup.appendChild(baseClone);

  // 2) Horizontal mirror for left/right mesial-distal correctness.
  //    matrix(-1 0 0 1 w 0): x' = -x + w = w - x; y unchanged.
  //
  //    The flip must equal the live odontogram's NET horizontal flip, and that
  //    is `mirror XOR rot180`, not `mirror` alone: the live grid places every
  //    lower-arch tooth with `rotate(180)` (see `rotate180` in odontogram.ts),
  //    and a 180° rotation flips BOTH axes — its horizontal half cancels or
  //    adds to `mirror`. Step 1 above only ever flips vertically, so reading
  //    `mirror` alone left every lower tooth mirrored the wrong way round, with
  //    mesial pointing AWAY from the midline in both lower quadrants. Each tooth
  //    looked plausible on its own; only the pair read as swapped, which is why
  //    it went unnoticed (the upper arch has rot 0, where both rules agree).
  const mirrorGroup = document.createElementNS(SVG_NS, "g") as unknown as SVGGElement;
  if (map.mirror !== (map.rot === 180)) {
    mirrorGroup.setAttribute("data-perio-mirror", "1");
    mirrorGroup.setAttribute("transform", `matrix(-1 0 0 1 ${fmt(w)} 0)`);
  }
  mirrorGroup.appendChild(flipGroup);

  // 3) Per-position size transform (FDI last digit), anchored so its fixed
  //    point never moves (keeps CEJ_Y-based row-baseline alignment correct
  //    regardless of which position transform, if any, is applied).
  const pos = fdiPosition(toothNo);
  const sizeGroup = document.createElementNS(SVG_NS, "g") as unknown as SVGGElement;
  if (pos === 2) {
    // scale(0.8,1) anchored at the horizontal center (cx = w/2):
    // x' = 0.8*(x-cx)+cx = 0.8x + cx*0.2 = 0.8x + w*0.1
    sizeGroup.setAttribute("data-perio-size", `position-2-width-${LATERAL_INCISOR_WIDTH_SCALE}`);
    sizeGroup.setAttribute("transform", `matrix(${LATERAL_INCISOR_WIDTH_SCALE} 0 0 1 ${fmt(w * (1 - LATERAL_INCISOR_WIDTH_SCALE) / 2)} 0)`);
  } else if (pos === 3) {
    // scale(1,K) anchored at CEJ_Y: y' = K*(y-cejY)+cejY = K*y + cejY*(1-K)
    const f = cejY * (1 - CANINE_ROOT_SCALE);
    sizeGroup.setAttribute("data-perio-size", `position-3-root-${CANINE_ROOT_SCALE}`);
    sizeGroup.setAttribute("transform", `matrix(1 0 0 ${CANINE_ROOT_SCALE} 0 ${fmt(f)})`);
  }
  sizeGroup.appendChild(mirrorGroup);

  outer.appendChild(sizeGroup);
  return outer;
}
