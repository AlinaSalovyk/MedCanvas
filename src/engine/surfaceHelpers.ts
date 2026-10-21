import { isAnteriorTooth } from "@/engine/constants";
import { isUpperTooth } from "@/anatomy/profiles";
import { getSurfaceNotation } from "@/engine/sessionSettings";
import { el } from "@/engine/domHelpers";
import { t } from "@/i18n/useI18n";
import type { Any } from "@/engine/types";

/** Resolves the DISPLAY LETTER for a caries/filling surface,
 *  respecting the `surfaceNotation` setting ("full", default) and — in full
 *  mode — the tooth's arch (upper/lower) and anterior/posterior position.
 *
 *  FULL: occlusal -> "I" (incisal) on an anterior tooth, else "O" (occlusal);
 *  buccal -> "L" (labial) on an anterior tooth, else "B" (buccal); lingual ->
 *  "P" (palatal) on an upper tooth, else "L" (lingual).
 *  mesial -> "M", distal -> "D", subcrown -> "SC" always.
 *
 *  SIMPLE: always the tooth-independent B/M/O/D/L/SC set, regardless of
 *  position. */
export function surfaceLetter(surface: string, toothNo?: number | null): string {
  if (surface === "subcrown") return "SC";
  if (getSurfaceNotation() === "simple") {
    const map: Record<string, string> = { buccal: "B", mesial: "M", occlusal: "O", distal: "D", lingual: "L" };
    return map[surface] || surface;
  }
  const anterior = toothNo != null && isAnteriorTooth(toothNo);
  const upper = toothNo != null && isUpperTooth(toothNo);
  if (surface === "occlusal") return anterior ? "I" : "O";
  if (surface === "buccal") return anterior ? "L" : "B";
  if (surface === "lingual") return upper ? "P" : "L";
  if (surface === "mesial") return "M";
  if (surface === "distal") return "D";
  return surface;
}

/** Maps a caries surface identifier to its existing i18n surface-label key.
 *  Arch/anterior-aware for ALL of occlusal/buccal/lingual, gated on the
 *  `surfaceNotation` setting. */
export function surfaceLabelKey(surface: string, toothNo?: number | null): string {
  if (getSurfaceNotation() === "full") {
    const anterior = toothNo != null && isAnteriorTooth(toothNo);
    const upper = toothNo != null && isUpperTooth(toothNo);
    if (surface === "occlusal") return anterior ? "surface.incisal" : "surface.occlusal";
    if (surface === "buccal") return anterior ? "surface.labial" : "surface.buccal";
    if (surface === "lingual") return upper ? "surface.palatal" : "surface.lingual";
  }
  const map: Record<string, string> = {
    buccal: "surface.buccal",
    lingual: "surface.lingualPalatal",
    mesial: "surface.mesial",
    distal: "surface.distal",
    occlusal: "surface.occlusal",
  };
  return map[surface] || surface;
}

/** The letter used for `surface` in a per-tooth "(...)" summary — delegates to
 *  {@link surfaceLetter}. */
export function summarySurfaceLetter(surface: string, toothNo: number): string {
  return surfaceLetter(surface, toothNo);
}

/**
 * Render surface toggles in an anatomical cross/plus layout:
 * buccal (top), mesial (left), occlusal (center), distal (right), lingual (bottom).
 * Each item: { value, labelKey?, label?, letter, pos }. `pos` is one of
 * buccal|mesial|occlusal|distal|lingual and drives grid placement via a CSS class.
 * Keeps a hidden checkbox input (value=item.value) so existing state-sync works.
 */
export function buildSurfaceCross(container: Any, items: Any, onToggle: Any) {
  if (!container || container.childElementCount > 0) return;
  container.innerHTML = "";
  const cross = el("div", { class: "surface-cross" });
  for (const it of items) {
    const id = `chk-${it.value}`;
    const labelId = `lbl-${it.value}`;
    const labelText = it.labelKey ? t(it.labelKey) : it.label;
    const label = el("label", { class: `surface-cell pos-${it.pos}` }, [
      el("input", { type: "checkbox", id, value: it.value }),
      el("span", { class: "surf-letter", text: it.letter }),
      el("span", { id: labelId, class: "surf-name", text: labelText }),
    ]);
    const input = label.querySelector("input") as HTMLInputElement;
    input.addEventListener("change", (e) => onToggle(it.value, (e.target as HTMLInputElement).checked));
    cross.appendChild(label);
  }
  container.appendChild(cross);
}
