/**
 * Greedy plain-text word-wrap to a fixed character budget per line.
 */
export function wrapPlainText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Filesystem-safe timestamp (YYYY-MM-DD-HH-MM-SS) for the download filename.
 */
export function pdfStamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}
