import { t } from "@/i18n/useI18n";
import { isValidRestoration } from "@/registry/restorations";
import type { Any } from "@/engine/types";

// ---- State validation ----
export function getStateWarnings(state: Any): string[] {
  const warnings: string[] = [];
  const isNone = state.toothSelection === "none";
  const isImplant = state.toothSelection === "implant";

  // Endo on missing or implant tooth
  if (state.endo !== "none" && (isNone || isImplant)) {
    warnings.push(t("warn.endoOnMissing"));
  }
  // Filling on missing tooth
  if (state.fillingMaterial !== "none" && isNone) {
    warnings.push(t("warn.fillingOnMissing"));
  }
  // Crown replace without a fixed restoration present
  if (state.crownReplace && !(state.toothSelection === "tooth-base" && state.restorationType !== "none")) {
    warnings.push(t("warn.crownReplaceNoCrown"));
  }
  // Caries on missing tooth
  if (state.caries.size > 0 && isNone) {
    warnings.push(t("warn.cariesOnMissing"));
  }
  // Bridge pillar without a fixed restoration present
  if (state.bridgePillar && !(state.toothSelection === "tooth-base" && state.restorationType !== "none")) {
    warnings.push(t("warn.pillarNoCrown"));
  }
  // Invalid restoration type/material combo
  if (!isValidRestoration(state.restorationType, state.restorationMaterial, "occlusal")) {
    warnings.push(t("warn.invalidRestorationCombo"));
  }

  return warnings;
}

/** TEST-ONLY: run the clinical-consistency warning checks against a plain state object. */
export function __getStateWarnings(state: Any): string[] {
  return getStateWarnings(state);
}
