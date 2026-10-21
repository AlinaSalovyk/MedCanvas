import { t } from "@/i18n/useI18n";
import {
  type PdfExportOptions,
  type PdfAssembleData,
  type PdfDocLike,
  MARGIN_MM,
} from "./types";
import { pdfStamp } from "./pdfLayout";
import { PdfWriter } from "./pdfDraw";

/**
 * Assemble the PDF report from pre-rendered data, gated by opts. PURE —
 * no I/O, no rasterization; docFactory defaults to a real new jsPDF()
 * but tests always inject a fake.
 */
export function assemblePdf(
  opts: PdfExportOptions,
  data: PdfAssembleData,
  docFactory: () => PdfDocLike = () => {
    throw new Error("assemblePdf: a docFactory is required — jsPDF is lazy-loaded by exportPdf()");
  }
): PdfDocLike {
  const doc = docFactory();
  const writer = new PdfWriter(doc, data);
  doc.setFont(writer.font, "normal");

  writer.drawDocumentTitle(data.reportTitle);

  if (opts.patientData) {
    writer.drawSectionBar(t("pdf.section.patientData"));
    writer.drawTable(data.patient, { labelWidth: 45, fontSize: 10 });
  }

  if (opts.odontogramChart || opts.odontogramDescription) {
    writer.drawSectionBar(t("pdf.section.odontogram"));
    if (opts.odontogramChart) {
      writer.drawImage(data.odontogramPng, data.odontogramImageSize, data.odontogramBorder);
    }
    if (opts.odontogramDescription) {
      writer.drawCaption(data.odontogramCaption);
      if (data.toothTable) writer.drawToothTable(data.toothTable);
    }
  }

  if (opts.odontogramDescription && data.odontogramFindings.length) {
    writer.drawSectionBar(t("pdf.section.findings"));
    writer.drawTable(data.odontogramFindings, { labelWidth: 48, fontSize: 9 });
  }

  if (opts.individualNotes && data.individualNotes.length) {
    writer.drawSectionBar(t("toothInfo.notes"));
    writer.drawTable(data.individualNotes, { labelWidth: 24, fontSize: 9 });
  }

  if (data.hasPerio && opts.perioStatus) {
    if (writer.y > MARGIN_MM) {
      doc.addPage();
      writer.y = MARGIN_MM;
    }
    writer.drawSectionBar(t("pdf.section.perioStatus"));
    writer.drawImage(data.perioPng, data.perioImageSize);
  }

  if (data.hasPerio && opts.perioDescription) {
    if (data.perioMetrics.length) {
      writer.drawSectionBar(t("pdf.section.perioDescription"));
      writer.drawTable(data.perioMetrics, { labelWidth: 55, fontSize: 9.5 });
    }
    if (data.abbreviations.length) {
      writer.drawSectionBar(t("pdf.footer.title"));
      writer.drawTable(
        data.abbreviations.map((a) => ({ label: a.term, value: a.desc })),
        { labelWidth: 22, fontSize: 7.5 }
      );
    }
  }

  writer.drawFooterBlock(data.footer);

  doc.save(`odontogram-report-${pdfStamp()}.pdf`);
  return doc;
}
