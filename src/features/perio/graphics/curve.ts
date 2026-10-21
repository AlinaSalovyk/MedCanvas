import type { CurvePoint, PerioCurveResult, PerioCurveSite } from "./types";
import { fmt, SVG_NS } from "./constants";

/**
 * Pure curve geometry — turn ordered per-site {pd,gm} readings into the
 * gingival-margin and pocket-base point arrays, in the arch row's LOCAL
 * coordinate space (crown up = smaller y, root down = larger y; the shared
 * CEJ baseline at `opts.cejY`). No DOM.
 *
 * Orientation (buccal row): `y` grows downward toward the root, so
 *   marginY = cejY + (gm ?? 0)*mmPx   → recession (gm>0) pushes the margin
 *                                        DOWN toward the root; a coronal
 *                                        margin (gm<0) lifts it above the CEJ.
 *   pocketY = marginY + pd*mmPx       → a deeper pocket dips the pocket line
 *                                        FURTHER from the CEJ toward the root.
 * The palatal row reuses this same buccal-space result; its band renders in an
 * independent SVG (crown-up, identity transform — no net mirror), so "toward
 * the root" stays anatomically consistent on both rows.
 *
 * An uncharted site (`pd` undefined/null) yields `null` at that index in BOTH
 * arrays, so the caller can break the polyline/band there (line gaps).
 */
export function perioCurve(
  sites: readonly PerioCurveSite[],
  opts: { cejY: number; mmPx: number; siteX: (i: number) => number },
): PerioCurveResult {
  const { cejY, mmPx, siteX } = opts;
  const marginPts: (CurvePoint | null)[] = [];
  const pocketPts: (CurvePoint | null)[] = [];
  sites.forEach((s, i) => {
    if (s.pd === undefined || s.pd === null) {
      marginPts.push(null);
      pocketPts.push(null);
      return;
    }
    const x = siteX(i);
    const marginY = cejY + (s.gm ?? 0) * mmPx;
    const pocketY = marginY + s.pd * mmPx;
    marginPts.push({ x, y: marginY });
    pocketPts.push({ x, y: pocketY });
  });
  return { cejY, marginPts, pocketPts };
}

/** Split a point array into maximal contiguous runs of non-null points (a
 *  `null` breaks the run — the "line gap" at an uncharted site). */
export function contiguousRuns(pts: readonly (CurvePoint | null)[]): CurvePoint[][] {
  const runs: CurvePoint[][] = [];
  let cur: CurvePoint[] = [];
  for (const p of pts) {
    if (p) {
      cur.push(p);
    } else if (cur.length) {
      runs.push(cur);
      cur = [];
    }
  }
  if (cur.length) runs.push(cur);
  return runs;
}

export function polylinePoints(run: readonly CurvePoint[]): string {
  return run.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(" ");
}

/**
 * Build the curve overlay <g> for ONE row: a red horizontal CEJ line at
 * `cejY`, a filled band `<path>` between the margin and pocket lines, and the
 * margin + pocket polylines — each broken into separate segments at uncharted
 * gaps. Pure DOM (jsdom `document` in tests / the browser at runtime) — no
 * perio-module call, so it is trivially unit-testable and parity-irrelevant
 * (brand-new DOM, never near the live odontogram).
 */
export function buildPerioCurveLayer(
  curve: PerioCurveResult,
  opts: { width: number; className?: string },
): SVGGElement {
  const g = document.createElementNS(SVG_NS, "g") as unknown as SVGGElement;
  g.setAttribute("class", opts.className ?? "perio-curve");

  // CEJ baseline — always drawn, even for an all-uncharted arch.
  const cej = document.createElementNS(SVG_NS, "line");
  cej.setAttribute("class", "perio-curve-cej");
  cej.setAttribute("x1", "0");
  cej.setAttribute("y1", fmt(curve.cejY));
  cej.setAttribute("x2", fmt(opts.width));
  cej.setAttribute("y2", fmt(curve.cejY));
  g.appendChild(cej);

  const marginRuns = contiguousRuns(curve.marginPts);
  const pocketRuns = contiguousRuns(curve.pocketPts);

  // Filled band between the two lines, per contiguous run (margin/pocket share
  // the same null pattern, so the runs line up index-for-index): trace the
  // margin left→right, then the pocket right→left, and close.
  for (let r = 0; r < marginRuns.length; r++) {
    const mRun = marginRuns[r];
    const pRun = pocketRuns[r];
    if (!pRun || mRun.length === 0) continue;
    const forward = mRun.map((p, i) => `${i === 0 ? "M" : "L"}${fmt(p.x)} ${fmt(p.y)}`).join(" ");
    const back = [...pRun].reverse().map((p) => `L${fmt(p.x)} ${fmt(p.y)}`).join(" ");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("class", "perio-curve-band");
    path.setAttribute("d", `${forward} ${back} Z`);
    g.appendChild(path);
  }

  for (const run of marginRuns) {
    const pl = document.createElementNS(SVG_NS, "polyline");
    pl.setAttribute("class", "perio-curve-margin");
    pl.setAttribute("points", polylinePoints(run));
    g.appendChild(pl);
  }
  for (const run of pocketRuns) {
    const pl = document.createElementNS(SVG_NS, "polyline");
    pl.setAttribute("class", "perio-curve-pocket");
    pl.setAttribute("points", polylinePoints(run));
    g.appendChild(pl);
  }

  return g;
}
