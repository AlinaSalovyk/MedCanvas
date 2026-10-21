import { type ArchLayout } from "@/perioGraphic";
import { type PerioSite, furcationEntrances } from "@/state/payload";
import { getToothFurcation, isPerioRowHidden } from "@/state/perio";
import {
  SVG_NS,
  LABEL_WIDTH,
  PLAQUE_SURFACES,
  SURFACE_LETTER,
  FURCATION_ROMAN,
  type PerioExportContext,
  fmt,
} from "./constants";

export function createTextNode(
  ctx: PerioExportContext,
  x: number,
  y: number,
  content: string,
  anchor: "start" | "middle" | "end" = "middle"
): SVGTextElement {
  const el = document.createElementNS(SVG_NS, "text") as unknown as SVGTextElement;
  el.setAttribute("x", fmt(x));
  el.setAttribute("y", fmt(y));
  el.setAttribute("font-size", String(ctx.rowFontSize));
  el.setAttribute("text-anchor", anchor);
  el.textContent = content;
  return el;
}

export function appendRowLabel(ctx: PerioExportContext, root: Element, y: number, label: string): void {
  if (!label) return;
  root.appendChild(createTextNode(ctx, 4, y, label, "start"));
}

/** Append one site-subdivided row (PD/GM/CAL/BOP) — up to 3 sub-columns per tooth. */
export function appendSiteRow(
  ctx: PerioExportContext,
  root: Element,
  y: number,
  label: string,
  layout: ArchLayout,
  sites: readonly PerioSite[],
  valueFor: (toothNo: number, site: PerioSite) => string | null
): boolean {
  const items: { x: number; v: string }[] = [];
  for (const tooth of layout.teeth) {
    sites.forEach((site, j) => {
      const v = valueFor(tooth.toothNo, site);
      if (v === null) return;
      items.push({ x: LABEL_WIDTH + tooth.x + (tooth.width * (j + 0.5)) / sites.length, v });
    });
  }
  if (ctx.skipEmptyRows && items.length === 0) return false;
  ctx.stripeBands.push({ y, w: LABEL_WIDTH + layout.totalWidth });
  appendRowLabel(ctx, root, y, label);
  for (const it of items) root.appendChild(createTextNode(ctx, it.x, y, it.v));
  return true;
}

/** Append one 4-surface diamond row (Plaque/PI/GI/mPI/mBI). */
export function appendSurfaceRow(
  ctx: PerioExportContext,
  root: Element,
  y: number,
  label: string,
  layout: ArchLayout,
  valueFor: (toothNo: number, surface: string) => string | null
): boolean {
  const items: { x: number; v: string }[] = [];
  const guides: { x: number; letter: string }[] = [];
  for (const tooth of layout.teeth) {
    PLAQUE_SURFACES.forEach((surface, j) => {
      const x = LABEL_WIDTH + tooth.x + (tooth.width * (j + 0.5)) / PLAQUE_SURFACES.length;
      guides.push({ x, letter: SURFACE_LETTER[surface] ?? "" });
      const v = valueFor(tooth.toothNo, surface);
      if (v !== null) items.push({ x, v });
    });
  }
  if (ctx.skipEmptyRows && items.length === 0) return false;
  ctx.stripeBands.push({ y, w: LABEL_WIDTH + layout.totalWidth });
  appendRowLabel(ctx, root, y, label);
  for (const g of guides) {
    const el = createTextNode(ctx, g.x, y, g.letter);
    el.setAttribute("class", "perio-surface-letter");
    root.appendChild(el);
  }
  for (const it of items) root.appendChild(createTextNode(ctx, it.x, y, it.v));
  return true;
}

/** Append one single-value-per-tooth row (Miller/mobility/CEJ/root concavity/KG/GT). */
export function appendSingleRow(
  ctx: PerioExportContext,
  root: Element,
  y: number,
  label: string,
  layout: ArchLayout,
  valueFor: (toothNo: number) => string | null
): boolean {
  const items: { x: number; v: string }[] = [];
  for (const tooth of layout.teeth) {
    const v = valueFor(tooth.toothNo);
    if (v === null) continue;
    items.push({ x: LABEL_WIDTH + tooth.x + tooth.width / 2, v });
  }
  if (ctx.skipEmptyRows && items.length === 0) return false;
  ctx.stripeBands.push({ y, w: LABEL_WIDTH + layout.totalWidth });
  appendRowLabel(ctx, root, y, label);
  for (const it of items) root.appendChild(createTextNode(ctx, it.x, y, it.v));
  return true;
}

/** Append the furcation row. */
export function appendFurcationRow(
  ctx: PerioExportContext,
  root: Element,
  y: number,
  label: string,
  layout: ArchLayout
): boolean {
  const items: { x: number; v: string }[] = [];
  for (const tooth of layout.teeth) {
    const entrances = furcationEntrances(tooth.toothNo);
    if (entrances.length === 0 || isPerioRowHidden(tooth.toothNo)) continue;
    const furc = getToothFurcation(tooth.toothNo);
    entrances.forEach((entrance, j) => {
      const grade = furc[entrance] ?? 0;
      items.push({ x: LABEL_WIDTH + tooth.x + (tooth.width * (j + 0.5)) / entrances.length, v: FURCATION_ROMAN[grade] ?? "–" });
    });
  }
  if (ctx.skipEmptyRows && items.length === 0) return false;
  ctx.stripeBands.push({ y, w: LABEL_WIDTH + layout.totalWidth });
  appendRowLabel(ctx, root, y, label);
  for (const it of items) root.appendChild(createTextNode(ctx, it.x, y, it.v));
  return true;
}
