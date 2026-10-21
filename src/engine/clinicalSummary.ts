import { t } from "@/i18n/useI18n";
import { getPulpDetailLevel, kebabToCamel, PULP_DX_TO_LATIN } from "@/state/pulpApical";
import { SUMMARY_SURFACE_ORDER } from "@/engine/constants";
import { summarySurfaceLetter } from "@/engine/surfaceHelpers";
import { VALID_PLAQUE_SURFACE } from "@/state/payload";
import {
  getPlaqueIndex,
  getGingivalIndex,
  getPeriImplantPlaque,
  getPeriImplantBleeding,
  getKeratinizedWidth,
  getGingivalThickness,
  getMillerClass,
} from "@/state/perio";
import type { Any } from "@/engine/types";

export function pulpDiagnosisLabel(state: Any): string | null {
  if (getPulpDetailLevel() === "latin") {
    if (state.pulpLatin && state.pulpLatin !== "none") {
      return t("pulpLatin." + kebabToCamel(state.pulpLatin));
    }
    if (state.pulpDx && state.pulpDx !== "normal") {
      const latinRepresentative = PULP_DX_TO_LATIN[state.pulpDx];
      if (latinRepresentative) return t("pulpLatin." + kebabToCamel(latinRepresentative));
    }
  }
  if (state.pulpDx && state.pulpDx !== "normal") return t("pulpDx." + kebabToCamel(state.pulpDx));
  return null;
}

export function apicalDiagnosisLabel(state: Any): string | null {
  if (!state.apicalDx || state.apicalDx === "normal") return null;
  let label = t("apicalDx." + kebabToCamel(state.apicalDx));
  if (state.periapicalType && state.periapicalType !== "none") {
    label += " (" + t("periapical.type." + kebabToCamel(state.periapicalType)) + ")";
  }
  return label;
}

export function resorptionDiagnosisLabel(state: Any): string | null {
  if (!state.resorptionType || state.resorptionType === "none") return null;
  return t("resorption.type." + kebabToCamel(state.resorptionType));
}

export function periImplantSummaryLabel(state: Any): string | null {
  if (state.toothSelection !== "implant") return null;
  if (!state.periImplant || state.periImplant === "none") return null;
  return t("periImplant." + kebabToCamel(state.periImplant));
}

export function cejVisibilitySummaryLabel(state: Any): string | null {
  if (!state.cejVisibility || state.cejVisibility === "none") return null;
  return t("perio.cej." + kebabToCamel(state.cejVisibility));
}

export function rootConcavitySummaryLabel(state: Any): string | null {
  if (!state.rootConcavity || state.rootConcavity === "none") return null;
  return t("perio.rootConcavity." + kebabToCamel(state.rootConcavity));
}

export function graduatedSurfaceSummaryLine(
  toothNo: number,
  getter: (toothNo: number, surface: string) => 0 | 1 | 2 | 3,
  rowLabelKey: string,
): string | null {
  const parts: string[] = [];
  for (const surface of SUMMARY_SURFACE_ORDER) {
    if (!VALID_PLAQUE_SURFACE.has(surface)) continue;
    const grade = getter(toothNo, surface);
    if (grade > 0) parts.push(`${summarySurfaceLetter(surface, toothNo)}: ${grade}`);
  }
  if (parts.length === 0) return null;
  return `${t(rowLabelKey)} (${parts.join(", ")})`;
}

export function plaqueIndexSummaryLine(toothNo: number): string | null {
  return graduatedSurfaceSummaryLine(toothNo, getPlaqueIndex, "perio.pi.row");
}

export function gingivalIndexSummaryLine(toothNo: number): string | null {
  return graduatedSurfaceSummaryLine(toothNo, getGingivalIndex, "perio.gi.row");
}

export function periImplantPlaqueSummaryLine(toothNo: number): string | null {
  return graduatedSurfaceSummaryLine(toothNo, getPeriImplantPlaque, "perio.mpi.row");
}

export function periImplantBleedingSummaryLine(toothNo: number): string | null {
  return graduatedSurfaceSummaryLine(toothNo, getPeriImplantBleeding, "perio.mbi.row");
}

export function keratinizedWidthSummaryLine(toothNo: number): string | null {
  const mm = getKeratinizedWidth(toothNo);
  if (mm === null) return null;
  return `${t("perio.kg.row")}: ${mm} mm`;
}

export function gingivalThicknessSummaryLabel(toothNo: number): string | null {
  const gt = getGingivalThickness(toothNo);
  if (gt === "unknown") return null;
  return t("perio.gt." + gt);
}

export function millerClassSummaryLabel(toothNo: number): string | null {
  const mc = getMillerClass(toothNo);
  if (mc === "none") return null;
  return t("perio.miller." + mc);
}

export function diagnosisSummaryLabels(state: Any): string[] {
  return [
    pulpDiagnosisLabel(state),
    apicalDiagnosisLabel(state),
    resorptionDiagnosisLabel(state),
  ].filter((x): x is string => !!x);
}

export function cariesSeverityTierLabel(state: Any): string | null {
  if (!state.caries || state.caries.size === 0 || !state.cariesSeverity) return null;
  let max = 0;
  for (const c of state.caries) {
    const surface = String(c).replace(/^caries-/, "");
    const sev = state.cariesSeverity.get(surface);
    if (typeof sev === "number" && sev > max) max = sev;
  }
  if (max <= 0) return null;
  const tier = max <= 2 ? "superficial" : max <= 4 ? "moderate" : "deep";
  return t("summary.severity." + tier);
}

export function fractureSummaryLabel(state: Any): string | null {
  if (!(state.brokenMesial || state.brokenIncisal || state.brokenDistal)) return null;
  return t("summary.fracture");
}
