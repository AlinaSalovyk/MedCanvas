import type {
  ArchLayout,
  ArchToothLayout,
  IsImplantFn,
  PerioArtworkKind,
  TemplateDocCache,
  TemplateNo,
  ToothKindFn,
} from "./types";
import {
  ARCH_VIEWBOX_PAD,
  BAND_CONTENT_HALF_SPAN,
  fmt,
  MAX_FILL_SCALE,
  MIN_FILL_SCALE,
  PERIO_MM_PX,
  ROW_BASELINE_Y,
  SVG_NS,
  TOOTH_GAP,
} from "./constants";
import {
  anchorFor,
  getToothBaseGroupFromCache,
  perioTemplateFor,
  viewBoxOf,
} from "./toothArt";
import { buildMmGridLayer } from "./mmGrid";

/**
 * Pure scale-fitting math for the dynamic fill-scale (no DOM): given the pixel
 * width available for an arch's tooth columns and the summed base-scale (1x)
 * footprint of that arch's teeth (`ArchLayout.totalWidth`), return the
 * per-tooth column multiplier that makes the columns fill `available`, clamped
 * to `[MIN_FILL_SCALE, MAX_FILL_SCALE]`. Guards a non-finite/non-positive
 * `baseCols` (empty arch, or the template cache not loaded yet) and a
 * non-finite/negative `available` (unmeasured or over-subtracted container
 * width) by falling back to the floor, so "can't measure" degrades to the
 * fixed layout rather than a broken one.
 */
export function computeFillScale(available: number, baseCols: number): number {
  if (!Number.isFinite(available) || !Number.isFinite(baseCols) || baseCols <= 0) {
    return MIN_FILL_SCALE;
  }
  const raw = available / baseCols;
  if (!Number.isFinite(raw)) return MIN_FILL_SCALE;
  return Math.min(MAX_FILL_SCALE, Math.max(MIN_FILL_SCALE, raw));
}

/**
 * Compute one arch row's per-tooth x-cursor layout — the exact same
 * left-to-right cursor walk `buildBuccalRowGroup` uses to place the teeth
 * (`cursorX += viewBoxWidth + TOOTH_GAP`), extracted so BOTH the arch artwork
 * and the curve overlay read one identical layout (no divergent second
 * hard-coded spacing). Skips any tooth without a `TOOTH_TEMPLATE`/cache entry,
 * exactly like the row builder does.
 */
export function archToothLayout(
  cache: TemplateDocCache,
  teeth: readonly number[],
  gap: number = TOOTH_GAP,
  kindFn?: ToothKindFn,
): ArchLayout {
  const out: ArchToothLayout[] = [];
  let cursorX = 0;
  for (const toothNo of teeth) {
    // Kind-aware, because a deciduous molar is wider than the premolar whose
    // position it occupies: a column sized from the permanent template would
    // let the milk tooth overlap its neighbour. Callers that pass no `kindFn`
    // get exactly the previous permanent-only columns.
    const map = perioTemplateFor(toothNo, kindFn ? kindFn(toothNo) : "normal");
    if (!map) continue;
    const tplNo = map.tpl as TemplateNo;
    const doc = cache.get(tplNo);
    if (!doc) continue;
    const { w } = viewBoxOf(doc);
    out.push({ toothNo, x: cursorX, width: w });
    cursorX += w + gap;
  }
  return { cejY: ROW_BASELINE_Y, totalWidth: cursorX, teeth: out };
}

/**
 * Build ONE buccal row: each tooth in `teeth` (in the given order) placed
 * left-to-right at the x from `archToothLayout` (shared with the curve
 * overlay), translated vertically so every tooth's `CEJ_Y` sits on the SAME
 * `ROW_BASELINE_Y`.
 */
export function buildBuccalRowGroup(
  cache: TemplateDocCache,
  teeth: readonly number[],
  isImplant: IsImplantFn = () => false,
  gap: number = TOOTH_GAP,
  kindFn?: ToothKindFn,
): { group: SVGGElement; width: number } {
  const row = document.createElementNS(SVG_NS, "g") as unknown as SVGGElement;
  row.setAttribute("class", "perio-tooth-row-buccal");
  const layout = archToothLayout(cache, teeth, gap, kindFn);
  for (const { toothNo, x } of layout.teeth) {
    // Resolve the artwork kind. A `kindFn` (active-chart aware) supersedes the
    // implant-only predicate, so the graphic tracks the odontogram: missing →
    // draw nothing (column stays reserved by the layout above, keeping the
    // number rows aligned), milktooth → deciduous artwork, implant → fixture body.
    const kind: PerioArtworkKind = kindFn ? kindFn(toothNo) : (isImplant(toothNo) ? "implant" : "normal");
    if (kind === "missing") continue;
    const tplNo = perioTemplateFor(toothNo, kind)!.tpl as TemplateNo;
    const toothGroup = getToothBaseGroupFromCache(cache, toothNo, {
      implant: kind === "implant",
      milktooth: kind === "milktooth",
    });
    // Align each tooth's baseline anchor onto the SAME shared ROW_BASELINE_Y.
    const translateY = ROW_BASELINE_Y - anchorFor(tplNo, kind);
    toothGroup.setAttribute("transform", `translate(${fmt(x)} ${fmt(translateY)})`);
    row.appendChild(toothGroup);
  }
  return { group: row, width: layout.totalWidth };
}

/** Shared viewBox math for either single-band arch SVG: `y` spans
 *  `[ROW_BASELINE_Y - BAND_CONTENT_HALF_SPAN - ARCH_VIEWBOX_PAD, ROW_BASELINE_Y +
 *  BAND_CONTENT_HALF_SPAN + ARCH_VIEWBOX_PAD]`. */
export function bandViewBox(width: number): { y: number; w: number; h: number } {
  const top = ROW_BASELINE_Y - BAND_CONTENT_HALF_SPAN - ARCH_VIEWBOX_PAD;
  const h = 2 * (BAND_CONTENT_HALF_SPAN + ARCH_VIEWBOX_PAD);
  return { y: top, w: Math.max(width, 1), h };
}

/** Wrap one already-oriented row `<g>` into a standalone, responsive
 *  `<svg class="perio-tooth-arch ...">` — no fixed width/height, just
 *  `preserveAspectRatio` + `aria-hidden` (CSS `width:100%` fill + a purely
 *  decorative, screen-reader-hidden subtree). Shared by both
 *  `buildBuccalArchSvg`/`buildPalatalArchSvg` below, so the two bands' SVG
 *  contract is identical. */
export function buildBandSvg(className: string, row: SVGGElement, width: number): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg") as unknown as SVGSVGElement;
  svg.setAttribute("class", className);
  const vb = bandViewBox(width);
  svg.setAttribute("viewBox", `0 ${fmt(vb.y)} ${fmt(vb.w)} ${fmt(vb.h)}`);
  svg.setAttribute("preserveAspectRatio", "xMinYMid meet");
  svg.setAttribute("aria-hidden", "true");
  svg.appendChild(row);
  return svg;
}

/**
 * Build the BUCCAL-aspect arch as a standalone `<svg>`, oriented crown-DOWN
 * for BOTH arches: the row builder's raw output is crown-up (per
 * `getToothBaseGroupFromCache`'s uniform per-tooth flip), so this applies ONE
 * unconditional vertical flip about the CEJ baseline (`matrix(1 0 0 -1 0
 * 2*ROW_BASELINE_Y)`) — the baseline itself is the transform's fixed point, so
 * it never moves. Own mm-grid, counter-flipped (`flip: true`) so its numeric
 * labels read upright inside this net-flipped row.
 */
export function buildBuccalArchSvg(
  cache: TemplateDocCache,
  teeth: readonly number[],
  isImplant: IsImplantFn = () => false,
  gap: number = TOOTH_GAP,
  kindFn?: ToothKindFn,
): SVGSVGElement {
  const { group: row, width } = buildBuccalRowGroup(cache, teeth, isImplant, gap, kindFn);
  row.setAttribute("class", "perio-tooth-row-buccal");
  row.setAttribute("transform", `matrix(1 0 0 -1 0 ${fmt(2 * ROW_BASELINE_Y)})`);
  row.insertBefore(
    buildMmGridLayer({ cejY: ROW_BASELINE_Y, mmPx: PERIO_MM_PX, width, flip: true }),
    row.firstChild,
  );
  return buildBandSvg("perio-tooth-arch perio-tooth-arch-buccal", row, width);
}

/**
 * Build the PALATAL/LINGUAL-aspect arch as a standalone `<svg>`, oriented
 * crown-UP for BOTH arches — the vertical mirror of `buildBuccalArchSvg`'s
 * uniform crown-down flip, about the SAME `ROW_BASELINE_Y` fixed point.
 * Mirroring the SAME axis twice cancels back to the identity transform, so
 * "mirror of buccal" here is exactly the row builder's own un-flipped
 * (crown-up) output — i.e. no orientation transform is applied at all; only
 * the horizontal per-tooth mesial/distal mirror (already baked into each
 * tooth group by `getToothBaseGroupFromCache`) and the uniform per-tooth
 * crown-up flip remain. Own mm-grid, NOT counter-flipped (`flip: false`) —
 * this row is never net-flipped, so its labels already read upright.
 */
export function buildPalatalArchSvg(
  cache: TemplateDocCache,
  teeth: readonly number[],
  isImplant: IsImplantFn = () => false,
  gap: number = TOOTH_GAP,
  kindFn?: ToothKindFn,
): SVGSVGElement {
  const { group: row, width } = buildBuccalRowGroup(cache, teeth, isImplant, gap, kindFn);
  row.setAttribute("class", "perio-tooth-row-palatal-inner");
  row.insertBefore(
    buildMmGridLayer({ cejY: ROW_BASELINE_Y, mmPx: PERIO_MM_PX, width, flip: false }),
    row.firstChild,
  );
  return buildBandSvg("perio-tooth-arch perio-tooth-arch-palatal", row, width);
}
