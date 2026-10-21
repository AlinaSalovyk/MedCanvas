import type {
  MmHeatBucket,
  MmHeatOverlayLayer,
  OverlayMark,
  PerioCairoTooth,
  PerioGradeTooth,
  PerioKgTooth,
  PerioOverlaySite,
  PerioPlaqueTooth,
  SiteOverlayLayer,
} from "./types";
import { fmt, OVERLAY_MARK_RADIUS, SVG_NS } from "./constants";

/**
 * Pure geometry for the site-based discrete overlays. Uses the EXACT same
 * coordinate math as `perioCurve` (`marginY = cejY + gm*mmPx`, `pocketY =
 * marginY + pd*mmPx`), so a mark sits on the same point the curve draws:
 *   - `bop`      : a dot at the gingival MARGIN of every bleeding, charted
 *                  site (a bop flag on an uncharted site is ignored, mirroring
 *                  `getPerioSummary().bopPercent`).
 *   - `pd5`/`pd6`: a heat spot at the POCKET BASE of every charted site whose
 *                  probing depth is >= 5 / >= 6 mm.
 * An uncharted site (`pd` undefined/null) never produces a mark.
 */
export function perioOverlayMarks(
  layer: SiteOverlayLayer,
  sites: readonly PerioOverlaySite[],
  opts: { cejY: number; mmPx: number },
): OverlayMark[] {
  const { cejY, mmPx } = opts;
  const out: OverlayMark[] = [];
  for (const s of sites) {
    const charted = s.pd !== undefined && s.pd !== null;
    if (!charted) continue;
    const pd = s.pd as number;
    const marginY = cejY + (s.gm ?? 0) * mmPx;
    if (layer === "bop") {
      if (s.bop) out.push({ x: s.x, y: marginY, kind: "bop" });
    } else {
      const threshold = layer === "pd5" ? 5 : 6;
      if (pd >= threshold) out.push({ x: s.x, y: marginY + pd * mmPx, kind: layer });
    }
  }
  return out;
}

/**
 * Pure ramp for a probing-style distance in mm — PD (raw probing depth) or
 * CAL (`pd + gm`, i.e. attachment loss from the CEJ). Thresholds mirror the
 * pd5/pd6 discrete-overlay thresholds (>=4mm starts to matter clinically,
 * >=6mm is a deep/severe pocket), so the heat scale and the discrete
 * >=5mm/>=6mm highlights read consistently side by side.
 */
export function pdCalHeatBucket(mm: number): MmHeatBucket {
  if (mm >= 6) return "deep";
  if (mm >= 4) return "moderate";
  return "shallow";
}

/**
 * Pure ramp for gingival recession (`gm`, in mm — only meaningful when
 * `gm > 0`; a non-positive `gm` is a pseudopocket/coronal margin, never
 * recession, and must be filtered out by the caller before ramping). Lower
 * thresholds than {@link pdCalHeatBucket}: recession is measured on a
 * shallower clinical scale than pocket/attachment depth.
 */
export function recessionHeatBucket(mm: number): MmHeatBucket {
  if (mm >= 4) return "deep";
  if (mm >= 2) return "moderate";
  return "shallow";
}

/**
 * Pure geometry for the continuous mm heat overlays. Reuses the EXACT same
 * coordinate math as `perioCurve`/`perioOverlayMarks` (`marginY = cejY +
 * gm*mmPx`, `pocketY = marginY + pd*mmPx`):
 *   - `pd` : every charted site, heat-bucketed by probing depth, marked at the
 *            pocket base (same point the pd5/pd6 discrete marks use).
 *   - `cal`: every charted site, heat-bucketed by CAL (`site.cal`, falling
 *            back to `pd + gm` if the caller didn't attach it — the two are
 *            always numerically identical, see `getToothCal`), marked at the
 *            SAME pocket-base point (`cejY + cal*mmPx === cejY + (pd+gm)*mmPx`
 *            — CAL measured from the CEJ IS the pocket base).
 *   - `gr` : only sites with recession (`gm > 0`) are marked, heat-bucketed by
 *            `gm` via {@link recessionHeatBucket}, at the gingival margin
 *            (the same point the recession sits at — mirrors `bop`'s
 *            margin-point placement).
 * An uncharted site (`pd` undefined/null) never produces a mark, matching
 * every other site-based overlay.
 */
export function perioMmHeatMarks(
  layer: MmHeatOverlayLayer,
  sites: readonly PerioOverlaySite[],
  opts: { cejY: number; mmPx: number },
): OverlayMark[] {
  const { cejY, mmPx } = opts;
  const out: OverlayMark[] = [];
  for (const s of sites) {
    const charted = s.pd !== undefined && s.pd !== null;
    if (!charted) continue;
    const pd = s.pd as number;
    const gm = s.gm ?? 0;

    if (layer === "gr") {
      if (gm <= 0) continue;
      out.push({ x: s.x, y: cejY + gm * mmPx, kind: `heat-${recessionHeatBucket(gm)}` });
      continue;
    }

    const mm = layer === "cal" ? s.cal ?? pd + gm : pd;
    const y = cejY + (gm + pd) * mmPx; // pocket base — equals cejY + cal*mmPx for CAL
    out.push({ x: s.x, y, kind: `heat-${pdCalHeatBucket(mm)}` });
  }
  return out;
}

/**
 * Pure geometry for the plaque overlay: one mark per charted O'Leary surface,
 * placed on the tooth's cervical band (at the shared CEJ baseline). Plaque is
 * a whole-tooth, 4-surface index (mesial/distal/buccal/lingual) rather than a
 * per-probing-site reading, so the marks split across the two rows:
 *   - the BUCCAL aspect shows mesial/buccal/distal (interproximal + facial),
 *   - the PALATAL/LINGUAL aspect shows lingual.
 * This way every charted surface is drawn exactly once across the two rows.
 */
export function perioPlaqueMarks(
  teeth: readonly PerioPlaqueTooth[],
  aspect: "buccal" | "palatal",
  opts: { cejY: number; mmPx: number },
): OverlayMark[] {
  const out: OverlayMark[] = [];
  for (const tooth of teeth) {
    const has = (surface: string) => tooth.surfaces.includes(surface);
    if (aspect === "buccal") {
      if (has("mesial")) out.push({ x: tooth.x + tooth.width * 0.2, y: opts.cejY, kind: "plaque" });
      if (has("buccal")) out.push({ x: tooth.x + tooth.width * 0.5, y: opts.cejY, kind: "plaque" });
      if (has("distal")) out.push({ x: tooth.x + tooth.width * 0.8, y: opts.cejY, kind: "plaque" });
    } else {
      if (has("lingual")) out.push({ x: tooth.x + tooth.width * 0.5, y: opts.cejY, kind: "plaque" });
    }
  }
  return out;
}

/**
 * Pure geometry for the Cairo recession-type overlay: one mark per tooth
 * whose derived RT is not `"none"`, centered on the tooth at the shared CEJ
 * baseline (the same `cejY` every other overlay/curve anchors to). A tooth
 * with `"none"` (no buccal recession, or not charted) yields no mark.
 */
export function perioCairoMarks(
  teeth: readonly PerioCairoTooth[],
  opts: { cejY: number },
): OverlayMark[] {
  const out: OverlayMark[] = [];
  for (const tooth of teeth) {
    if (tooth.rt === "none") continue;
    out.push({ x: tooth.x + tooth.width * 0.5, y: opts.cejY, kind: tooth.rt });
  }
  return out;
}

/** Severity bucket for a CHARTED graded per-surface index reading (PI/GI,
 *  1-3) — reuses the same shallow/moderate/deep heat vocabulary as the
 *  continuous mm ramps ({@link pdCalHeatBucket}/{@link recessionHeatBucket}).
 *  Callers only ever bucket a grade >0 (0/uncharted is filtered out before
 *  reaching here, mirroring `perioPlaqueMarks`' presence-only marking). */
export function gradeHeatBucket(grade: 1 | 2 | 3): MmHeatBucket {
  if (grade >= 3) return "deep";
  if (grade >= 2) return "moderate";
  return "shallow";
}

/**
 * Pure geometry for the PI/GI graded-index overlays: one heat-bucketed mark
 * per CHARTED (grade>0) O'Leary surface, at the SAME cervical/CEJ points
 * {@link perioPlaqueMarks} uses — the marks split across the two rows exactly
 * like the plaque overlay (buccal aspect: mesial/buccal/distal; palatal/
 * lingual aspect: lingual), so every charted surface is drawn exactly once.
 */
export function perioGradeMarks(
  teeth: readonly PerioGradeTooth[],
  aspect: "buccal" | "palatal",
  opts: { cejY: number },
): OverlayMark[] {
  const out: OverlayMark[] = [];
  for (const tooth of teeth) {
    const mark = (x: number, g: 0 | 1 | 2 | 3 | undefined) => {
      if (!g) return; // 0/undefined -> healthy/uncharted, no mark
      out.push({ x, y: opts.cejY, kind: `heat-${gradeHeatBucket(g)}` });
    };
    if (aspect === "buccal") {
      mark(tooth.x + tooth.width * 0.2, tooth.grades.mesial);
      mark(tooth.x + tooth.width * 0.5, tooth.grades.buccal);
      mark(tooth.x + tooth.width * 0.8, tooth.grades.distal);
    } else {
      mark(tooth.x + tooth.width * 0.5, tooth.grades.lingual);
    }
  }
  return out;
}

/**
 * Pure ramp for keratinized (attached) gingiva width in mm. Unlike a probing
 * depth/CAL ramp, a NARROW band is the mucogingival risk here — the severity
 * direction is inverted: <2mm inadequate ("deep"), <4mm borderline
 * ("moderate"), >=4mm adequate ("shallow" — reusing the shallow/moderate/deep
 * heat vocabulary purely as a severity ramp, not a literal depth reading).
 */
export function kgHeatBucket(mm: number): MmHeatBucket {
  if (mm < 2) return "deep";
  if (mm < 4) return "moderate";
  return "shallow";
}

/**
 * Pure geometry for the KG overlay: one heat-bucketed mark per tooth with a
 * charted (non-null) KG reading, centered on the tooth's BUCCAL cervical/CEJ
 * point (KG is specifically a buccal measure — mirrors {@link perioCairoMarks}'
 * buccal-only placement). A tooth with `kg === null` (never charted) yields
 * no mark.
 */
export function perioKgMarks(teeth: readonly PerioKgTooth[], opts: { cejY: number }): OverlayMark[] {
  const out: OverlayMark[] = [];
  for (const tooth of teeth) {
    if (tooth.kg === null) continue;
    out.push({ x: tooth.x + tooth.width * 0.5, y: opts.cejY, kind: `heat-${kgHeatBucket(tooth.kg)}` });
  }
  return out;
}

/**
 * Build the overlay `<g>` for ONE row from a positioned mark list: an
 * aria-hidden group (decorative — the accessible data lives in the number
 * cells/summary) of one `<circle>` per mark, classed `perio-overlay-{kind}`
 * so CSS colours the BOP dot red, the plaque mark, and the pd5/pd6 heat spots.
 * Pure DOM (jsdom in tests / the browser at runtime) — no perio-module call,
 * so it is trivially unit-testable and parity-irrelevant.
 */
export function buildPerioOverlayLayer(
  marks: readonly OverlayMark[],
  opts: { width: number; className?: string },
): SVGGElement {
  const g = document.createElementNS(SVG_NS, "g") as unknown as SVGGElement;
  g.setAttribute("class", `perio-overlay-layer${opts.className ? ` ${opts.className}` : ""}`);
  g.setAttribute("aria-hidden", "true");
  for (const mark of marks) {
    const c = document.createElementNS(SVG_NS, "circle");
    c.setAttribute("class", `perio-overlay-mark perio-overlay-${mark.kind}`);
    c.setAttribute("data-kind", mark.kind);
    c.setAttribute("cx", fmt(mark.x));
    c.setAttribute("cy", fmt(mark.y));
    c.setAttribute("r", fmt(OVERLAY_MARK_RADIUS[mark.kind]));
    g.appendChild(c);
  }
  return g;
}
