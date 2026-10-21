//
// PDF font loader. Provides the embedded Unicode font (Roboto subset) for the
// application (English Latin and Ukrainian Cyrillic) and returns a descriptor the
// export path uses: the jsPDF family name, a registration fn, and a per-string
// text transform (normalizing special glyphs to standard ASCII equivalents).
// The font module is loaded via dynamic import so it stays code-split out of the
// main bundle until PDF export is invoked.
import type { FontRegistrable } from "./roboto";

export interface PdfFont {
  /** jsPDF family name to pass to `doc.setFont(family, style)`. */
  family: string;
  /** Register the font's VFS + styles on a jsPDF doc; false if unsupported. */
  register: (doc: FontRegistrable) => boolean;
  /** Per-string transform applied before `doc.text`. */
  transform: (s: string) => string;
}

/** Normalize characters missing from the Roboto subset (≥, ≤, №) to standard readable equivalents. */
export function normalizeRobotoText(s: string): string {
  if (!s) return s;
  return s
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/№/g, "No.");
}

/** Load + describe the PDF font for `_lang` (bundled Roboto font for English and Ukrainian). */
export async function loadPdfFont(_lang?: string): Promise<PdfFont> {
  // Bundled Roboto font covering Latin and Cyrillic (en and uk).
  const { registerRobotoFont, PDF_FONT_FAMILY } = await import("./roboto");
  return { family: PDF_FONT_FAMILY, register: registerRobotoFont, transform: normalizeRobotoText };
}
