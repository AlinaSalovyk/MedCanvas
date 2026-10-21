import { t, getI18nLanguage } from "@/i18n/useI18n";
import { formatToothLabel } from "@/state/numbering";
import { ALL_TEETH } from "@/anatomy/profiles";
import { getCaseMeta } from "@/state/caseMeta";
import {
  hasAnyPerioData,
  getPerioSummary,
  getPerioClassification,
  getKeratinizedWidth,
  getCejVisibility,
  getRootConcavity,
  getToothMobility,
} from "@/state/perio";
import {
  getPdfSettings,
  formatPdfDate,
  pdfPatientRows,
  PDF_BORDER_WIDTH_MM,
} from "@/engine/pdfSettings";
import { getOdontogramSummary } from "@/engine/summary";
import {
  buildOdontogramSvgForExport,
  buildPerioSvgForExport,
} from "@/engine/exportSvg";
import {
  assemblePdf,
  PDF_PALETTES,
  type PdfExportOptions,
  type PdfAssembleData,
  type PdfDocLike,
} from "@/perioPdf";
import { el } from "@/engine/domHelpers";

declare const __APP_VERSION__: string;

let exportOverlayEl: HTMLElement | null = null;
let exportInProgress = false;

function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function showExportOverlay(): void {
  if(exportOverlayEl) return;
  const card = el("div", { class: "odon-export-card" }, [
    el("div", { class: "odon-export-title", text: t("export.progress.title") }),
    el("div", { class: "odon-export-pct", id: "odonExportPct", text: "0%" }),
    el("div", { class: "odon-export-phase", id: "odonExportPhase", text: t("export.progress.preparing") }),
  ]);
  exportOverlayEl = el("div", { class: "odon-export-overlay", role: "status", "aria-live": "polite" }, [card]);
  document.body.appendChild(exportOverlayEl);
}

function setExportProgress(pct: number, phaseKey: string): void {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const pctEl = exportOverlayEl?.querySelector("#odonExportPct");
  const phaseEl = exportOverlayEl?.querySelector("#odonExportPhase");
  if(pctEl) pctEl.textContent = `${p}%`;
  if(phaseEl) phaseEl.textContent = t(phaseKey);
}

function hideExportOverlay(): void {
  if(exportOverlayEl){ exportOverlayEl.remove(); exportOverlayEl = null; }
}

/**
 * Shared SVG→raster core — loads a serialized SVG into an off-screen canvas at scale×.
 */
export async function rasterizeSvgToCanvas(xml: string, width: number, height: number, scale = 2): Promise<HTMLCanvasElement> {
  const svgUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("SVG rasterization failed"));
    img.src = svgUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if(!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * SVG → PNG data URL, built on rasterizeSvgToCanvas.
 */
export async function rasterizeSvgToPng(xml: string, width: number, height: number, scale = 2): Promise<string> {
  const canvas = await rasterizeSvgToCanvas(xml, width, height, scale);
  return canvas.toDataURL("image/png");
}

/**
 * Export the odontogram as a downloadable, scalable SVG file.
 */
export async function exportSvg(): Promise<void> {
  if(exportInProgress) return;
  exportInProgress = true;
  showExportOverlay();
  setExportProgress(30, "export.progress.preparing");
  try{
    const built = buildOdontogramSvgForExport(true);
    if(!built) throw new Error("Odontogram grid not found");
    setExportProgress(90, "export.progress.encoding");
    const blob = new Blob([built.xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g, "-");
    const a = document.createElement("a");
    a.href = url;
    a.download = `odontogram-${stamp}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setExportProgress(100, "export.progress.done");
    await new Promise((r) => window.setTimeout(r, 300));
  }finally{
    hideExportOverlay();
    exportInProgress = false;
  }
}

/**
 * Export the odontogram as PNG or JPG.
 */
export async function exportImage(format: "png" | "jpg" = "png"): Promise<void> {
  if(exportInProgress) return;
  exportInProgress = true;
  showExportOverlay();
  setExportProgress(10, "export.progress.preparing");
  try{
    const built = buildOdontogramSvgForExport(true);
    if(!built) throw new Error("Odontogram grid not found");
    setExportProgress(40, "export.progress.rendering");
    const canvas = await rasterizeSvgToCanvas(built.xml, built.width, built.height);
    setExportProgress(90, "export.progress.encoding");
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g, "-");
    if(format === "jpg"){
      downloadDataUrl(canvas.toDataURL("image/jpeg", 0.92), `odontogram-${stamp}.jpg`);
    }else{
      downloadDataUrl(canvas.toDataURL("image/png"), `odontogram-${stamp}.png`);
    }
    setExportProgress(100, "export.progress.done");
    await new Promise((r) => window.setTimeout(r, 300));
  }finally{
    hideExportOverlay();
    exportInProgress = false;
  }
}

/**
 * Export the full perio chart as a standalone vector SVG file.
 */
export async function exportPerioSvg(): Promise<void> {
  if(exportInProgress) return;
  exportInProgress = true;
  showExportOverlay();
  setExportProgress(10, "export.progress.preparing");
  try{
    const built = await buildPerioSvgForExport();
    if(!built) throw new Error("Perio chart could not be built");
    const blob = new Blob([built.xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g, "-");
    const a = document.createElement("a");
    a.href = url; a.download = `perio-${stamp}.svg`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setExportProgress(100, "export.progress.done");
    await new Promise((r) => window.setTimeout(r, 200));
  }finally{ hideExportOverlay(); exportInProgress = false; }
}

/**
 * Export the full perio chart as PNG/JPG.
 */
export async function exportPerioImage(format: "png" | "jpg" = "png"): Promise<void> {
  if(exportInProgress) return;
  exportInProgress = true;
  showExportOverlay();
  setExportProgress(10, "export.progress.preparing");
  try{
    const built = await buildPerioSvgForExport();
    if(!built) throw new Error("Perio chart could not be built");
    setExportProgress(40, "export.progress.rendering");
    const canvas = await rasterizeSvgToCanvas(built.xml, built.width, built.height);
    setExportProgress(90, "export.progress.encoding");
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g, "-");
    if(format === "jpg") downloadDataUrl(canvas.toDataURL("image/jpeg", 0.92), `perio-${stamp}.jpg`);
    else downloadDataUrl(canvas.toDataURL("image/png"), `perio-${stamp}.png`);
    setExportProgress(100, "export.progress.done");
    await new Promise((r) => window.setTimeout(r, 300));
  }finally{ hideExportOverlay(); exportInProgress = false; }
}

/**
 * Generate periodontal abbreviation glossary list.
 */
export function buildPerioAbbreviations(): { term: string; desc: string }[] {
  const sum = getPerioSummary();
  const anyTooth = (fn: (n: number) => boolean) => ALL_TEETH.some(fn);
  const out: { term: string; desc: string }[] = [];
  const gt = sum.gtDistribution, ml = sum.millerDistribution;
  if(sum.plaquePercent > 0) out.push({ term: "Plaque", desc: t("perio.info.plaque") });
  if(sum.piScore !== null) out.push({ term: "PI", desc: t("perio.info.pi") });
  if(sum.giScore !== null) out.push({ term: "GI", desc: t("perio.info.gi") });
  if(sum.mpiScore !== null) out.push({ term: "mPI", desc: t("perio.info.mpi") });
  if(sum.mbiScore !== null) out.push({ term: "mBI", desc: t("perio.info.mbi") });
  if(anyTooth((n) => getKeratinizedWidth(n) !== null)) out.push({ term: "KG", desc: t("perio.info.kg") });
  if(gt.thin + gt.medium + gt.thick > 0){
    out.push({ term: "GT (Tn/Md/Tk)", desc: `${t("perio.info.gt")} — Tn: ${t("perio.gt.thin")}, Md: ${t("perio.gt.medium")}, Tk: ${t("perio.gt.thick")}` });
  }
  if(anyTooth((n) => getCejVisibility(n) !== "none")){
    out.push({ term: "CEJ (D/ND)", desc: `${t("perio.info.cej")} — D: ${t("perio.cej.detectable")}, ND: ${t("perio.cej.notDetectable")}` });
  }
  if(anyTooth((n) => getRootConcavity(n) !== "none")){
    out.push({ term: "Mi / Dp", desc: `${t("perio.info.rootConcavity")} — Mi: ${t("perio.rootConcavity.mild")}, Dp: ${t("perio.rootConcavity.deep")}` });
  }
  if(sum.maxFurcation !== null) out.push({ term: "Furcation (I–IV)", desc: t("perio.info.furcation") });
  if(ml.i + ml.ii + ml.iii + ml.iv > 0) out.push({ term: "Miller (I–IV)", desc: t("perio.info.miller") });
  if(anyTooth((n) => getToothMobility(n) !== "none")) out.push({ term: "Mobility (1–3)", desc: t("perio.info.mobility") });
  return out;
}

/**
 * Test seam for buildPerioAbbreviations.
 */
export function __buildPerioAbbreviationsForTest(): { term: string; desc: string }[] {
  return buildPerioAbbreviations();
}

/**
 * Export the complete clinical report as a downloadable PDF document.
 */
export async function exportPdf(opts: PdfExportOptions): Promise<void> {
  if(exportInProgress) return;
  exportInProgress = true;
  showExportOverlay();
  setExportProgress(10, "export.progress.preparing");
  try{
    const settings = getPdfSettings();
    let odontoBuilt: { xml: string; width: number; height: number } | null = null;
    if(opts.odontogramChart){
      odontoBuilt = buildOdontogramSvgForExport(false);
      if(!odontoBuilt) throw new Error("Odontogram grid not found");
    }
    setExportProgress(30, "export.progress.rendering");
    const odontogramPng = odontoBuilt
      ? await rasterizeSvgToPng(odontoBuilt.xml, odontoBuilt.width, odontoBuilt.height)
      : "";

    const hasPerio = hasAnyPerioData();
    const perioNeeded = hasPerio && (opts.perioStatus || opts.perioDescription);
    let perioPng = "";
    let perioImageSize: { width: number; height: number } | undefined;
    if(perioNeeded){
      setExportProgress(50, "export.progress.rendering");
      const perioBuilt = await buildPerioSvgForExport();
      if(!perioBuilt) throw new Error("Perio chart could not be built");
      perioPng = await rasterizeSvgToPng(perioBuilt.xml, perioBuilt.width, perioBuilt.height);
      perioImageSize = { width: perioBuilt.width, height: perioBuilt.height };
    }
    setExportProgress(80, "export.progress.encoding");

    const odontoSummary = getOdontogramSummary();
    const perioSum = getPerioSummary();

    const odontogramCaption = settings.includeOdontogramText ? odontoSummary.overview : "";
    const odontogramFindings: { label: string; value: string }[] = [];
    if(settings.includeOdontogramTable){
      for(const section of odontoSummary.sections){
        if(section.items.length) odontogramFindings.push({ label: section.heading, value: section.items.join(", ") });
      }
      if(!hasPerio && odontoSummary.periodontalHasFindings){
        odontogramFindings.push({ label: odontoSummary.periodontalTitle, value: odontoSummary.periodontalText });
      }
    }

    const individualNotes = (odontoSummary.individualNotes?.items ?? []).map((s) => {
      const idx = s.indexOf(": ");
      return idx > 0 ? { label: s.slice(0, idx), value: s.slice(idx + 2) } : { label: "", value: s };
    });

    const worstCalText = perioSum.worstCal === null
      ? "–"
      : `${perioSum.worstCal}${perioSum.worstCalTooth !== null ? ` (${formatToothLabel(perioSum.worstCalTooth)})` : ""}`;
    const cls = getPerioClassification();
    const dxLabel = (v: string) => t(`perio.class.dx.${v}`);
    const stageLabel = (v: string) =>
      v === "na" ? t("perio.class.stage.na") : v === "indeterminate" ? t("perio.class.stage.indeterminate") : t(`perio.class.stage.${v}`);
    const gradeLabel = (v: string) =>
      v === "indeterminate" ? t("perio.class.grade.indeterminate") : t(`perio.class.grade.${v}`);
    const extentLabel = (v: string) =>
      v === "na" ? t("perio.class.extent.na") : v === "molar-incisor" ? t("perio.class.extent.molarIncisor") : t(`perio.class.extent.${v}`);

    const perioMetrics = settings.includePerioTable ? [
      { label: t("perio.bopPercent"), value: `${perioSum.bopPercent}%` },
      { label: t("perio.summary.worstCal"), value: worstCalText },
      { label: t("perio.summary.maxPd"), value: perioSum.maxPd === null ? "–" : String(perioSum.maxPd) },
      { label: t("perio.class.diagnosis"), value: dxLabel(cls.diagnosis) },
      { label: t("perio.class.stage"), value: stageLabel(cls.stage) },
      { label: t("perio.class.grade"), value: gradeLabel(cls.grade) },
      { label: t("perio.class.extent"), value: extentLabel(cls.extent) },
    ] : [];

    const abbreviations = settings.includePerioAbbrev ? [
      ...t("pdf.footer.legend")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((part) => {
          const m = part.split(/\s[–-]\s/);
          return m.length >= 2 ? { term: m[0].trim(), desc: m.slice(1).join(" – ").trim() } : { term: "", desc: part };
        }),
      ...buildPerioAbbreviations(),
    ] : [];

    const palette = PDF_PALETTES[settings.colorTheme];
    const cm = getCaseMeta();
    const now = new Date();
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const todayIsoStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const patient = pdfPatientRows(cm, settings, todayIsoStr);

    const versionStr = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "";
    const genStamp = `${formatPdfDate(todayIsoStr, settings.dateFormat)} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    const footer = {
      disclaimer: settings.showDisclaimer ? (settings.disclaimerText.trim() || t("pdf.disclaimer")) : "",
      generated: settings.showGenerator ? t("pdf.generatedWith", { date: genStamp, app: "Advanced Odontogram", version: versionStr }) : "",
      repoUrl: "",
      doi: "",
    };

    const data: PdfAssembleData = {
      hasPerio,
      reportTitle: t("pdf.reportTitle"),
      footer,
      palette,
      patient,
      odontogramPng,
      odontogramCaption,
      toothTable: settings.includeOdontogramTable ? odontoSummary.toothTable : null,
      odontogramFindings,
      individualNotes,
      odontogramImageSize: odontoBuilt ? { width: odontoBuilt.width, height: odontoBuilt.height } : undefined,
      odontogramBorder: (settings.border && opts.odontogramChart)
        ? { widthMm: PDF_BORDER_WIDTH_MM[settings.borderThickness], color: palette.header }
        : null,
      perioPng,
      perioMetrics,
      perioImageSize,
      abbreviations,
    };

    const { jsPDF } = await import("jspdf");
    const { loadPdfFont } = await import("@/fonts/loader");
    const pdfFont = await loadPdfFont(getI18nLanguage());
    data.fontFamily = pdfFont.family;
    data.transformText = pdfFont.transform;
    data.shapeText = pdfFont.transform;
    assemblePdf(opts, data, () => {
      const d = new jsPDF() as unknown as PdfDocLike;
      pdfFont.register(d);
      return d;
    });
    setExportProgress(100, "export.progress.done");
    await new Promise((r) => window.setTimeout(r, 300));
  }finally{
    hideExportOverlay();
    exportInProgress = false;
  }
}
