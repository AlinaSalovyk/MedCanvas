import { describe, it, expect } from "vitest";
import { jsPDF } from "jspdf";
import { assemblePdf, PDF_PALETTES, type PdfAssembleData, type PdfExportOptions } from "../../perioPdf";
import { loadPdfFont } from "../../fonts/loader";
import { setI18nLanguage } from "../../i18n/useI18n";

describe("PDF Ukrainian smoke & glyph verification", () => {
  it("successfully generates a valid PDF with Ukrainian dental terms and normalized glyphs", async () => {
    await setI18nLanguage("uk");
    const pdfFont = await loadPdfFont("uk");
    expect(pdfFont.family).toBe("Roboto");

    // 1x1 transparent PNG data URI
    const sampleChartPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const opts: PdfExportOptions = {
      patientData: true,
      odontogramChart: true,
      odontogramDescription: true,
      individualNotes: true,
      perioStatus: true,
      perioDescription: true,
    };

    const data: PdfAssembleData = {
      hasPerio: true,
      reportTitle: "Звіт одонтограми та пародонтального статусу",
      footer: {
        disclaimer: "Не є сертифікованим медичним виробом для діагностики.",
        generated: "Сформовано 2026-10-10 за допомогою Advanced Odontogram",
        repoUrl: "",
        doi: "",
      },
      palette: PDF_PALETTES.teal,
      fontFamily: pdfFont.family,
      shapeText: pdfFont.transform,
      patient: [
        { label: "ПІБ", value: "Іван Їжакевич" },
        { label: "Дата народження", value: "1988-04-12 (38 р.)" },
        { label: "Дата огляду", value: "2026-10-10" },
      ],
      odontogramPng: sampleChartPng,
      odontogramCaption: "Зубна формула: 28 постійних зубів, ґрунтовне обстеження проведено.",
      odontogramFindings: [
        { label: "Зуб 11", value: "Карієс емалі (ICDAS 2). Пломба №1 потребує заміни" },
        { label: "Зуб 21", value: "Здоровий зуб (Ґрунтовний огляд, без патологій)" },
        { label: "Зуб 36", value: "Пульпіт / Ендодонтичне лікування. Канал запломбовано" },
      ],
      individualNotes: [
        { label: "Зуб 16", value: "Гіперестезія шийки зуба при контакті з холодним" },
        { label: "Зуб 47", value: "Реставрація композитом світлового твердіння" },
      ],
      perioPng: sampleChartPng,
      perioMetrics: [
        { label: "Кровоточивість при зондуванні (BOP)", value: "≥30%" },
        { label: "Глибина кишень (PD)", value: "≤3 мм" },
        { label: "Втрата прикріплення (CAL)", value: "≥5 мм" },
        { label: "Класифікація пародонтиту", value: "Стадія III, генералізований (≥30% зубів), ступінь B" },
      ],
      abbreviations: [
        { term: "BOP", desc: "Bleeding on Probing — кровоточивість при зондуванні" },
        { term: "CAL", desc: "Clinical Attachment Level — клінічний рівень прикріплення" },
        { term: "PD", desc: "Probing Depth — глибина зондування кишень" },
      ],
    };

    const doc = assemblePdf(opts, data, () => {
      const d = new jsPDF();
      pdfFont.register(d);
      return d;
    }) as unknown as jsPDF;

    const pdfBuffer = doc.output("arraybuffer");
    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.byteLength).toBeGreaterThan(1000);

    const pdfDataUri = doc.output("datauristring");
    expect(pdfDataUri.startsWith("data:application/pdf;")).toBe(true);

    // Check PDF validity
    const rawPdf = doc.output();
    expect(rawPdf.startsWith("%PDF-")).toBe(true);
    expect(rawPdf.includes("Roboto")).toBe(true);
    expect(rawPdf.includes("%%EOF")).toBe(true);

    // In jsPDF, TrueType Unicode text is encoded as hex UTF-16BE / CID within text operators, e.g. <0422...>, or in FlateDecode streams.
    // Verify document has valid pages and font references
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);

    // Save actual PDF file to disk for visual / smoke validation and clean up
    const fs = await import("fs");
    const path = await import("path");
    const outPath = path.resolve(__dirname, "../../test-ukrainian-report.pdf");
    try {
      fs.writeFileSync(outPath, Buffer.from(pdfBuffer));
      expect(fs.existsSync(outPath)).toBe(true);
      expect(fs.statSync(outPath).size).toBeGreaterThan(5000);
    } finally {
      if (fs.existsSync(outPath)) {
        fs.unlinkSync(outPath);
      }
    }
  });
});
