/**
 * Clinical Status Preset Calculation Engine
 *
 * Pure candidate-state calculators for status extras presets:
 * - span
 * - arch-bridge
 * - partial-removable
 * - full-removable
 * - bar-denture
 *
 * Computes candidate tooth states without committing transactions, mutating DOM,
 * triggering SVG repaints, or executing confirmation gates.
 */

import { defaultState, serializeState, hydrateState } from "@/state/payload";
import { getStatusExtrasMeta } from "@/engine/clinicalOptions";
import {
  PRIMARY_MILK,
  MIXED_PERMANENT,
  MIXED_MILK,
  MIXED_NONE,
} from "@/engine/constants";
import type { Any } from "@/engine/types";

export interface ClinicalPresetContext {
  getCurrentState: (toothNo: number) => Any | undefined;
  getStatusExtrasMeta?: () => Any;
}

/**
 * Creates a candidate accumulator closure that mirrors the original `collect()` mechanism.
 *
 * Rules:
 * - Accumulates through Map<number, ToothState>
 * - Preserves insertion order
 * - Prior candidate precedence for overlapping tooth lists
 * - Exact serialization/hydration cloning: hydrateState(serializeState(base), false)
 * - Default state fallback
 * - Treats mutation callback returning a replacement state (or mutates clone in place)
 * - Zero writes to committed tooth-state map
 */
export function createCandidateAccumulator(context: ClinicalPresetContext) {
  const changes = new Map<number, Any>();

  const collect = (teeth: number[], fn: (clone: Any, toothNo: number) => Any | void) => {
    for (const toothNo of teeth) {
      const base = changes.get(toothNo) ?? context.getCurrentState(toothNo) ?? defaultState();
      const clone = hydrateState(serializeState(base), false);
      const next = fn(clone, toothNo) || clone;
      changes.set(toothNo, next);
    }
  };

  return { changes, collect };
}

/**
 * Legacy crownMaterial values only ever offered "zircon" | "metal" here; fold
 * the deliberate metal -> metal-ceramic rename (matches hydrateState migration).
 */
export const toRestorationMaterial = (material: Any): Any =>
  material === "metal" ? "metal-ceramic" : material;

/**
 * Pillar (abutment) tooth: a present tooth gets a crown restoration, flagged
 * as a bridge pillar. Sets new-model fields; multi-tooth bridge-span overlay
 * is rendered separately.
 */
export const setBridgeCrown = (s: Any, material: Any): void => {
  s.toothSubstrate = "crownprep";
  s.restorationType = "crown";
  s.restorationMaterial = toRestorationMaterial(material);
  s.bridgePillar = true;
  s.brokenMesial = false;
  s.brokenIncisal = false;
  s.brokenDistal = false;
};

/**
 * Pontic (gap) tooth: a missing tooth gets a bridge-type restoration.
 */
export const setBridgePontic = (s: Any, material: Any): void => {
  s.restorationType = "bridge";
  s.restorationMaterial = toRestorationMaterial(material);
};

/**
 * Calculates candidate states for a span preset.
 */
export function calculateSpanPreset(option: Any, context: ClinicalPresetContext): Map<number, Any> {
  const { changes, collect } = createCandidateAccumulator(context);
  collect(option.teeth || [], (s: Any) => {
    if (s.toothSelection === "tooth-base") {
      setBridgeCrown(s, option.material);
    } else if (s.toothSelection === "none") {
      setBridgePontic(s, option.material);
    }
  });
  return changes;
}

/**
 * Calculates candidate states for an arch-bridge preset.
 */
export function calculateArchBridgePreset(option: Any, context: ClinicalPresetContext): Map<number, Any> {
  const { changes, collect } = createCandidateAccumulator(context);
  const getMeta = context.getStatusExtrasMeta ?? getStatusExtrasMeta;
  const meta = getMeta();
  const archTeeth = (arch: string): number[] => meta?.[arch] || [];
  const archWisdom = (arch: string): number[] => meta?.wisdom?.[arch] || [];

  const teeth = archTeeth(option.arch);
  const wisdom = new Set(archWisdom(option.arch));
  const present = teeth.filter((tn: number) => context.getCurrentState(tn)?.toothSelection === "tooth-base");

  if (present.length >= 2) {
    const first = present[0];
    const last = present[present.length - 1];
    const startIdx = teeth.indexOf(first);
    const endIdx = teeth.indexOf(last);
    const between = startIdx < endIdx ? teeth.slice(startIdx + 1, endIdx) : [];
    collect(teeth, (s: Any, tn: number) => {
      if (wisdom.has(tn)) return;
      if (s.toothSelection === "tooth-base") {
        setBridgeCrown(s, option.material);
      } else if (s.toothSelection === "none" && between.includes(tn)) {
        setBridgePontic(s, option.missingMaterial || option.material);
      }
    });
  } else {
    collect(teeth, (s: Any, tn: number) => {
      if (wisdom.has(tn)) return;
      if (s.toothSelection === "tooth-base") {
        setBridgeCrown(s, option.material);
      }
    });
  }

  return changes;
}

/**
 * Calculates candidate states for a partial-removable preset.
 */
export function calculatePartialRemovablePreset(option: Any, context: ClinicalPresetContext): Map<number, Any> {
  const { changes, collect } = createCandidateAccumulator(context);
  const getMeta = context.getStatusExtrasMeta ?? getStatusExtrasMeta;
  const meta = getMeta();
  const archTeeth = (arch: string): number[] => meta?.[arch] || [];
  const archWisdom = (arch: string): number[] => meta?.wisdom?.[arch] || [];

  const teeth = archTeeth(option.arch);
  const wisdom = new Set(archWisdom(option.arch));
  collect(teeth, (s: Any, tn: number) => {
    if (wisdom.has(tn)) return;
    if (s.toothSelection === "none") {
      s.prosthesis = "removable-partial";
    }
  });

  return changes;
}

/**
 * Calculates candidate states for a full-removable preset.
 */
export function calculateFullRemovablePreset(option: Any, context: ClinicalPresetContext): Map<number, Any> {
  const { changes, collect } = createCandidateAccumulator(context);
  const getMeta = context.getStatusExtrasMeta ?? getStatusExtrasMeta;
  const meta = getMeta();
  const archTeeth = (arch: string): number[] => meta?.[arch] || [];
  const archWisdom = (arch: string): number[] => meta?.wisdom?.[arch] || [];

  const teeth = archTeeth(option.arch);
  const wisdom = new Set(archWisdom(option.arch));
  collect(teeth, (_s: Any, tn: number) => {
    const next = defaultState();
    next.toothSelection = "none";
    next.prosthesis = wisdom.has(tn) ? "none" : "removable-full";
    return next;
  });

  return changes;
}

/**
 * Calculates candidate states for a bar-denture preset.
 */
export function calculateBarDenturePreset(option: Any, context: ClinicalPresetContext): Map<number, Any> {
  const { changes, collect } = createCandidateAccumulator(context);
  const getMeta = context.getStatusExtrasMeta ?? getStatusExtrasMeta;
  const implantTeeth = option.implants || [];
  const missingTeeth = option.missing || [];
  const archTeeth = option.arch ? (getMeta()?.[option.arch] || []) : [];
  const sevenEight = archTeeth.filter((tn: number) => [7, 8].includes(tn % 10));

  collect(implantTeeth, (_s: Any, _tn: number) => {
    const next = defaultState();
    next.toothSelection = "implant";
    next.prosthesis = "bar-denture";
    return next;
  });
  collect(missingTeeth, (_s: Any, _tn: number) => {
    const next = defaultState();
    next.toothSelection = "none";
    next.prosthesis = "bar-denture";
    return next;
  });
  collect(sevenEight, (_s: Any, _tn: number) => {
    const next = defaultState();
    next.toothSelection = "none";
    return next;
  });

  return changes;
}

/**
 * Calculates candidate-state mutations for a clinical status extra preset.
 *
 * Returns:
 * - `Map<number, ToothState>` if the preset is supported (including supported no-ops that produce empty or unchanged maps).
 * - `null` if the option is missing, invalid, or unrecognized (unsupported preset).
 */
export function calculateStatusPresetChanges(
  option: Any,
  context: ClinicalPresetContext,
): Map<number, Any> | null {
  if (!option) return null;

  if (option.type === "span") {
    return calculateSpanPreset(option, context);
  }
  if (option.type === "arch-bridge") {
    return calculateArchBridgePreset(option, context);
  }
  if (option.type === "partial-removable") {
    return calculatePartialRemovablePreset(option, context);
  }
  if (option.type === "full-removable") {
    return calculateFullRemovablePreset(option, context);
  }
  if (option.type === "bar-denture") {
    return calculateBarDenturePreset(option, context);
  }

  return null;
}

/**
 * Target state calculation for Primary Dentition.
 *
 * Rules:
 * - Allocates a fresh `defaultState()` on every invocation.
 * - `PRIMARY_MILK` teeth receive `"milktooth"`.
 * - All other teeth receive `"none"`.
 * - Completely pure: no chart, DOM, or SVG mutations.
 */
export function calculatePrimaryDentitionTarget(toothNo: number): Any {
  const s = defaultState();
  s.toothSelection = PRIMARY_MILK.has(toothNo) ? "milktooth" : "none";
  return s;
}

/**
 * Target state calculation for Mixed Dentition.
 *
 * Rules:
 * - Allocates a fresh `defaultState()` on every invocation.
 * - Exact branch precedence:
 *   1. `MIXED_PERMANENT` -> `"tooth-base"`
 *   2. `MIXED_MILK` -> `"milktooth"`
 *   3. `MIXED_NONE` -> `"none"`
 * - Unmatched teeth retain the unmodified `defaultState()` result.
 * - Completely pure: no chart, DOM, or SVG mutations.
 */
export function calculateMixedDentitionTarget(toothNo: number): Any {
  const s = defaultState();
  if (MIXED_PERMANENT.has(toothNo)) {
    s.toothSelection = "tooth-base";
  } else if (MIXED_MILK.has(toothNo)) {
    s.toothSelection = "milktooth";
  } else if (MIXED_NONE.has(toothNo)) {
    s.toothSelection = "none";
  }
  return s;
}

