import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import {
  bindChartTransferControls,
  setImportFormat,
  getPendingImportFormat,
  type ChartTransferControlsDeps,
} from "@/engine/controls/chartTransferControls";
import { setImportFormat as setImportFormatFromOdontogram } from "@/odontogram";

function setupTransferDOM(): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = `
    <button id="btnStatusExport">Export Status</button>
    <button id="btnStatusFhirExport">Export FHIR</button>
    <button id="btnStatusImport">Import</button>
    <input id="statusImportInput" type="file" />
    <button id="btnStatusPngExport">PNG</button>
    <button id="btnStatusJpgExport">JPG</button>
    <button id="btnStatusSvgExport">SVG</button>
    <button id="btnPerioSvgExport">Perio SVG</button>
    <button id="btnPerioPngExport">Perio PNG</button>
    <button id="btnPerioJpgExport">Perio JPG</button>
  `;
  document.body.appendChild(container);
  return container;
}

describe("chartTransferControls module", () => {
  let importStatusSpy: Mock<(data: unknown) => void>;
  let importFhirBundleSpy: Mock<(input: unknown) => void>;
  let exportStatusSpy: Mock<() => void>;
  let exportFhirSpy: Mock<() => void>;
  let exportImageSpy: Mock<(fmt: "png" | "jpg") => Promise<void>>;
  let exportSvgSpy: Mock<() => Promise<void>>;
  let exportPerioImageSpy: Mock<(fmt: "png" | "jpg") => Promise<void>>;
  let exportPerioSvgSpy: Mock<() => Promise<void>>;

  const makeDeps = (overrides?: Partial<ChartTransferControlsDeps>): ChartTransferControlsDeps => ({
    importStatus: importStatusSpy,
    importFhirBundle: importFhirBundleSpy,
    exportStatus: exportStatusSpy,
    exportFhir: exportFhirSpy,
    exportImage: exportImageSpy,
    exportSvg: exportSvgSpy,
    exportPerioImage: exportPerioImageSpy,
    exportPerioSvg: exportPerioSvgSpy,
    ...overrides,
  });

  beforeEach(() => {
    document.body.innerHTML = "";
    setupTransferDOM();
    setImportFormat("status");

    importStatusSpy = vi.fn();
    importFhirBundleSpy = vi.fn();
    exportStatusSpy = vi.fn();
    exportFhirSpy = vi.fn();
    exportImageSpy = vi.fn().mockResolvedValue(undefined);
    exportSvgSpy = vi.fn().mockResolvedValue(undefined);
    exportPerioImageSpy = vi.fn().mockResolvedValue(undefined);
    exportPerioSvgSpy = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    setImportFormat("status");
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Status JSON Export Button
  // ---------------------------------------------------------------------------
  it("btnStatusExport dispatches exportStatus", () => {
    bindChartTransferControls(makeDeps());
    const btn = document.getElementById("btnStatusExport") as HTMLButtonElement;
    btn.click();
    expect(exportStatusSpy).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 2. FHIR Export Button
  // ---------------------------------------------------------------------------
  it("btnStatusFhirExport dispatches exportFhir", () => {
    bindChartTransferControls(makeDeps());
    const btn = document.getElementById("btnStatusFhirExport") as HTMLButtonElement;
    btn.click();
    expect(exportFhirSpy).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 3. Raster PNG Export Button
  // ---------------------------------------------------------------------------
  it("btnStatusPngExport dispatches exportImage with 'png'", () => {
    bindChartTransferControls(makeDeps());
    const pngBtn = document.getElementById("btnStatusPngExport") as HTMLButtonElement;
    pngBtn.click();
    expect(exportImageSpy).toHaveBeenCalledWith("png");
  });

  // ---------------------------------------------------------------------------
  // 4. Raster JPG Export Button
  // ---------------------------------------------------------------------------
  it("btnStatusJpgExport dispatches exportImage with 'jpg'", () => {
    bindChartTransferControls(makeDeps());
    const jpgBtn = document.getElementById("btnStatusJpgExport") as HTMLButtonElement;
    jpgBtn.click();
    expect(exportImageSpy).toHaveBeenCalledWith("jpg");
  });

  // ---------------------------------------------------------------------------
  // 5. SVG Export Button
  // ---------------------------------------------------------------------------
  it("btnStatusSvgExport dispatches exportSvg", () => {
    bindChartTransferControls(makeDeps());
    const btn = document.getElementById("btnStatusSvgExport") as HTMLButtonElement;
    btn.click();
    expect(exportSvgSpy).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 6. Periodontal Export Buttons (SVG, PNG, JPG)
  // ---------------------------------------------------------------------------
  it("btnPerioSvgExport, btnPerioPngExport, btnPerioJpgExport dispatch periodontal exporters", () => {
    bindChartTransferControls(makeDeps());
    const svgBtn = document.getElementById("btnPerioSvgExport") as HTMLButtonElement;
    const pngBtn = document.getElementById("btnPerioPngExport") as HTMLButtonElement;
    const jpgBtn = document.getElementById("btnPerioJpgExport") as HTMLButtonElement;

    svgBtn.click();
    expect(exportPerioSvgSpy).toHaveBeenCalledTimes(1);

    pngBtn.click();
    expect(exportPerioImageSpy).toHaveBeenCalledWith("png");

    jpgBtn.click();
    expect(exportPerioImageSpy).toHaveBeenCalledWith("jpg");
  });

  // ---------------------------------------------------------------------------
  // 7. Status JSON Import
  // ---------------------------------------------------------------------------
  it("Status JSON import dispatches importStatus with parsed data", async () => {
    bindChartTransferControls(makeDeps());
    const input = document.getElementById("statusImportInput") as HTMLInputElement;

    const testPayload = { version: 1, teeth: { 11: { toothSelection: "implant" } } };
    const file = new File([JSON.stringify(testPayload)], "chart.json", { type: "application/json" });

    Object.defineProperty(input, "files", {
      value: [file],
      writable: true,
      configurable: true,
    });

    input.onchange!(new Event("change"));
    // Wait for file.text() and async handlers to resolve
    await new Promise((r) => setTimeout(r, 10));

    expect(importStatusSpy).toHaveBeenCalledTimes(1);
    expect(importStatusSpy).toHaveBeenCalledWith(testPayload);
    expect(importFhirBundleSpy).not.toHaveBeenCalled();
    expect(input.value).toBe("");
  });

  // ---------------------------------------------------------------------------
  // 8. FHIR Bundle Import
  // ---------------------------------------------------------------------------
  it("FHIR Bundle import dispatches importFhirBundle when format is fhir", async () => {
    bindChartTransferControls(makeDeps());
    setImportFormat("fhir");
    expect(getPendingImportFormat()).toBe("fhir");

    const input = document.getElementById("statusImportInput") as HTMLInputElement;
    const fhirBundle = { resourceType: "Bundle", type: "collection", entry: [] };
    const file = new File([JSON.stringify(fhirBundle)], "fhir.json", { type: "application/json" });

    Object.defineProperty(input, "files", {
      value: [file],
      writable: true,
      configurable: true,
    });

    input.onchange!(new Event("change"));
    await new Promise((r) => setTimeout(r, 10));

    expect(importFhirBundleSpy).toHaveBeenCalledTimes(1);
    expect(importFhirBundleSpy).toHaveBeenCalledWith(fhirBundle);
    expect(importStatusSpy).not.toHaveBeenCalled();
    expect(input.value).toBe("");
  });

  // ---------------------------------------------------------------------------
  // 9. Invalid JSON
  // ---------------------------------------------------------------------------
  it("Invalid JSON is caught, logged to console.error, and cleans up input and format", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    bindChartTransferControls(makeDeps());
    setImportFormat("fhir");

    const input = document.getElementById("statusImportInput") as HTMLInputElement;
    const file = new File(["{ malformed json ..."], "bad.json", { type: "application/json" });

    Object.defineProperty(input, "files", {
      value: [file],
      writable: true,
      configurable: true,
    });

    input.onchange!(new Event("change"));
    await new Promise((r) => setTimeout(r, 10));

    expect(errorSpy).toHaveBeenCalledWith("Odontogram import failed", expect.any(SyntaxError));
    expect(importStatusSpy).not.toHaveBeenCalled();
    expect(importFhirBundleSpy).not.toHaveBeenCalled();
    expect(input.value).toBe("");
    expect(getPendingImportFormat()).toBe("status");
  });

  // ---------------------------------------------------------------------------
  // 10. File read rejection
  // ---------------------------------------------------------------------------
  it("File read rejection is caught and handled via console.error without crashing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    bindChartTransferControls(makeDeps());

    const input = document.getElementById("statusImportInput") as HTMLInputElement;
    const rejectingFile = {
      name: "error.json",
      text: () => Promise.reject(new Error("Simulated disk read error")),
    };

    Object.defineProperty(input, "files", {
      value: [rejectingFile],
      writable: true,
      configurable: true,
    });

    input.onchange!(new Event("change"));
    await new Promise((r) => setTimeout(r, 10));

    expect(errorSpy).toHaveBeenCalledWith("Odontogram import failed", expect.any(Error));
    expect(importStatusSpy).not.toHaveBeenCalled();
    expect(input.value).toBe("");
    expect(getPendingImportFormat()).toBe("status");
  });

  // ---------------------------------------------------------------------------
  // 11. No-file selection (early return)
  // ---------------------------------------------------------------------------
  it("No-file selection gracefully returns early without dispatching or error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    bindChartTransferControls(makeDeps());
    setImportFormat("fhir");

    const input = document.getElementById("statusImportInput") as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: [],
      writable: true,
      configurable: true,
    });

    input.onchange!(new Event("change"));
    await new Promise((r) => setTimeout(r, 10));

    expect(importStatusSpy).not.toHaveBeenCalled();
    expect(importFhirBundleSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    // Because it returned early before the finally block, format remains as set
    expect(getPendingImportFormat()).toBe("fhir");
  });

  // ---------------------------------------------------------------------------
  // 12. Format reset after completed import attempt
  // ---------------------------------------------------------------------------
  it("Pending import format resets to 'status' after an import attempt", async () => {
    bindChartTransferControls(makeDeps());
    setImportFormat("fhir");
    expect(getPendingImportFormat()).toBe("fhir");

    const input = document.getElementById("statusImportInput") as HTMLInputElement;
    const file = new File(['{"sample":true}'], "data.json", { type: "application/json" });

    Object.defineProperty(input, "files", {
      value: [file],
      writable: true,
      configurable: true,
    });

    input.onchange!(new Event("change"));
    await new Promise((r) => setTimeout(r, 10));

    expect(getPendingImportFormat()).toBe("status");
  });

  // ---------------------------------------------------------------------------
  // 13. Format snapshot before asynchronous read
  // ---------------------------------------------------------------------------
  it("Format is captured synchronously before file.text() resolves", async () => {
    bindChartTransferControls(makeDeps());
    setImportFormat("fhir");

    let resolveRead: (v: string) => void;
    const pendingText = new Promise<string>((resolve) => {
      resolveRead = resolve;
    });

    const file = {
      name: "deferred.json",
      text: () => pendingText,
    };

    const input = document.getElementById("statusImportInput") as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: [file],
      writable: true,
      configurable: true,
    });

    // Launch change handler
    input.onchange!(new Event("change"));

    // Immediately mutate pending format to "status" while file.text() is still pending
    setImportFormat("status");

    // Now resolve file text with valid JSON
    resolveRead!(JSON.stringify({ resourceType: "Bundle" }));
    await new Promise((r) => setTimeout(r, 10));

    // Must have routed to FHIR import because format was captured before await
    expect(importFhirBundleSpy).toHaveBeenCalledTimes(1);
    expect(importStatusSpy).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 14. Repeated selection of the same file
  // ---------------------------------------------------------------------------
  it("btnStatusImport clears input value and click triggers native file picker", async () => {
    bindChartTransferControls(makeDeps());

    const importBtn = document.getElementById("btnStatusImport") as HTMLButtonElement;
    const input = document.getElementById("statusImportInput") as HTMLInputElement;

    const clickSpy = vi.spyOn(input, "click").mockImplementation(() => {});

    // In HTML file inputs, setting input.value = "" clears the file selection.
    // We verify importBtn click sets input.value = "" and invokes click()
    let valueSet = "initial";
    Object.defineProperty(input, "value", {
      get: () => valueSet,
      set: (v) => { valueSet = v; },
      configurable: true,
    });

    importBtn.click();

    expect(valueSet).toBe("");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 15. Rebinding on a replacement DOM node
  // ---------------------------------------------------------------------------
  it("Rebinding on replacement DOM nodes binds fresh elements cleanly", () => {
    bindChartTransferControls(makeDeps());

    // Replace DOM container with fresh nodes
    document.body.innerHTML = "";
    setupTransferDOM();

    // Rebind
    bindChartTransferControls(makeDeps());

    const exportBtn = document.getElementById("btnStatusExport") as HTMLButtonElement;
    exportBtn.click();
    expect(exportStatusSpy).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 16. Repeated wiring without duplicate actions (.onclick / .onchange replacement)
  // ---------------------------------------------------------------------------
  it("Repeated wiring replaces property handlers without duplicate executions", () => {
    const deps = makeDeps();

    // Wire 3 times
    bindChartTransferControls(deps);
    bindChartTransferControls(deps);
    bindChartTransferControls(deps);

    const btn = document.getElementById("btnStatusExport") as HTMLButtonElement;
    btn.click();

    // Direct property assignment (.onclick) guarantees exactly 1 execution
    expect(exportStatusSpy).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 17. Preservation of the current public setImportFormat() facade
  // ---------------------------------------------------------------------------
  it("setImportFormat imported from @/odontogram updates pendingImportFormat state", () => {
    expect(getPendingImportFormat()).toBe("status");

    setImportFormatFromOdontogram("fhir");
    expect(getPendingImportFormat()).toBe("fhir");

    setImportFormatFromOdontogram("status");
    expect(getPendingImportFormat()).toBe("status");
  });
});
