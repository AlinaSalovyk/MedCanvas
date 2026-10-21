import {
  archToothLayout,
  loadTemplateCache,
  type ArchLayout,
  type TemplateDocCache,
} from "@/perioGraphic";
import {
  getCejVisibility,
  getGingivalIndex,
  getGingivalThickness,
  getKeratinizedWidth,
  getMillerClass,
  getPeriImplantBleeding,
  getPeriImplantPlaque,
  getPerioToothKind,
  getPlaqueIndex,
  getRootConcavity,
  getToothCal,
  getToothMobility,
  getToothPerio,
  getToothPlaque,
  isToothImplant,
} from "@/state/perio";
import { getPerioRowVisibility } from "@/state/perioSettings";
import { isUpperTooth } from "@/anatomy/profiles";
import { formatToothLabel } from "@/state/numbering";
import { indexName } from "@/perioIndexNames";
import { t } from "@/i18n/useI18n";
import {
  SVG_NS,
  UPPER_ARCH,
  LOWER_ARCH,
  BUCCAL_SITES,
  LINGUAL_SITES,
  LABEL_WIDTH,
  SECTION_GAP,
  PERIO_EXPORT_STYLE,
  GRADE_FACE,
  MOBILITY_FACE,
  CEJ_FACE,
  ROOT_CONCAVITY_FACE,
  GT_FACE,
  MILLER_FACE,
  type PerioExportContext,
  fmt,
} from "./constants";
import {
  createTextNode,
  appendSiteRow,
  appendSurfaceRow,
  appendSingleRow,
  appendFurcationRow,
} from "./renderRows";
import { appendArchGraphic } from "./renderGraphic";

export interface BuildPerioSvgOptions {
  fontSize?: number;
  rowHeight?: number;
  toothGap?: number;
  showEmptyRows?: boolean;
  labelPlacement?: "center" | "edge";
}

/**
 * Build the FULL perio chart (teeth graphic + numeric rows) as one standalone
 * vector SVG, from the active chart's state — headless, no mounted DOM read.
 * Returns `null` when the shared tooth-template cache (`loadTemplateCache()`)
 * fails to load.
 */
export async function buildPerioSvg(
  opts: BuildPerioSvgOptions = {}
): Promise<{ xml: string; width: number; height: number } | null> {
  let cache: TemplateDocCache;
  try {
    cache = await loadTemplateCache();
  } catch {
    return null;
  }

  const ctx: PerioExportContext = {
    rowFontSize: opts.fontSize ?? 8,
    rowHeight: opts.rowHeight ?? 13,
    skipEmptyRows: opts.showEmptyRows === false,
    stripeBands: [],
  };

  const toothGap = opts.toothGap ?? 2;
  const labelPlacement = opts.labelPlacement ?? "center";

  /** Re-space a raw arch layout with the requested inter-tooth gap. */
  const respace = (l: ArchLayout): ArchLayout => {
    let x = 0;
    const teeth = l.teeth.map((tt) => {
      const nt = { ...tt, x };
      x += tt.width + toothGap;
      return nt;
    });
    return { ...l, teeth, totalWidth: x };
  };

  const svg = document.createElementNS(SVG_NS, "svg") as unknown as SVGSVGElement;
  const styleEl = document.createElementNS(SVG_NS, "style");
  styleEl.textContent = PERIO_EXPORT_STYLE;
  svg.appendChild(styleEl);

  const bgLayer = document.createElementNS(SVG_NS, "g");
  bgLayer.setAttribute("aria-hidden", "true");
  svg.appendChild(bgLayer);

  let cursorY = ctx.rowHeight;
  let maxWidth = LABEL_WIDTH;
  const visible = getPerioRowVisibility();

  const buildOneArch = (teeth: readonly number[]) => {
    const layout = respace(archToothLayout(cache, teeth, undefined, getPerioToothKind));
    if (layout.teeth.length === 0) return;
    maxWidth = Math.max(maxWidth, LABEL_WIDTH + layout.totalWidth);
    const isUpper = isUpperTooth(teeth[0]);
    const buccalLabel = t("perio.buccal");
    const lingualLabel = isUpper ? t("perio.palatal") : t("perio.lingual");
    const archHasImplant = teeth.some((n) => isToothImplant(n));

    // Centered arch title ("Upper Teeth" / "Lower Teeth").
    const archTitle = createTextNode(
      ctx,
      LABEL_WIDTH + layout.totalWidth / 2,
      cursorY,
      isUpper ? t("perio.export.upperTeeth") : t("perio.export.lowerTeeth"),
      "middle"
    );
    archTitle.setAttribute("font-weight", "700");
    archTitle.setAttribute("font-size", String(ctx.rowFontSize * 1.15));
    svg.appendChild(archTitle);
    cursorY += ctx.rowHeight;
    const archStartY = cursorY - ctx.rowHeight * 0.7;

    // --- Tooth-number header row ---
    for (const tooth of layout.teeth) {
      const x = LABEL_WIDTH + tooth.x + tooth.width / 2;
      svg.appendChild(createTextNode(ctx, x, cursorY, formatToothLabel(tooth.toothNo)));
    }
    cursorY += ctx.rowHeight;

    // --- Miller-class row ---
    if (visible.miller) {
      if (
        appendSingleRow(ctx, svg, cursorY, indexName("miller"), layout, (n) => {
          const v = getMillerClass(n);
          return v === "none" ? null : MILLER_FACE[v] ?? v;
        })
      )
        cursorY += ctx.rowHeight;
    }

    // --- Buccal-aspect rows (BOP, CAL, GM, PD) ---
    if (visible.bop) {
      if (
        appendSiteRow(ctx, svg, cursorY, `${buccalLabel} ${indexName("bop")}`, layout, BUCCAL_SITES, (n, site) => {
          const perio = getToothPerio(n);
          const charted = Object.prototype.hasOwnProperty.call(perio.pd, site);
          return charted && perio.bop.includes(site) ? "•" : null;
        })
      )
        cursorY += ctx.rowHeight;
    }
    if (visible.cal) {
      if (
        appendSiteRow(ctx, svg, cursorY, `${buccalLabel} ${indexName("cal")}`, layout, BUCCAL_SITES, (n, site) => {
          const v = getToothCal(n).get(site);
          return v === undefined ? null : String(v);
        })
      )
        cursorY += ctx.rowHeight;
    }
    if (visible.gm) {
      if (
        appendSiteRow(ctx, svg, cursorY, `${buccalLabel} ${indexName("gm")}`, layout, BUCCAL_SITES, (n, site) => {
          const perio = getToothPerio(n);
          const charted = Object.prototype.hasOwnProperty.call(perio.pd, site);
          if (!charted || !Object.prototype.hasOwnProperty.call(perio.gm, site)) return null;
          return String(perio.gm[site]);
        })
      )
        cursorY += ctx.rowHeight;
    }
    if (visible.pd) {
      if (
        appendSiteRow(ctx, svg, cursorY, `${buccalLabel} ${indexName("pd")}`, layout, BUCCAL_SITES, (n, site) => {
          const perio = getToothPerio(n);
          const charted = Object.prototype.hasOwnProperty.call(perio.pd, site);
          return charted ? String(perio.pd[site]) : null;
        })
      )
        cursorY += ctx.rowHeight;
    }

    // --- Furcation row ---
    if (visible.furcation) {
      if (appendFurcationRow(ctx, svg, cursorY, indexName("furcation"), layout)) cursorY += ctx.rowHeight;
    }

    // --- BUCCAL tooth-row graphic + curve overlay ---
    cursorY += appendArchGraphic(svg, cache, teeth, layout, cursorY, "buccal", toothGap);

    // --- Band-orientation legend ---
    const bandBuccal = t("perio.band.buccal");
    const bandLingual = t("perio.band.lingual");
    const bandCenterX = LABEL_WIDTH + layout.totalWidth / 2;
    if (labelPlacement === "center") {
      svg.appendChild(createTextNode(ctx, bandCenterX, cursorY, `▲ ${bandBuccal} ▲`, "middle"));
    } else {
      svg.appendChild(createTextNode(ctx, 4, cursorY, `▲ ${bandBuccal}`, "start"));
      svg.appendChild(createTextNode(ctx, LABEL_WIDTH + layout.totalWidth, cursorY, `${bandLingual} ▼`, "end"));
    }
    cursorY += ctx.rowHeight;

    // --- Central perio index band: Plaque -> PI -> GI -> mPI -> mBI ---
    if (visible.plaque) {
      if (
        appendSurfaceRow(ctx, svg, cursorY, indexName("plaque"), layout, (n, surface) =>
          getToothPlaque(n).includes(surface) ? "•" : null
        )
      )
        cursorY += ctx.rowHeight;
    }
    if (visible.pi) {
      if (
        appendSurfaceRow(ctx, svg, cursorY, indexName("pi"), layout, (n, surface) => {
          const g = getPlaqueIndex(n, surface);
          return g > 0 ? GRADE_FACE[g] ?? String(g) : null;
        })
      )
        cursorY += ctx.rowHeight;
    }
    if (visible.gi) {
      if (
        appendSurfaceRow(ctx, svg, cursorY, indexName("gi"), layout, (n, surface) => {
          const g = getGingivalIndex(n, surface);
          return g > 0 ? GRADE_FACE[g] ?? String(g) : null;
        })
      )
        cursorY += ctx.rowHeight;
    }
    if (labelPlacement === "center") {
      svg.appendChild(createTextNode(ctx, bandCenterX, cursorY, `▼ ${bandLingual} ▼`, "middle"));
      cursorY += ctx.rowHeight;
    }
    if (visible.mpi && archHasImplant) {
      if (
        appendSurfaceRow(ctx, svg, cursorY, indexName("mpi"), layout, (n, surface) => {
          const g = getPeriImplantPlaque(n, surface);
          return g > 0 ? GRADE_FACE[g] ?? String(g) : null;
        })
      )
        cursorY += ctx.rowHeight;
    }
    if (visible.mbi && archHasImplant) {
      if (
        appendSurfaceRow(ctx, svg, cursorY, indexName("mbi"), layout, (n, surface) => {
          const g = getPeriImplantBleeding(n, surface);
          return g > 0 ? GRADE_FACE[g] ?? String(g) : null;
        })
      )
        cursorY += ctx.rowHeight;
    }

    // --- PALATAL tooth-row graphic + curve overlay ---
    cursorY += appendArchGraphic(svg, cache, teeth, layout, cursorY, "palatal", toothGap);

    // --- Palatal-aspect rows (PD, GM, CAL, BOP) ---
    if (visible.pd) {
      if (
        appendSiteRow(ctx, svg, cursorY, `${lingualLabel} ${indexName("pd")}`, layout, LINGUAL_SITES, (n, site) => {
          const perio = getToothPerio(n);
          const charted = Object.prototype.hasOwnProperty.call(perio.pd, site);
          return charted ? String(perio.pd[site]) : null;
        })
      )
        cursorY += ctx.rowHeight;
    }
    if (visible.gm) {
      if (
        appendSiteRow(ctx, svg, cursorY, `${lingualLabel} ${indexName("gm")}`, layout, LINGUAL_SITES, (n, site) => {
          const perio = getToothPerio(n);
          const charted = Object.prototype.hasOwnProperty.call(perio.pd, site);
          if (!charted || !Object.prototype.hasOwnProperty.call(perio.gm, site)) return null;
          return String(perio.gm[site]);
        })
      )
        cursorY += ctx.rowHeight;
    }
    if (visible.cal) {
      if (
        appendSiteRow(ctx, svg, cursorY, `${lingualLabel} ${indexName("cal")}`, layout, LINGUAL_SITES, (n, site) => {
          const v = getToothCal(n).get(site);
          return v === undefined ? null : String(v);
        })
      )
        cursorY += ctx.rowHeight;
    }
    if (visible.bop) {
      if (
        appendSiteRow(ctx, svg, cursorY, `${lingualLabel} ${indexName("bop")}`, layout, LINGUAL_SITES, (n, site) => {
          const perio = getToothPerio(n);
          const charted = Object.prototype.hasOwnProperty.call(perio.pd, site);
          return charted && perio.bop.includes(site) ? "•" : null;
        })
      )
        cursorY += ctx.rowHeight;
    }

    // --- Foot rows: Mobility, CEJ, root concavity, KG, GT ---
    if (visible.mobility) {
      if (
        appendSingleRow(ctx, svg, cursorY, indexName("mobility"), layout, (n) => {
          const v = getToothMobility(n);
          return v === "none" ? null : MOBILITY_FACE[v] ?? v;
        })
      )
        cursorY += ctx.rowHeight;
    }
    if (visible.cej) {
      if (
        appendSingleRow(ctx, svg, cursorY, indexName("cej"), layout, (n) => {
          const v = getCejVisibility(n);
          return v === "none" ? null : CEJ_FACE[v] ?? v;
        })
      )
        cursorY += ctx.rowHeight;
    }
    if (visible.rootConcavity) {
      if (
        appendSingleRow(ctx, svg, cursorY, indexName("rootConcavity"), layout, (n) => {
          const v = getRootConcavity(n);
          return v === "none" ? null : ROOT_CONCAVITY_FACE[v] ?? v;
        })
      )
        cursorY += ctx.rowHeight;
    }
    if (visible.kg) {
      if (
        appendSingleRow(ctx, svg, cursorY, indexName("kg"), layout, (n) => {
          const mm = getKeratinizedWidth(n);
          return mm === null ? null : String(mm);
        })
      )
        cursorY += ctx.rowHeight;
    }
    if (visible.gt) {
      if (
        appendSingleRow(ctx, svg, cursorY, indexName("gt"), layout, (n) => {
          const v = getGingivalThickness(n);
          return v === "unknown" ? null : GT_FACE[v] ?? v;
        })
      )
        cursorY += ctx.rowHeight;
    }

    // Vertical column separators
    const sep = (x: number) => {
      const ln = document.createElementNS(SVG_NS, "line");
      ln.setAttribute("class", "perio-col-sep");
      ln.setAttribute("x1", fmt(x));
      ln.setAttribute("y1", fmt(archStartY));
      ln.setAttribute("x2", fmt(x));
      ln.setAttribute("y2", fmt(cursorY));
      bgLayer.appendChild(ln);
    };
    for (const tooth of layout.teeth) sep(LABEL_WIDTH + tooth.x);
    sep(LABEL_WIDTH + layout.totalWidth);

    cursorY += SECTION_GAP;
  };

  buildOneArch(UPPER_ARCH);
  buildOneArch(LOWER_ARCH);

  // Alternating row stripes
  ctx.stripeBands.forEach((b, i) => {
    if (i % 2 === 0) return;
    const r = document.createElementNS(SVG_NS, "rect");
    r.setAttribute("class", "perio-row-stripe");
    r.setAttribute("x", "0");
    r.setAttribute("y", fmt(b.y - ctx.rowHeight * 0.72));
    r.setAttribute("width", fmt(b.w));
    r.setAttribute("height", fmt(ctx.rowHeight));
    bgLayer.appendChild(r);
  });

  const width = maxWidth;
  const height = cursorY;
  svg.setAttribute("viewBox", `0 0 ${fmt(width)} ${fmt(height)}`);
  svg.setAttribute("width", fmt(width));
  svg.setAttribute("height", fmt(height));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`;
  return { xml, width, height };
}
