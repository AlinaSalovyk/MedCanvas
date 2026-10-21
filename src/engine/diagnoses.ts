import { toothState } from "@/state/chart";
import { serializeState } from "@/state/payload";
import { deriveDentalDiagnoses } from "@/dx/derive";
import { refineWho } from "@/dx/refine";
import type { ToothDiagnosis } from "@/engine/types";

/**
 * A tooth's EFFECTIVE coded diagnoses (derived − suppressed + added), reused
 * by both the tooltip (`getStateSummary`) and the whole-mouth summary
 * (`getOdontogramSummary`). Reads the ACTIVE chart's tooth state (so
 * it's transparently Status/Plan dual-state aware, like every other per-tooth
 * getter). A tooth with no state (never touched) has no diagnoses.
 */
export function getToothDiagnoses(toothNo: number): ToothDiagnosis[] {
  const state = toothState.get(toothNo);
  if(!state) return [];
  const payload = { teeth: { [String(toothNo)]: serializeState(state) } };
  const derived = deriveDentalDiagnoses(payload);
  const overrides: Map<string, string> | undefined = state.dxOverrides;
  const list: ToothDiagnosis[] = derived.map((d) => {
    const who = refineWho(d.key, d.detail); // DX-8: e.g. caries -> K02.1 Caries of dentine
    return {
      key: d.key,
      icd10: who.icd10,
      icd10Display: who.display,
      source: overrides?.get(d.key) === "add" ? "added" : "derived",
    };
  });
  return list.sort((a, b) => (a.icd10 ?? "\uFFFD").localeCompare(b.icd10 ?? "\uFFFD"));
}
