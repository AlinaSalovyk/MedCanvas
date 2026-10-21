import {
  type PdfDocLike,
  type PdfAssembleData,
  type PdfRow,
  type PdfToothTable,
  type PdfToothTableCell,
  type PdfImageSize,
  type PdfFooter,
  type RGB,
  MARGIN_MM,
  LINE_HEIGHT_MM,
  DEFAULT_IMAGE_ASPECT,
  C_PROBLEM,
} from "./types";
import { wrapPlainText } from "./pdfLayout";

export class PdfWriter {
  public y: number;
  public pageWidth: number;
  public pageHeight: number;
  public contentWidth: number;
  public font: string;

  constructor(
    public doc: PdfDocLike,
    public data: PdfAssembleData,
    public marginMm: number = MARGIN_MM
  ) {
    this.font = data.fontFamily ?? "helvetica";
    this.pageWidth = doc.internal.pageSize.getWidth();
    this.pageHeight = doc.internal.pageSize.getHeight();
    this.contentWidth = this.pageWidth - marginMm * 2;
    this.y = marginMm;
  }

  public drawText(s: string, x: number, y: number, options?: Record<string, unknown>): PdfDocLike {
    const transform = this.data.transformText ?? this.data.shapeText ?? ((str: string) => str);
    return this.doc.text(transform(s), x, y, options);
  }

  public fill(c: RGB): PdfDocLike {
    return this.doc.setFillColor(c[0], c[1], c[2]);
  }

  public stroke(c: RGB): PdfDocLike {
    return this.doc.setDrawColor(c[0], c[1], c[2]);
  }

  public ink(c: RGB): PdfDocLike {
    return this.doc.setTextColor(c[0], c[1], c[2]);
  }

  public ensureSpace(neededMm: number): void {
    if (this.y + neededMm > this.pageHeight - this.marginMm) {
      this.doc.addPage();
      this.y = this.marginMm;
    }
  }

  public drawDocumentTitle(title: string): void {
    if (!title) return;
    const { header: C_HEADER, text: C_TEXT } = this.data.palette;
    this.ink(C_HEADER);
    this.doc.setFontSize(20);
    this.doc.setFont(this.font, "bold");
    this.drawText(title, this.marginMm, this.y + 7);
    this.y += 10;
    this.stroke(C_HEADER);
    this.doc.setLineWidth(0.6);
    this.doc.line(this.marginMm, this.y, this.marginMm + this.contentWidth, this.y);
    this.y += 6;
    this.ink(C_TEXT);
    this.doc.setFont(this.font, "normal");
    this.doc.setFontSize(10);
  }

  public drawSectionBar(title: string): void {
    const barH = 7.5;
    this.ensureSpace(barH + 3);
    const { header: C_HEADER, headerText: C_HEADER_TEXT, text: C_TEXT } = this.data.palette;
    this.fill(C_HEADER);
    this.doc.rect(this.marginMm, this.y, this.contentWidth, barH, "F");
    this.ink(C_HEADER_TEXT);
    this.doc.setFontSize(11.5);
    this.doc.setFont(this.font, "bold");
    this.drawText(title, this.marginMm + 2.5, this.y + 5.1);
    this.y += barH + 3;
    this.ink(C_TEXT);
    this.doc.setFont(this.font, "normal");
    this.doc.setFontSize(10);
  }

  public drawCaption(txt: string): void {
    if (!txt) return;
    const { muted: C_MUTED, text: C_TEXT } = this.data.palette;
    const maxChars = Math.max(20, Math.floor(this.contentWidth / 1.6));
    this.doc.setFontSize(9);
    this.doc.setFont(this.font, "italic");
    this.ink(C_MUTED);
    for (const raw of txt.split("\n")) {
      const lines = raw.trim() === "" ? [""] : wrapPlainText(raw, maxChars);
      for (const line of lines) {
        this.ensureSpace(4.4);
        this.drawText(line, this.marginMm, this.y + 3.1);
        this.y += 4.4;
      }
    }
    this.y += 1.5;
    this.ink(C_TEXT);
    this.doc.setFont(this.font, "normal");
    this.doc.setFontSize(10);
  }

  public drawTable(rows: PdfRow[], o: { labelWidth: number; fontSize?: number }): void {
    if (!rows.length) return;
    const {
      labelBg: C_LABEL_BG,
      rowBg: C_ROW_BG,
      rowAlt: C_ROW_ALT,
      border: C_BORDER,
      text: C_TEXT,
      muted: C_MUTED,
    } = this.data.palette;

    const fontSize = o.fontSize ?? 9;
    const labelW = o.labelWidth;
    const valX = this.marginMm + labelW;
    const valW = this.contentWidth - labelW;
    const pad = 1.8;
    const lineH = fontSize * 0.48;
    const mmPerChar = (1.7 * fontSize) / 10;
    const labelBudget = Math.max(4, Math.floor((labelW - pad * 2) / mmPerChar));
    const valBudget = Math.max(6, Math.floor((valW - pad * 2) / mmPerChar));

    rows.forEach((row, i) => {
      const labelLines = row.label ? wrapPlainText(row.label, labelBudget) : [""];
      const valueLines = row.value ? wrapPlainText(row.value, valBudget) : [""];
      const n = Math.max(labelLines.length, valueLines.length, 1);
      const rowH = n * lineH + pad * 2;
      if (this.y + rowH > this.pageHeight - this.marginMm) {
        this.doc.addPage();
        this.y = this.marginMm;
      }

      this.fill(C_LABEL_BG);
      this.doc.rect(this.marginMm, this.y, labelW, rowH, "F");
      this.fill(i % 2 ? C_ROW_ALT : C_ROW_BG);
      this.doc.rect(valX, this.y, valW, rowH, "F");
      this.stroke(C_BORDER);
      this.doc.setLineWidth(0.15);
      this.doc.rect(this.marginMm, this.y, this.contentWidth, rowH, "S");
      this.doc.line(valX, this.y, valX, this.y + rowH);

      this.doc.setFontSize(fontSize);
      let ty = this.y + pad + lineH * 0.72;
      this.doc.setFont(this.font, "bold");
      this.ink(C_TEXT);
      for (const ln of labelLines) {
        this.drawText(ln, this.marginMm + pad, ty);
        ty += lineH;
      }
      ty = this.y + pad + lineH * 0.72;
      this.doc.setFont(this.font, "normal");
      this.ink(C_MUTED);
      for (const ln of valueLines) {
        this.drawText(ln, valX + pad, ty);
        ty += lineH;
      }
      this.y += rowH;
    });
    this.y += 3;
    this.ink(C_TEXT);
    this.doc.setFont(this.font, "normal");
    this.doc.setFontSize(10);
  }

  public drawToothTable(tt: PdfToothTable): void {
    const nCols = tt.columns.length;
    if (nCols === 0 || tt.rows.length === 0) return;
    const {
      header: C_HEADER,
      headerText: C_HEADER_TEXT,
      labelBg: C_LABEL_BG,
      rowBg: C_ROW_BG,
      rowAlt: C_ROW_ALT,
      border: C_BORDER,
      text: C_TEXT,
      muted: C_MUTED,
    } = this.data.palette;

    const fontSize = 8;
    const lineH = fontSize * 0.5;
    const pad = 1.6;
    const labelW = 34;
    const catW = (this.contentWidth - labelW) / nCols;
    const mmPerChar = (1.7 * fontSize) / 10;
    const budget = (colW: number) => Math.max(4, Math.floor((colW - pad * 2) / mmPerChar));
    type Tok = { text: string; status: string };

    const layout = (arr: PdfToothTableCell[]): Tok[][] => {
      const b = budget(catW);
      const lines: Tok[][] = [[]];
      arr.forEach((c, i) => {
        const tok = c.label + (i < arr.length - 1 ? "," : "");
        const line = lines[lines.length - 1];
        const curChars = line.reduce((a, t) => a + t.text.length + 1, 0);
        if (curChars + tok.length + 1 > b && line.length) lines.push([]);
        lines[lines.length - 1].push({ text: tok, status: c.status });
      });
      return lines;
    };

    // Header row
    const headerH = lineH + pad * 2;
    this.ensureSpace(headerH + 4);
    this.fill(C_HEADER);
    this.doc.rect(this.marginMm, this.y, this.contentWidth, headerH, "F");
    this.ink(C_HEADER_TEXT);
    this.doc.setFont(this.font, "bold");
    this.doc.setFontSize(fontSize);
    tt.columns.forEach((col, ci) =>
      this.drawText(col.label, this.marginMm + labelW + ci * catW + pad, this.y + pad + lineH * 0.72)
    );
    this.y += headerH;

    // Group rows
    const labelBudget = budget(labelW);
    tt.rows.forEach((row, ri) => {
      const cellLines = tt.columns.map((col) => layout(row.cells[col.key] ?? []));
      const labelLines = wrapPlainText(row.label, labelBudget);
      const nLines = Math.max(1, labelLines.length, ...cellLines.map((l) => l.length));
      const rowH = nLines * lineH + pad * 2;
      if (this.y + rowH > this.pageHeight - this.marginMm) {
        this.doc.addPage();
        this.y = this.marginMm;
      }
      this.fill(C_LABEL_BG);
      this.doc.rect(this.marginMm, this.y, labelW, rowH, "F");
      this.fill(ri % 2 ? C_ROW_ALT : C_ROW_BG);
      this.doc.rect(this.marginMm + labelW, this.y, this.contentWidth - labelW, rowH, "F");
      this.stroke(C_BORDER);
      this.doc.setLineWidth(0.15);
      this.doc.rect(this.marginMm, this.y, this.contentWidth, rowH, "S");
      this.doc.line(this.marginMm + labelW, this.y, this.marginMm + labelW, this.y + rowH);
      for (let ci = 1; ci < nCols; ci++) {
        const x = this.marginMm + labelW + ci * catW;
        this.doc.line(x, this.y, x, this.y + rowH);
      }
      this.doc.setFont(this.font, "bold");
      this.doc.setFontSize(fontSize);
      this.ink(C_TEXT);
      labelLines.forEach((ln, li) => this.drawText(ln, this.marginMm + pad, this.y + pad + lineH * (li + 0.72)));
      tt.columns.forEach((col, ci) => {
        const cellX = this.marginMm + labelW + ci * catW;
        cellLines[ci].forEach((line, li) => {
          let tx = cellX + pad;
          const ty = this.y + pad + lineH * (li + 0.72);
          for (const tk of line) {
            if (tk.status === "problem") {
              this.doc.setFont(this.font, "bolditalic");
              this.ink(C_PROBLEM);
            } else if (tk.status === "content") {
              this.doc.setFont(this.font, "bold");
              this.ink(C_HEADER);
            } else {
              this.doc.setFont(this.font, "normal");
              this.ink(C_MUTED);
            }
            this.drawText(tk.text, tx, ty);
            tx += (tk.text.length + 1) * mmPerChar;
          }
        });
      });
      this.y += rowH;
    });

    // Emphasis legend
    this.y += 1;
    this.doc.setFont(this.font, "italic");
    this.doc.setFontSize(7);
    this.ink(C_MUTED);
    for (const ln of wrapPlainText(tt.legend, Math.max(20, Math.floor(this.contentWidth / 1.3)))) {
      this.ensureSpace(3.4);
      this.drawText(ln, this.marginMm, this.y + 2.4);
      this.y += 3.4;
    }
    this.y += 2;
    this.ink(C_TEXT);
    this.doc.setFont(this.font, "normal");
    this.doc.setFontSize(10);
  }

  public drawImage(
    png: string,
    size?: PdfImageSize,
    border?: { widthMm: number; color: RGB } | null
  ): void {
    if (!png) return;
    const aspect = size && size.width > 0 ? size.height / size.width : DEFAULT_IMAGE_ASPECT;
    const imgWidth = this.contentWidth;
    const maxImgHeight = this.pageHeight - this.marginMm * 2;
    const imgHeight = Math.min(maxImgHeight, imgWidth * aspect);
    this.ensureSpace(imgHeight);
    this.doc.addImage(png, "PNG", this.marginMm, this.y, imgWidth, imgHeight);
    if (border) {
      this.doc.setDrawColor(border.color[0], border.color[1], border.color[2]);
      this.doc.setLineWidth(border.widthMm);
      this.doc.rect(this.marginMm, this.y, imgWidth, imgHeight, "S");
    }
    this.y += imgHeight + LINE_HEIGHT_MM;
  }

  public drawFooterBlock(f: PdfFooter): void {
    const { border: C_BORDER, muted: C_MUTED, header: C_HEADER, text: C_TEXT } = this.data.palette;
    const lineH = 3.6;
    const discBudget = Math.max(20, Math.floor(this.contentWidth / 1.35));
    const discLines = f.disclaimer ? wrapPlainText(f.disclaimer, discBudget) : [];
    const genLines = (f.generated ? 1 : 0) + (f.repoUrl ? 1 : 0) + (f.doi ? 1 : 0);

    if (discLines.length === 0 && genLines === 0) return;
    const gap = discLines.length && genLines ? 2 : 0;
    const blockH = 3 + discLines.length * lineH + gap + genLines * lineH + 2;
    if (this.y + 8 + blockH > this.pageHeight - this.marginMm) {
      this.doc.addPage();
      this.y = this.marginMm;
    }
    this.y = Math.max(this.y + 8, this.pageHeight - this.marginMm - blockH);
    this.stroke(C_BORDER);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.marginMm, this.y, this.marginMm + this.contentWidth, this.y);
    this.y += 3;
    this.doc.setFontSize(7.5);
    if (discLines.length) {
      this.doc.setFont(this.font, "italic");
      this.ink(C_MUTED);
      for (const ln of discLines) {
        this.drawText(ln, this.marginMm, this.y + 2.6);
        this.y += lineH;
      }
    }
    if (genLines) {
      if (discLines.length) this.y += 2;
      this.doc.setFont(this.font, "normal");
      this.ink(C_MUTED);
      if (f.generated) {
        this.drawText(f.generated, this.marginMm, this.y + 2.6);
        this.y += lineH;
      }
      this.ink(C_HEADER);
      if (f.repoUrl) {
        this.drawText(`GitHub: ${f.repoUrl}`, this.marginMm, this.y + 2.6);
        this.y += lineH;
      }
      if (f.doi) {
        this.drawText(`DOI: ${f.doi}`, this.marginMm, this.y + 2.6);
        this.y += lineH;
      }
    }
    this.ink(C_TEXT);
  }
}
