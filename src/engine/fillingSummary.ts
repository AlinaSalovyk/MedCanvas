import { ALL_TEETH } from "@/anatomy/profiles";
import { SUMMARY_SURFACE_ORDER } from "@/engine/constants";
import { summarySurfaceLetter } from "@/engine/surfaceHelpers";
import { t } from "@/i18n/useI18n";

type SubcariesStateLike =
  | { caries?: Set<string>; fillingSurfaceMaterials?: Map<string, string> }
  | undefined
  | null;

/** The recurrent ("sub") caries surfaces on ONE tooth — a surface carries BOTH
 *  caries and a filling (`state.caries` has `caries-{surface}` AND
 *  `state.fillingSurfaceMaterials` has `{surface}`). Returns the surfaces'
 *  letters, in the codebase's existing anatomical order (`SUMMARY_SURFACE_ORDER`:
 *  B, M, O, D, L), concatenated with no separator (e.g. "MOD", "B"); "" when the
 *  tooth has no recurrent-caries surface. */
export function subcariesLettersForTooth(toothNo: number, state: SubcariesStateLike): string {
  if (!state || !state.caries || !state.fillingSurfaceMaterials) return "";
  const letters: string[] = [];
  for (const surface of SUMMARY_SURFACE_ORDER) {
    if (surface === "subcrown") continue; // fillings never target subcrown
    if (state.caries.has(`caries-${surface}`) && state.fillingSurfaceMaterials.has(surface)) {
      letters.push(summarySurfaceLetter(surface, toothNo));
    }
  }
  return letters.join("");
}

/** The "Fillings and restorative" panel's informational subcaries-summary line
 *  — one entry per SELECTED tooth that has recurrent
 *  caries (see {@link subcariesLettersForTooth}), in `ALL_TEETH` order, styled
 *  "{FDI} ({letters})" and joined with ", ". */
export function computeFillingSubcariesSummaryLine(
  selectedToothNos: Iterable<number>,
  getState: (toothNo: number) => SubcariesStateLike,
): string {
  const selected = new Set(selectedToothNos);
  const entries: string[] = [];
  for (const toothNo of ALL_TEETH) {
    if (!selected.has(toothNo)) continue;
    const letters = subcariesLettersForTooth(toothNo, getState(toothNo));
    if (letters) entries.push(`${toothNo} (${letters})`);
  }
  if (entries.length === 0) return "";
  const key = entries.length > 1 ? "filling.subcariesSummaryMultiple" : "filling.subcariesSummarySingle";
  return t(key, { teeth: entries.join(", ") });
}

type FillingDefectStateLike =
  | { fillingDefect?: Map<string, string>; fillingSurfaceMaterials?: Map<string, string>; restorationType?: string }
  | undefined
  | null;

/** The filling-defect surfaces on ONE tooth, parallel to
 *  {@link subcariesLettersForTooth} — a surface carries a defect when it is
 *  BOTH present in `fillingSurfaceMaterials` AND has a non-"none"
 *  `fillingDefect` entry, gated the SAME way the existing whole-mouth
 *  filling-defect summary is (`restorationType === "none"`, i.e. defects are
 *  suppressed under a crown/bridge). */
export function fillingDefectLettersForTooth(toothNo: number, state: FillingDefectStateLike): string {
  if (!state || !state.fillingDefect || !state.fillingSurfaceMaterials) return "";
  if (state.restorationType && state.restorationType !== "none") return "";
  const letters: string[] = [];
  for (const surface of SUMMARY_SURFACE_ORDER) {
    if (surface === "subcrown") continue; // fillings never target subcrown
    if (state.fillingDefect.has(surface) && state.fillingSurfaceMaterials.has(surface)) {
      letters.push(summarySurfaceLetter(surface, toothNo));
    }
  }
  return letters.join("");
}

/** The "Fillings and restorative" panel's informational filling-defect-summary
 *  line, parallel to {@link computeFillingSubcariesSummaryLine}
 *  — one entry per SELECTED tooth that has a filling-defect surface. */
export function computeFillingDefectSummaryLine(
  selectedToothNos: Iterable<number>,
  getState: (toothNo: number) => FillingDefectStateLike,
): string {
  const selected = new Set(selectedToothNos);
  const entries: string[] = [];
  for (const toothNo of ALL_TEETH) {
    if (!selected.has(toothNo)) continue;
    const letters = fillingDefectLettersForTooth(toothNo, getState(toothNo));
    if (letters) entries.push(`${toothNo} (${letters})`);
  }
  if (entries.length === 0) return "";
  const key = entries.length > 1 ? "filling.fillingDefectSummaryMultiple" : "filling.fillingDefectSummarySingle";
  return t(key, { teeth: entries.join(", ") });
}
