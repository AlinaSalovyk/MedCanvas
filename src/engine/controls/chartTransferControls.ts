/**
 * Chart Import/Export Controls Controller
 *
 * Owns DOM event binding and format state for:
 * - Status JSON export (btnStatusExport)
 * - FHIR Bundle export (btnStatusFhirExport)
 * - Raster & SVG export (btnStatusPngExport, btnStatusJpgExport, btnStatusSvgExport)
 * - Perio image & SVG export (btnPerioSvgExport, btnPerioPngExport, btnPerioJpgExport)
 * - Status / FHIR file import trigger and file input change handling (btnStatusImport, statusImportInput)
 * - Pending import format state ("status" | "fhir") and setter
 *
 * Extracted from `src/odontogram.ts` (Stage 27).
 *
 * STRICT MODULE BOUNDARY:
 * - Must NEVER import from "@/odontogram".
 */

import { $ } from "@/engine/domHelpers";
import { exportStatus, exportFhir } from "@/engine/exportPayload";
import {
  exportSvg,
  exportImage,
  exportPerioSvg,
  exportPerioImage,
} from "@/engine/exportRasterPdf";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let pendingImportFormat: "status" | "fhir" = "status";

/**
 * Returns current pending import format (useful for testing and state verification).
 */
export function getPendingImportFormat(): "status" | "fhir" {
  return pendingImportFormat;
}

/**
 * Set which parser the next file import uses. Defaults back to "status" after each import.
 */
export function setImportFormat(format: "status" | "fhir"): void {
  pendingImportFormat = format === "fhir" ? "fhir" : "status";
}

export interface ChartTransferControlsDeps {
  importStatus: (data: Any) => void;
  importFhirBundle: (input: Any) => void;
  exportStatus?: () => void;
  exportFhir?: () => void;
  exportImage?: (format: "png" | "jpg") => Promise<void>;
  exportSvg?: () => Promise<void>;
  exportPerioImage?: (format: "png" | "jpg") => Promise<void>;
  exportPerioSvg?: () => Promise<void>;
}

/**
 * Binds DOM event handlers for chart import and export buttons.
 * Uses direct property assignment (.onclick, .onchange) to match existing coordinator semantics
 * and avoid accumulating duplicate listeners across repeated wireControls calls.
 */
export function bindChartTransferControls(deps: ChartTransferControlsDeps): void {
  const doExportStatus = deps.exportStatus ?? exportStatus;
  const doExportFhir = deps.exportFhir ?? exportFhir;
  const doExportImage = deps.exportImage ?? exportImage;
  const doExportSvg = deps.exportSvg ?? exportSvg;
  const doExportPerioSvg = deps.exportPerioSvg ?? exportPerioSvg;
  const doExportPerioImage = deps.exportPerioImage ?? exportPerioImage;

  const exportBtn = $("#btnStatusExport") as HTMLButtonElement | null;
  const fhirBtn = $("#btnStatusFhirExport") as HTMLButtonElement | null;
  const importBtn = $("#btnStatusImport") as HTMLButtonElement | null;
  const importInput = $("#statusImportInput") as HTMLInputElement | null;

  if (exportBtn) {
    exportBtn.onclick = () => doExportStatus();
  }
  if (fhirBtn) {
    fhirBtn.onclick = () => doExportFhir();
  }

  const pngBtn = $("#btnStatusPngExport") as HTMLButtonElement | null;
  const jpgBtn = $("#btnStatusJpgExport") as HTMLButtonElement | null;
  const svgBtn = $("#btnStatusSvgExport") as HTMLButtonElement | null;

  if (pngBtn) {
    pngBtn.onclick = () => {
      doExportImage("png").catch((e) => console.error("PNG export failed", e));
    };
  }
  if (jpgBtn) {
    jpgBtn.onclick = () => {
      doExportImage("jpg").catch((e) => console.error("JPG export failed", e));
    };
  }
  if (svgBtn) {
    svgBtn.onclick = () => {
      doExportSvg().catch((e) => console.error("SVG export failed", e));
    };
  }

  const perioSvgBtn = $("#btnPerioSvgExport") as HTMLButtonElement | null;
  const perioPngBtn = $("#btnPerioPngExport") as HTMLButtonElement | null;
  const perioJpgBtn = $("#btnPerioJpgExport") as HTMLButtonElement | null;

  if (perioSvgBtn) {
    perioSvgBtn.onclick = () => {
      doExportPerioSvg().catch((e) => console.error("Perio SVG export failed", e));
    };
  }
  if (perioPngBtn) {
    perioPngBtn.onclick = () => {
      doExportPerioImage("png").catch((e) => console.error("Perio PNG export failed", e));
    };
  }
  if (perioJpgBtn) {
    perioJpgBtn.onclick = () => {
      doExportPerioImage("jpg").catch((e) => console.error("Perio JPG export failed", e));
    };
  }

  if (importBtn && importInput) {
    importBtn.onclick = () => {
      importInput.value = "";
      importInput.click();
    };
    importInput.onchange = async () => {
      const file = importInput.files?.[0];
      if (!file) return;
      const format = pendingImportFormat;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (format === "fhir") {
          deps.importFhirBundle(data);
        } else {
          deps.importStatus(data);
        }
      } catch (e) {
        console.error("Odontogram import failed", e);
      } finally {
        importInput.value = "";
        pendingImportFormat = "status";
      }
    };
  }
}
