import {
  getToothPerio,
  getToothCal,
  getToothPlaque,
  getToothRecessionType,
  getKeratinizedWidth,
  getPlaqueIndex,
  getGingivalIndex,
  getPeriImplantPlaque,
  getPeriImplantBleeding,
  getPerioToothKind,
  type PerioSite,
  type PerioOverlayLayer,
} from "@/odontogram";
import {
  archToothLayout,
  perioCurve,
  buildPerioCurveLayer,
  perioOverlayMarks,
  perioPlaqueMarks,
  perioMmHeatMarks,
  perioCairoMarks,
  perioGradeMarks,
  perioKgMarks,
  buildPerioOverlayLayer,
  PERIO_MM_PX,
  type TemplateDocCache,
  type ArchLayout,
  type PerioCurveSite,
  type PerioOverlaySite,
  type PerioCairoTooth,
  type PerioGradeTooth,
  type PerioKgTooth,
  type SiteOverlayLayer,
  type MmHeatOverlayLayer,
} from "@/perioGraphic";
import { BUCCAL_SITES, LINGUAL_SITES } from "./constants";

export function collectCurveInput(
  layout: ArchLayout,
  siteKeys: readonly PerioSite[],
): { sites: PerioCurveSite[]; xs: number[] } {
  const sites: PerioCurveSite[] = [];
  const xs: number[] = [];
  for (const tooth of layout.teeth) {
    const perio = getToothPerio(tooth.toothNo);
    const anyCharted = siteKeys.some((s) => Object.prototype.hasOwnProperty.call(perio.pd, s));
    siteKeys.forEach((site, j) => {
      const charted = Object.prototype.hasOwnProperty.call(perio.pd, site);
      const pd = charted ? perio.pd[site] : (anyCharted ? 0 : undefined);
      const gm = pd === undefined ? undefined
        : (Object.prototype.hasOwnProperty.call(perio.gm, site) ? perio.gm[site] : 0);
      sites.push({ site, pd, gm });
      xs.push(tooth.x + (tooth.width * (j + 0.5)) / 3);
    });
  }
  return { sites, xs };
}

export function resolveAspectSvg(container: Element, aspectClass: string): Element | null {
  return container.querySelector(`svg.${aspectClass}`);
}

export function drawArchCurves(cache: TemplateDocCache, container: HTMLElement | null, teeth: readonly number[]): void {
  if (!container) return;
  container.querySelectorAll(".perio-curve").forEach((el) => el.remove());

  const layout = archToothLayout(cache, teeth, undefined, getPerioToothKind);
  const opts = { cejY: layout.cejY, mmPx: PERIO_MM_PX };

  const buccalSvg = resolveAspectSvg(container, "perio-tooth-arch-buccal");
  if (buccalSvg) {
    const buccalParent = (buccalSvg.querySelector(".perio-tooth-row-buccal") as SVGGElement | null) ?? buccalSvg;
    const buccalIn = collectCurveInput(layout, BUCCAL_SITES);
    const buccalCurve = perioCurve(buccalIn.sites, { ...opts, siteX: (i) => buccalIn.xs[i] });
    const buccalLayer = buildPerioCurveLayer(buccalCurve, { width: layout.totalWidth, className: "perio-curve perio-curve-buccal" });
    buccalParent.appendChild(buccalLayer);
  }

  const palatalSvg = resolveAspectSvg(container, "perio-tooth-arch-palatal");
  if (palatalSvg) {
    const palatalParent = (palatalSvg.querySelector(".perio-tooth-row-palatal-inner") as SVGGElement | null) ?? palatalSvg;
    const lingualIn = collectCurveInput(layout, LINGUAL_SITES);
    const lingualCurve = perioCurve(lingualIn.sites, { ...opts, siteX: (i) => lingualIn.xs[i] });
    const lingualLayer = buildPerioCurveLayer(lingualCurve, { width: layout.totalWidth, className: "perio-curve perio-curve-palatal" });
    palatalParent.appendChild(lingualLayer);
  }
}

export function collectOverlayInput(layout: ArchLayout, siteKeys: readonly PerioSite[]): PerioOverlaySite[] {
  const out: PerioOverlaySite[] = [];
  for (const tooth of layout.teeth) {
    const perio = getToothPerio(tooth.toothNo);
    siteKeys.forEach((site, j) => {
      const charted = Object.prototype.hasOwnProperty.call(perio.pd, site);
      out.push({
        x: tooth.x + (tooth.width * (j + 0.5)) / 3,
        pd: charted ? perio.pd[site] : undefined,
        gm: Object.prototype.hasOwnProperty.call(perio.gm, site) ? perio.gm[site] : undefined,
        bop: perio.bop.includes(site),
      });
    });
  }
  return out;
}

export function collectMmHeatInput(layout: ArchLayout, siteKeys: readonly PerioSite[]): PerioOverlaySite[] {
  const out: PerioOverlaySite[] = [];
  for (const tooth of layout.teeth) {
    const perio = getToothPerio(tooth.toothNo);
    const cal = getToothCal(tooth.toothNo);
    siteKeys.forEach((site, j) => {
      const charted = Object.prototype.hasOwnProperty.call(perio.pd, site);
      out.push({
        x: tooth.x + (tooth.width * (j + 0.5)) / 3,
        pd: charted ? perio.pd[site] : undefined,
        gm: Object.prototype.hasOwnProperty.call(perio.gm, site) ? perio.gm[site] : undefined,
        cal: cal.has(site) ? cal.get(site) : undefined,
      });
    });
  }
  return out;
}

/**
 * Draw (or clear) the overlay for ONE arch band.
 * Exported for direct unit testing against a hand-built template cache;
 * the component calls it from the graphic effect.
 */
export function drawArchOverlay(
  cache: TemplateDocCache,
  container: HTMLElement | null,
  teeth: readonly number[],
  layer: PerioOverlayLayer,
): void {
  if (!container) return;
  container.querySelectorAll(".perio-overlay-layer").forEach((el) => el.remove());
  if (layer === "none") return;

  const buccalSvg = resolveAspectSvg(container, "perio-tooth-arch-buccal");
  const palatalSvg = resolveAspectSvg(container, "perio-tooth-arch-palatal");
  const buccalParent = ((buccalSvg?.querySelector(".perio-tooth-row-buccal") as SVGGElement | null) ?? buccalSvg) as
    | SVGGElement
    | Element
    | null;
  const palatalParent = ((palatalSvg?.querySelector(".perio-tooth-row-palatal-inner") as SVGGElement | null) ??
    palatalSvg) as SVGGElement | Element | null;

  const layout = archToothLayout(cache, teeth, undefined, getPerioToothKind);
  const opts = { cejY: layout.cejY, mmPx: PERIO_MM_PX };
  const className = `perio-overlay-${layer}`;

  if (layer === "plaque") {
    const plaqueTeeth = layout.teeth.map((tooth) => ({
      x: tooth.x,
      width: tooth.width,
      surfaces: getToothPlaque(tooth.toothNo),
    }));
    buccalParent?.appendChild(
      buildPerioOverlayLayer(perioPlaqueMarks(plaqueTeeth, "buccal", opts), { width: layout.totalWidth, className }),
    );
    palatalParent?.appendChild(
      buildPerioOverlayLayer(perioPlaqueMarks(plaqueTeeth, "palatal", opts), { width: layout.totalWidth, className }),
    );
    return;
  }

  if (layer === "cairo") {
    const cairoTeeth: PerioCairoTooth[] = layout.teeth.map((tooth) => ({
      x: tooth.x,
      width: tooth.width,
      rt: getToothRecessionType(tooth.toothNo),
    }));
    buccalParent?.appendChild(
      buildPerioOverlayLayer(perioCairoMarks(cairoTeeth, opts), { width: layout.totalWidth, className }),
    );
    return;
  }

  if (layer === "kg") {
    const kgTeeth: PerioKgTooth[] = layout.teeth.map((tooth) => ({
      x: tooth.x,
      width: tooth.width,
      kg: getKeratinizedWidth(tooth.toothNo),
    }));
    buccalParent?.appendChild(
      buildPerioOverlayLayer(perioKgMarks(kgTeeth, opts), { width: layout.totalWidth, className }),
    );
    return;
  }

  if (layer === "pi" || layer === "gi" || layer === "mpi" || layer === "mbi") {
    const getGrade =
      layer === "pi" ? getPlaqueIndex :
      layer === "gi" ? getGingivalIndex :
      layer === "mpi" ? getPeriImplantPlaque :
      getPeriImplantBleeding;
    const gradeTeeth: PerioGradeTooth[] = layout.teeth.map((tooth) => ({
      x: tooth.x,
      width: tooth.width,
      grades: {
        mesial: getGrade(tooth.toothNo, "mesial"),
        distal: getGrade(tooth.toothNo, "distal"),
        buccal: getGrade(tooth.toothNo, "buccal"),
        lingual: getGrade(tooth.toothNo, "lingual"),
      },
    }));
    buccalParent?.appendChild(
      buildPerioOverlayLayer(perioGradeMarks(gradeTeeth, "buccal", opts), { width: layout.totalWidth, className }),
    );
    palatalParent?.appendChild(
      buildPerioOverlayLayer(perioGradeMarks(gradeTeeth, "palatal", opts), { width: layout.totalWidth, className }),
    );
    return;
  }

  if (layer === "pd" || layer === "cal" || layer === "gr") {
    const mmHeatLayer = layer as MmHeatOverlayLayer;
    const buccalMarks = perioMmHeatMarks(mmHeatLayer, collectMmHeatInput(layout, BUCCAL_SITES), opts);
    buccalParent?.appendChild(buildPerioOverlayLayer(buccalMarks, { width: layout.totalWidth, className }));
    const lingualMarks = perioMmHeatMarks(mmHeatLayer, collectMmHeatInput(layout, LINGUAL_SITES), opts);
    palatalParent?.appendChild(buildPerioOverlayLayer(lingualMarks, { width: layout.totalWidth, className }));
    return;
  }

  const siteLayer = layer as SiteOverlayLayer;
  const buccalMarks = perioOverlayMarks(siteLayer, collectOverlayInput(layout, BUCCAL_SITES), opts);
  buccalParent?.appendChild(buildPerioOverlayLayer(buccalMarks, { width: layout.totalWidth, className }));
  const lingualMarks = perioOverlayMarks(siteLayer, collectOverlayInput(layout, LINGUAL_SITES), opts);
  palatalParent?.appendChild(buildPerioOverlayLayer(lingualMarks, { width: layout.totalWidth, className }));
}
