import {
  buildBuccalArchSvg,
  buildPalatalArchSvg,
  buildPerioCurveLayer,
  perioCurve,
  PERIO_MM_PX,
  type ArchLayout,
  type PerioCurveSite,
  type TemplateDocCache,
} from "@/perioGraphic";
import { isToothImplant, getPerioToothKind, getToothPerio } from "@/state/perio";
import { BUCCAL_SITES, LINGUAL_SITES, LABEL_WIDTH, fmt } from "./constants";

/**
 * Build one aspect's arch graphic (buccal or palatal) and curve overlay.
 * Returns the vertical space (svg user units) the graphic consumed.
 */
export function appendArchGraphic(
  root: Element,
  cache: TemplateDocCache,
  teeth: readonly number[],
  layout: ArchLayout,
  y: number,
  aspect: "buccal" | "palatal",
  gap: number
): number {
  const svg =
    aspect === "buccal"
      ? buildBuccalArchSvg(cache, teeth, isToothImplant, gap, getPerioToothKind)
      : buildPalatalArchSvg(cache, teeth, isToothImplant, gap, getPerioToothKind);

  const vb = (svg.getAttribute("viewBox") || "0 0 1 1").trim().split(/\s+/).map(Number);
  const vbW = vb[2] ?? Math.max(layout.totalWidth, 1);
  const vbH = vb[3] ?? 1;
  svg.setAttribute("x", fmt(LABEL_WIDTH));
  svg.setAttribute("y", fmt(y));
  svg.setAttribute("width", fmt(vbW));
  svg.setAttribute("height", fmt(vbH));

  const rowSelector = aspect === "buccal" ? ".perio-tooth-row-buccal" : ".perio-tooth-row-palatal-inner";
  const rowGroup = svg.querySelector(rowSelector) ?? svg;
  const sites = aspect === "buccal" ? BUCCAL_SITES : LINGUAL_SITES;

  const curveSites: PerioCurveSite[] = [];
  const xs: number[] = [];
  for (const tooth of layout.teeth) {
    if (getPerioToothKind(tooth.toothNo) === "missing") {
      sites.forEach((site, j) => {
        curveSites.push({ site, pd: undefined, gm: undefined });
        xs.push(tooth.x + (tooth.width * (j + 0.5)) / 3);
      });
      continue;
    }
    const perio = getToothPerio(tooth.toothNo);
    const anyCharted = sites.some((s) => Object.prototype.hasOwnProperty.call(perio.pd, s));
    sites.forEach((site, j) => {
      const charted = Object.prototype.hasOwnProperty.call(perio.pd, site);
      const pd = charted ? perio.pd[site] : anyCharted ? 0 : undefined;
      const gm =
        pd === undefined
          ? undefined
          : Object.prototype.hasOwnProperty.call(perio.gm, site)
          ? perio.gm[site]
          : 0;
      curveSites.push({ site, pd, gm });
      xs.push(tooth.x + (tooth.width * (j + 0.5)) / 3);
    });
  }
  const curve = perioCurve(curveSites, { cejY: layout.cejY, mmPx: PERIO_MM_PX, siteX: (i) => xs[i] });
  const curveLayer = buildPerioCurveLayer(curve, {
    width: layout.totalWidth,
    className: aspect === "buccal" ? "perio-curve perio-curve-buccal" : "perio-curve perio-curve-palatal",
  });
  rowGroup.appendChild(curveLayer);

  root.appendChild(svg);
  return vbH;
}
