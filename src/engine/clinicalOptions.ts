import { t } from "@/i18n/useI18n";
import { optionsFor } from "@/registry/uiOptions";
import { restorationOptions } from "@/registry/restorations";
import { isUnderGum, isExtraction, VALID_PERI_IMPLANT } from "@/state/payload";
import { kebabToCamel } from "@/state/pulpApical";
import { STATUS_EXTRAS } from "@/status_extras";
import { PROSTHESIS_SUMMARY_KEY, OCCLUSAL_TEETH } from "@/engine/constants";
import { availableFillingMaterials } from "@/engine/sessionSettings";
import { getChartMode } from "@/state/chart";
import type { Any } from "@/engine/types";

export function getPeriapicalTypeOptions() {
  return optionsFor("periapicalType").map((o) => ({ value: o.value, label: t(o.labelKey) }));
}

// Tooth substrate control options (natural / radix / broken / crown-prep).
export function getSubstrateOptions() {
  return [
    { value: "natural", label: t("substrate.natural") },
    { value: "radix", label: t("substrate.radix") },
    { value: "broken", label: t("substrate.broken") },
    { value: "crownprep", label: t("substrate.crownprep") },
  ];
}

export function restorationViewFor(toothNo: Any): "front" | "occlusal" {
  return typeof toothNo === "number" && OCCLUSAL_TEETH.has(toothNo) ? "occlusal" : "front";
}

// Combined restoration dropdown, generated from RESTORATION_MATRIX via restorationOptions()
export function getRestorationOptions(
  view: "front" | "occlusal",
  ctx: { isImplant?: boolean; toothSelection?: string } = {},
) {
  return restorationOptions(view, { isImplant: !!ctx.isImplant, view, toothSelection: ctx.toothSelection }).map((o) => {
    if (o.prosthesis) {
      return {
        value: `prosthesis|${o.prosthesis}`,
        label: `${t(o.prefixKey ?? "restoration.prefix.removable")}: ${t(PROSTHESIS_SUMMARY_KEY[o.prosthesis] ?? o.prosthesis)}`,
      };
    }
    return {
      value: `${o.restorationType}|${o.restorationMaterial}`,
      label:
        o.restorationType === "none"
          ? t(o.labelKey)
          : `${t(o.prefixKey ?? "restoration.prefix.fixed")}: ${t(o.typeLabelKey ?? "")} – ${t(o.materialLabelKey ?? "")}`,
    };
  });
}

// #restorationRow visibility gate
export function restorationRowHidden(s: Any): boolean {
  const isMilktooth = s?.toothSelection === "milktooth";
  const underGum = isUnderGum(s?.toothSelection);
  const extraction = isExtraction(s?.toothSelection) || (s?.toothSelection === "none" && s?.extractionWound);
  return isMilktooth || underGum || extraction || s?.toothSubstrate === "radix";
}

export function __restorationRowHiddenForTest(s: Record<string, unknown>): boolean {
  return restorationRowHidden(s);
}

// Apply a combined-dropdown value to a tooth state
export function applyRestorationSelection(s: Any, value: string) {
  if (value.startsWith("prosthesis|")) {
    s.prosthesis = value.slice("prosthesis|".length);
    s.restorationType = "none";
    s.restorationMaterial = "none";
    s.bridgePillar = false;
    s.crownReplace = false;
  } else {
    const [type, material] = value.split("|");
    s.restorationType = type || "none";
    s.restorationMaterial = material || "none";
    s.prosthesis = "none";
    if (s.restorationType === "none") {
      s.bridgePillar = false;
      s.crownReplace = false;
    } else {
      s.crownNeeded = false;
    }
  }
  if (s.restorationType !== "crown" && s.restorationType !== "bridge") {
    s.crownLeakage = false;
  }
}

export function __applyRestorationSelectionForTest(s: Record<string, unknown>, value: string): void {
  applyRestorationSelection(s, value);
}

export function restorationSummaryLabel(type: Any, material: Any): string {
  const materialKey = `restoration.material.${material === "metal-ceramic" ? "metalCeramic" : material}`;
  return `${t(`restoration.type.${type}`)} – ${t(materialKey)}`;
}

// Pick the broken-crown SVG layer id
export function getBrokenCrownVariant(state: Any): string | null {
  const m = !!state.brokenMesial;
  const i = !!state.brokenIncisal;
  const d = !!state.brokenDistal;
  if (m && d && i) return "tooth-broken-mesial-distal-incisal";
  if (m && d) return "tooth-broken-mesial-distal";
  if (d && i) return "tooth-broken-distal-incisal";
  if (m && i) return "tooth-broken-mesial-incisal";
  if (d) return "tooth-broken-distal";
  if (m) return "tooth-broken-mesial";
  if (i) return "tooth-broken-incisal";
  return null;
}

export function getToothSelectOptions(currentSelection?: string) {
  const all = optionsFor("toothSelection").map((o) => ({ value: o.value, label: t(o.labelKey) }));
  if (getChartMode() !== "plan") return all;
  const allowed = new Set(["none", "tooth-base", "implant"]);
  if (currentSelection) allowed.add(currentSelection);
  return all.filter((o) => allowed.has(o.value));
}

export function getStatusExtras() {
  if (!STATUS_EXTRAS || !Array.isArray(STATUS_EXTRAS.options)) return [];
  return STATUS_EXTRAS.options.map((opt) => ({
    ...opt,
    label: t(opt.labelKey),
  }));
}

export function getStatusExtrasMeta() {
  return STATUS_EXTRAS?.arches || null;
}

export function getMobilityOptions() {
  return optionsFor("mobility").map((o) => ({ value: o.value, label: t(o.labelKey) }));
}

export function mobilityRowHidden(s: Any): boolean {
  const isImplant = s?.toothSelection === "implant";
  const underGum = isUnderGum(s?.toothSelection);
  const extraction = isExtraction(s?.toothSelection) || (s?.toothSelection === "none" && s?.extractionWound);
  return isImplant || underGum || extraction;
}

export function __mobilityRowHiddenForTest(s: Record<string, unknown>): boolean {
  return mobilityRowHidden(s);
}

export function mobilityDisabled(s: Any): boolean {
  const isImplant = s?.toothSelection === "implant";
  const extraction = isExtraction(s?.toothSelection) || (s?.toothSelection === "none" && s?.extractionWound);
  return s?.toothSelection === "none" || extraction || isImplant;
}

export function __mobilityDisabledForTest(s: Record<string, unknown>): boolean {
  return mobilityDisabled(s);
}

export function getFillingOptions(isMilktooth: Any) {
  const labels: Record<string, string> = {
    amalgam: t("filling.option.amalgam"),
    composite: t("filling.option.composite"),
    gic: t("filling.option.gic"),
    temporary: t("filling.option.temporary"),
  };
  const mats = availableFillingMaterials().filter((m) => !(isMilktooth && m === "amalgam"));
  return [
    { value: "none", label: t("filling.option.none") },
    ...mats.map((m) => ({ value: m, label: labels[m] })),
  ];
}

export function fillingDefectOptions() {
  return ["none", "marginal", "fracture", "wear"].map((v) => ({ value: v, label: t("fillingDefect." + v) }));
}

export function getPeriImplantOptions(): { value: string; label: string }[] {
  return Array.from(VALID_PERI_IMPLANT).map((v) => ({ value: v, label: t("periImplant." + kebabToCamel(v)) }));
}

export function applyPeriImplantSelection(s: Any, value: string) {
  s.periImplant = value;
}

export function __applyPeriImplantSelectionForTest(s: Record<string, unknown>, value: string): void {
  applyPeriImplantSelection(s, value);
}
