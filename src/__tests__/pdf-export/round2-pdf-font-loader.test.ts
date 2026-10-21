// PDF font loader test: verifies that the loader resolves the embedded Roboto
// Unicode font (Latin and Cyrillic) for both English and Ukrainian, and applies
// symbol normalization while preserving Cyrillic characters.
import { describe, it, expect } from "vitest";
import { loadPdfFont } from "../../fonts/loader";

function fakeDoc() {
  const fonts: string[] = [];
  return {
    fonts,
    addFileToVFS: () => {},
    addFont: (_f: string, family: string) => { fonts.push(family); },
  };
}

describe("PDF font loader", () => {
  it("loads Roboto (Latin/Cyrillic) and normalizes unsupported symbols for supported locales (en, uk)", async () => {
    for (const lang of ["en", "uk"]) {
      const f = await loadPdfFont(lang);
      expect(f.family).toBe("Roboto");
      expect(f.transform("Dental Report")).toBe("Dental Report");
      expect(f.transform("звіт")).toBe("звіт");
      expect(f.transform("ІіЇїЄєҐґ")).toBe("ІіЇїЄєҐґ");
      expect(f.transform("≥30%")).toBe(">=30%");
      expect(f.transform("≤3 мм")).toBe("<=3 мм");
      expect(f.transform("№1")).toBe("No.1");
      const doc = fakeDoc();
      expect(f.register(doc)).toBe(true);
      expect(doc.fonts).toContain("Roboto");
    }
  });

  it("safely falls back to Roboto when called with undefined", async () => {
    const f = await loadPdfFont();
    expect(f.family).toBe("Roboto");
    const doc = fakeDoc();
    expect(f.register(doc)).toBe(true);
  });
});
