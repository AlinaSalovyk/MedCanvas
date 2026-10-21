import { toothState } from "@/state/chart";
import {
  detectBridgeSpans,
  computeBridgeBars,
  barRect,
  tileRectFor,
  defaultMaterialColor,
  type BridgeToothState,
} from "@/bridgeOverlay";
import { buildPerioSvg } from "@/perioExport";
import { PDF_PALETTES } from "@/perioPdf";
import { SVG_NS } from "@/engine/constants";
import {
  getPdfSettings,
  TOOTH_NUMBER_SCALE,
  ODONTO_PACK,
  PDF_BORDER_WIDTH_PX,
  PERIO_FONT_SIZE,
  PERIO_SPACING_GAP,
} from "@/engine/pdfSettings";
import { showBase, showHealthyPulp } from "@/engine/displayGlobals";

let toggleShowBaseHandler: ((on: boolean) => void) | null = null;
let toggleHealthyPulpHandler: ((on: boolean) => void) | null = null;

export function setExportViewToggleHandlers(
  onShowBase: (on: boolean) => void,
  onHealthyPulp: (on: boolean) => void,
): void {
  toggleShowBaseHandler = onShowBase;
  toggleHealthyPulpHandler = onHealthyPulp;
}

function bridgeStateFor(toothNo: number): BridgeToothState | undefined {
  return toothState.get(toothNo) as BridgeToothState | undefined;
}

/**
 * Prune a cloned SVG subtree to match what is actually visible on screen.
 */
export function pruneHiddenClone(original: Element, clone: Element): void {
  const oChildren = Array.from(original.children);
  const cChildren = Array.from(clone.children);
  for(let i = 0; i < oChildren.length; i++){
    const o = oChildren[i];
    const c = cChildren[i];
    if(!c) continue;
    const cs = window.getComputedStyle(o);
    const hiddenByOpacity = cs.opacity !== "" && Number(cs.opacity) === 0;
    if(cs.display === "none" || cs.visibility === "hidden" || hiddenByOpacity){
      c.remove();
    }else{
      pruneHiddenClone(o, c);
    }
  }
}

/**
 * Prefix every id and id-reference inside a cloned subtree so that combining
 * many tiles into one SVG document does not cause id collisions.
 */
export function namespaceIds(root: Element, prefix: string): void {
  const fixUrl = (v: string) => v.replace(/url\(#([^)]+)\)/g, (_m, id) => `url(#${prefix}${id})`);
  const refAttrs = ["fill","stroke","clip-path","mask","filter"];
  root.querySelectorAll("[id]").forEach((e) => {
    const oldId = e.getAttribute("id");
    if(oldId) e.setAttribute("id", prefix + oldId);
  });
  const nodes: Element[] = [root, ...Array.from(root.querySelectorAll("*"))];
  for(const e of nodes){
    for(const a of refAttrs){
      const v = e.getAttribute(a);
      if(v && v.includes("url(#")) e.setAttribute(a, fixUrl(v));
    }
    const style = e.getAttribute("style");
    if(style && style.includes("url(#")) e.setAttribute("style", fixUrl(style));
    const href = e.getAttribute("href") ?? e.getAttributeNS("http://www.w3.org/1999/xlink", "href");
    if(href && href.startsWith("#")){
      e.setAttribute("href", "#" + prefix + href.slice(1));
      e.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
    }
  }
}

/**
 * Serialize the on-screen odontogram tooth grid into a single, self-contained
 * SVG string (vector, no rasterization).
 */
export function buildOdontogramSvg(opts: { labelFontScale?: number; packFactor?: number } = {}): { xml: string; width: number; height: number } | null {
  const grid = document.querySelector("#toothGrid, .tooth-grid") as HTMLElement | null;
  if(!grid) return null;
  const displayRestores: Array<() => void> = [];
  for(let el: HTMLElement | null = grid; el; el = el.parentElement){
    if(el.style.display === "none"){
      const target = el;
      const prev = target.style.display;
      target.style.display = "";
      displayRestores.push(() => { target.style.display = prev; });
    }
  }
  try{
    return buildOdontogramSvgMeasured(grid, opts);
  }finally{
    for(const restore of displayRestores) restore();
  }
}

/**
 * The measurement + serialization body of buildOdontogramSvg.
 */
export function buildOdontogramSvgMeasured(grid: HTMLElement, opts: { labelFontScale?: number; packFactor?: number } = {}): { xml: string; width: number; height: number } | null {
  const gridRect = grid.getBoundingClientRect();
  const W = Math.max(1, Math.round(gridRect.width));
  const H = Math.max(1, Math.round(gridRect.height));

  const out = document.createElementNS(SVG_NS, "svg");
  out.setAttribute("xmlns", SVG_NS);
  out.setAttribute("width", String(W));
  out.setAttribute("height", String(H));
  out.setAttribute("viewBox", `0 0 ${W} ${H}`);

  const bg = document.createElementNS(SVG_NS, "rect");
  bg.setAttribute("x", "0"); bg.setAttribute("y", "0");
  bg.setAttribute("width", String(W)); bg.setAttribute("height", String(H));
  bg.setAttribute("fill", "#ffffff");
  out.appendChild(bg);

  const pack = opts.packFactor ?? 1;
  let packedRight = 0;

  let tileIndex = 0;
  grid.querySelectorAll(".tooth-svg > svg").forEach((svgEl) => {
    const r = svgEl.getBoundingClientRect();
    if(r.width === 0 || r.height === 0) return;
    const clone = svgEl.cloneNode(true) as Element;
    pruneHiddenClone(svgEl, clone);
    namespaceIds(clone, `t${tileIndex++}-`);
    const wrap = document.createElementNS(SVG_NS, "svg");
    const px = (r.left - gridRect.left) * pack;
    packedRight = Math.max(packedRight, px + r.width);
    wrap.setAttribute("x", String(px));
    wrap.setAttribute("y", String(r.top - gridRect.top));
    wrap.setAttribute("width", String(r.width));
    wrap.setAttribute("height", String(r.height));
    const vb = svgEl.getAttribute("viewBox");
    if(vb) wrap.setAttribute("viewBox", vb);
    wrap.setAttribute("preserveAspectRatio", "xMidYMid meet");
    while(clone.firstChild) wrap.appendChild(clone.firstChild);
    out.appendChild(wrap);
  });

  const bridgeSpans = detectBridgeSpans(bridgeStateFor);
  if(bridgeSpans.length){
    const rectFor = (toothNo: number) => tileRectFor(grid, gridRect, toothNo);
    const bars = computeBridgeBars(bridgeSpans, bridgeStateFor, rectFor, defaultMaterialColor);
    for(const bar of bars) out.appendChild(barRect(pack === 1 ? bar : { ...bar, x: bar.x * pack, width: bar.width * pack }));
  }

  grid.querySelectorAll(".tooth-label-cell").forEach((cell) => {
    const text = (cell.textContent || "").trim();
    if(!text) return;
    const r = cell.getBoundingClientRect();
    if(r.width === 0 || r.height === 0) return;
    const cs = window.getComputedStyle(cell);
    const txt = document.createElementNS(SVG_NS, "text");
    const lx = (r.left - gridRect.left) * pack + r.width / 2;
    packedRight = Math.max(packedRight, lx + r.width / 2);
    txt.setAttribute("x", String(lx));
    txt.setAttribute("y", String(r.top - gridRect.top + r.height / 2));
    txt.setAttribute("text-anchor", "middle");
    txt.setAttribute("dominant-baseline", "central");
    txt.setAttribute("font-family", cs.fontFamily);
    const baseFs = parseFloat(cs.fontSize) || 12;
    txt.setAttribute("font-size", `${baseFs * (opts.labelFontScale ?? 1)}px`);
    txt.setAttribute("font-weight", cs.fontWeight);
    txt.setAttribute("fill", cs.color);
    txt.textContent = text;
    out.appendChild(txt);
  });

  const outW = pack < 1 ? Math.max(1, Math.ceil(packedRight)) : W;
  if(outW !== W){
    out.setAttribute("width", String(outW));
    out.setAttribute("viewBox", `0 0 ${outW} ${H}`);
    bg.setAttribute("width", String(outW));
  }

  const xml = new XMLSerializer().serializeToString(out);
  return { xml: `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`, width: outW, height: H };
}

/**
 * Build the odontogram export SVG with current Export Settings applied.
 */
export function buildOdontogramSvgForExport(withBorder: boolean): { xml: string; width: number; height: number } | null {
  const settings = getPdfSettings();
  const prevBase = showBase, prevPulp = showHealthyPulp;
  if(settings.showBone !== showBase) toggleShowBaseHandler?.(settings.showBone);
  if(settings.showHealthyPulp !== showHealthyPulp) toggleHealthyPulpHandler?.(settings.showHealthyPulp);
  let built: { xml: string; width: number; height: number } | null;
  try{
    built = buildOdontogramSvg({
      labelFontScale: TOOTH_NUMBER_SCALE[settings.toothNumberSize],
      packFactor: ODONTO_PACK[settings.toothSpacing],
    });
  }finally{
    if(showBase !== prevBase) toggleShowBaseHandler?.(prevBase);
    if(showHealthyPulp !== prevPulp) toggleHealthyPulpHandler?.(prevPulp);
  }
  if(built && withBorder && settings.border){
    const w = PDF_BORDER_WIDTH_PX[settings.borderThickness];
    const [r, g, b] = PDF_PALETTES[settings.colorTheme].header;
    const inset = w / 2;
    const rect = `<rect x="${inset}" y="${inset}" width="${built.width - w}" height="${built.height - w}" fill="none" stroke="rgb(${r},${g},${b})" stroke-width="${w}"/>`;
    built = { ...built, xml: built.xml.replace("</svg>", `${rect}</svg>`) };
  }
  return built;
}

/**
 * Build the perio export SVG with the current Export Settings applied.
 */
export function buildPerioSvgForExport(): Promise<{ xml: string; width: number; height: number } | null> {
  const settings = getPdfSettings();
  const pf = PERIO_FONT_SIZE[settings.perioFontSize];
  return buildPerioSvg({
    fontSize: pf.fontSize,
    rowHeight: pf.rowHeight,
    toothGap: PERIO_SPACING_GAP[settings.perioToothSpacing],
    showEmptyRows: settings.perioShowEmptyRows,
    labelPlacement: settings.perioLabelPlacement,
  });
}
