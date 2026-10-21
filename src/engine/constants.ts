export const MILKTOOTH_BLOCKED = new Set([16, 17, 18, 26, 27, 28, 36, 37, 38, 46, 47, 48]);

// Fissure sealing applies to the occlusal posterior teeth — premolars and
// first/second molars. Third molars are excluded (rarely sealed).
export const FISSURE_ALLOWED = new Set([14, 15, 16, 17, 24, 25, 26, 27, 34, 35, 36, 37, 44, 45, 46, 47]);

export const BROKEN_VARIANTS = new Set([
  "tooth-broken-incisal",
  "tooth-broken-distal-incisal",
  "tooth-broken-distal",
  "tooth-broken-mesial-incisal",
  "tooth-broken-mesial",
]);

export const PRIMARY_MILK = new Set([11, 12, 13, 14, 15, 21, 22, 23, 24, 25, 31, 32, 33, 34, 35, 41, 42, 43, 44, 45]);
export const MIXED_PERMANENT = new Set([11, 12, 16, 21, 22, 26, 31, 32, 36, 41, 42, 46]);
export const MIXED_MILK = new Set([13, 14, 15, 23, 24, 25, 33, 34, 35, 43, 44, 45]);
export const MIXED_NONE = new Set([17, 18, 27, 28, 37, 38, 47, 48]);

// Anterior teeth (incisors + canines) — FDI 11-13/21-23/31-33/41-43. Drives
// the "occlusal" -> "incisal" display-only label swap; the stored surface
// value always stays "occlusal".
export const ANTERIOR_TEETH = new Set([11, 12, 13, 21, 22, 23, 31, 32, 33, 41, 42, 43]);

export function isAnteriorTooth(toothNo: number): boolean {
  return ANTERIOR_TEETH.has(toothNo);
}

// Teeth that render an occlusal view (premolars + molars); their restoration
// dropdown offers occlusal-only types (onlay).
export const OCCLUSAL_TEETH = new Set([14, 15, 24, 25, 34, 35, 44, 45, 16, 17, 18, 26, 27, 28, 36, 37, 38, 46, 47, 48]);

// Restoration material -> its SVG wrapper <g> id. Every material lives inside a
// per-material group in the artwork; activating the group lets its (individually
// toggled) crown/connector/inlay/onlay/veneer children paint. `temporary` uses a
// legacy group id; all others match the material id.
export const RESTORATION_WRAPPER_GROUP: Record<string, string> = {
  emax: "emax",
  gold: "gold",
  gradia: "gradia",
  zircon: "zircon",
  metal: "metal",
  "metal-ceramic": "metal-ceramic",
  telescope: "telescope",
  temporary: "temporary-restorations",
};

// `prosthesis` axis value -> its i18n summary label. Implant attachments
// (healing-abutment/locator/bar) and removable/bar-retained dentures share this
// one map — used by both the per-tooth tooltip (getStateSummary) and the
// tooth-information panel (getOdontogramSummary).
export const PROSTHESIS_SUMMARY_KEY: Record<string, string> = {
  "healing-abutment": "prosthesis.type.healingAbutment",
  locator: "prosthesis.type.locator",
  "locator-denture": "prosthesis.type.locatorDenture",
  bar: "prosthesis.type.bar",
  "bar-denture": "prosthesis.type.barDenture",
  "removable-partial": "prosthesis.type.removablePartial",
  "removable-full": "prosthesis.type.removableFull",
};

export const VALID_CARD_IDS = new Set(["controls", "status", "caries", "filling", "rootPeriodontium", "diagnoses"]);

export const FILLING_MATERIALS = ["amalgam", "composite", "gic", "temporary"] as const;

export const SECONDARY_CARS_LABEL_KEY: Record<number, string> = {
  0: "caries.cars.0",
  1: "caries.cars.1",
  2: "caries.cars.2",
  3: "caries.cars.3",
  4: "caries.cars.4",
  5: "caries.cars.5",
  6: "caries.cars.6",
};

export const SUMMARY_SURFACE_ORDER = ["buccal", "mesial", "occlusal", "distal", "lingual", "subcrown"] as const;

export const SUMMARY_ENDO_KEY: Record<string, string> = {
  "endo-medical-filling": "endo.option.medicalFilling",
  "endo-filling": "endo.option.filling",
  "endo-filling-incomplete": "endo.option.incompleteFilling",
  "endo-glass-pin": "endo.option.glassPin",
  "endo-metal-pin": "endo.option.metalPin",
};

export const SUMMARY_ROOT_CARIES_KEY: Record<string, string> = {
  active: "rootCaries.active",
  arrested: "rootCaries.arrested",
  "active-cavitated": "rootCaries.activeCavitated",
};

export const SVG_NS = "http://www.w3.org/2000/svg";
